import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logOutboundMessage, logProactiveRun, generateCorrelationId, computeEventFingerprint } from "../_shared/audit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// PROACTIVE AGENT - Unified Trigger Mechanism
// ============================================================================

interface ProactiveEvent {
  type: 'reminder_due' | 'inactivity' | 'seasonal' | 'diagnosis_followup' | 'sensor_alert' | 'device_offline' | 'sensor_trend';
  priority: number;
  data: any;
  message_hint: string;
}

interface ProfileContext {
  id: string;
  telegram_chat_id: number | null;
  personality: string;
  timezone: string;
  location: string | null;
  notification_frequency: string;
  display_name: string | null;
  experience_level: string | null;
  primary_concerns: string[] | null;
  proactive_enabled: boolean;
}

// Allowed notification_frequency values
const VALID_FREQUENCIES = ['off', 'daily', 'weekly', 'realtime'];

function normalizeFrequency(freq: string | null | undefined): string {
  if (!freq) return 'daily';
  const lower = freq.toLowerCase().trim();
  if (VALID_FREQUENCIES.includes(lower)) return lower;
  console.warn(`[ProactiveAgent] Unknown frequency "${freq}", defaulting to skip`);
  return 'off'; // Unknown values => safe skip
}

function isQuietHours(quietStart: string, quietEnd: string, timezone: string): boolean {
  try {
    const now = new Date();
    const userTime = now.toLocaleTimeString('en-US', { 
      timeZone: timezone, hour12: false, hour: '2-digit', minute: '2-digit' 
    });
    const currentMinutes = parseInt(userTime.split(':')[0]) * 60 + parseInt(userTime.split(':')[1]);
    const startMinutes = parseInt(quietStart.split(':')[0]) * 60 + parseInt(quietStart.split(':')[1]);
    const endMinutes = parseInt(quietEnd.split(':')[0]) * 60 + parseInt(quietEnd.split(':')[1]);
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch {
    return false;
  }
}

async function hasSentToday(supabase: any, profileId: string): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('proactive_messages')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .gte('sent_at', today.toISOString());
  return (count || 0) > 0;
}

async function hasSentThisWeek(supabase: any, profileId: string): Promise<boolean> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { count } = await supabase
    .from('proactive_messages')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .gte('sent_at', weekAgo.toISOString());
  return (count || 0) > 0;
}

// Realtime dedup: check if we already sent for this event fingerprint today
async function hasRecentFingerprint(supabase: any, profileId: string, fingerprint: string): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('outbound_message_audit')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('message_hash', fingerprint)
    .eq('delivery_status', 'delivered')
    .gte('created_at', today.toISOString());
  return (count || 0) > 0;
}

async function getDueReminders(supabase: any, profileId: string): Promise<ProactiveEvent[]> {
  const { data: reminders } = await supabase
    .from('reminders')
    .select(`id, reminder_type, notes, next_due, frequency_days, plants!inner(id, name, nickname, species)`)
    .eq('profile_id', profileId)
    .eq('is_active', true)
    .lte('next_due', new Date().toISOString());
  if (!reminders || reminders.length === 0) return [];
  return reminders.map((r: any) => ({
    type: 'reminder_due' as const,
    priority: 1,
    data: {
      reminder_id: r.id,
      plant_id: r.plants.id,
      plant_name: r.plants.nickname || r.plants.name || r.plants.species,
      reminder_type: r.reminder_type,
      frequency_days: r.frequency_days,
      notes: r.notes,
    },
    message_hint: `Time to ${r.reminder_type} ${r.plants.nickname || r.plants.species}`,
  }));
}

async function getInactivePlants(supabase: any, profileId: string): Promise<ProactiveEvent[]> {
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const { data: plants } = await supabase
    .from('plants')
    .select('id, name, nickname, species, created_at')
    .eq('profile_id', profileId);
  if (!plants || plants.length === 0) return [];
  const events: ProactiveEvent[] = [];
  for (const plant of plants) {
    if (new Date(plant.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) continue;
    const { count } = await supabase
      .from('care_events')
      .select('*', { count: 'exact', head: true })
      .eq('plant_id', plant.id)
      .gte('created_at', twoWeeksAgo.toISOString());
    if (count === 0) {
      events.push({
        type: 'inactivity',
        priority: 3,
        data: { plant_id: plant.id, plant_name: plant.nickname || plant.name || plant.species, days_inactive: 14 },
        message_hint: `Haven't heard about ${plant.nickname || plant.species} in a while`,
      });
    }
  }
  return events;
}

async function getDiagnosisFollowups(supabase: any, profileId: string): Promise<ProactiveEvent[]> {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data: diagnoses } = await supabase
    .from('plant_identifications')
    .select(`id, diagnosis, severity, treatment, created_at, plants!inner(id, name, nickname, species, profile_id)`)
    .eq('plants.profile_id', profileId)
    .not('diagnosis', 'is', null)
    .in('severity', ['moderate', 'severe'])
    .gte('created_at', sevenDaysAgo.toISOString())
    .lte('created_at', threeDaysAgo.toISOString());
  if (!diagnoses || diagnoses.length === 0) return [];
  return diagnoses.map((d: any) => ({
    type: 'diagnosis_followup' as const,
    priority: 2,
    data: {
      diagnosis_id: d.id,
      plant_id: d.plants.id,
      plant_name: d.plants.nickname || d.plants.name || d.plants.species,
      diagnosis: d.diagnosis,
      severity: d.severity,
      treatment: d.treatment,
    },
    message_hint: `Following up on ${d.plants.nickname || d.plants.species}'s ${d.diagnosis}`,
  }));
}

function getSeasonalContext(location: string | null): { season: string; tips: string[] } | null {
  const now = new Date();
  const month = now.getMonth();
  let season: string;
  let tips: string[] = [];
  if (month >= 2 && month <= 4) {
    season = 'spring';
    tips = ['Time to start fertilizing after winter dormancy', 'Increase watering as growth picks up', 'Check for new growth and consider repotting'];
  } else if (month >= 5 && month <= 7) {
    season = 'summer';
    tips = ['Watch for signs of heat stress', 'Consider moving plants away from direct afternoon sun', 'Misting can help with humidity during hot days'];
  } else if (month >= 8 && month <= 10) {
    season = 'fall';
    tips = ['Reduce fertilizing as plants slow down', 'Move tropical plants away from cold drafts', 'Great time to take cuttings before winter'];
  } else {
    season = 'winter';
    tips = ['Reduce watering - most plants are dormant', 'Keep plants away from cold windows and heating vents', 'Avoid fertilizing during dormancy'];
  }
  return { season, tips };
}

async function getActiveSensorAlerts(supabase: any, profileId: string): Promise<ProactiveEvent[]> {
  const { data: alerts } = await supabase
    .from('sensor_alerts')
    .select(`id, alert_type, severity, metric, current_value, threshold_value, message, created_at, plants!inner(id, name, nickname, species)`)
    .eq('profile_id', profileId)
    .eq('status', 'active')
    .order('severity', { ascending: true }); // critical first

  if (!alerts || alerts.length === 0) return [];

  return alerts.map((a: any) => ({
    type: 'sensor_alert' as const,
    priority: a.severity === 'critical' ? 0.5 : 1.5, // critical outranks everything
    data: {
      alert_id: a.id,
      plant_id: a.plants.id,
      plant_name: a.plants.nickname || a.plants.name || a.plants.species,
      alert_type: a.alert_type,
      severity: a.severity,
      metric: a.metric,
      current_value: a.current_value,
      threshold_value: a.threshold_value,
      message: a.message,
    },
    message_hint: a.message,
  }));
}

async function getOfflineDevices(supabase: any, profileId: string): Promise<ProactiveEvent[]> {
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const { data: devices } = await supabase
    .from('devices')
    .select('id, name, plant_id, last_seen_at, plants(name, nickname, species)')
    .eq('profile_id', profileId)
    .eq('status', 'active')
    .not('plant_id', 'is', null) // only care about assigned devices
    .lt('last_seen_at', threeHoursAgo);

  if (!devices || devices.length === 0) return [];

  return devices.map((d: any) => {
    const ageMs = Date.now() - new Date(d.last_seen_at).getTime();
    const ageHours = Math.round(ageMs / (60 * 60 * 1000));
    const plantName = d.plants?.nickname || d.plants?.name || d.plants?.species || 'Unknown';
    return {
      type: 'device_offline' as const,
      priority: ageHours > 24 ? 1 : 2.5,
      data: {
        device_id: d.id,
        device_name: d.name,
        plant_id: d.plant_id,
        plant_name: plantName,
        hours_offline: ageHours,
      },
      message_hint: `${d.name} on ${plantName} hasn't reported in ${ageHours}h`,
    };
  });
}

async function getSensorTrends(supabase: any, profileId: string): Promise<ProactiveEvent[]> {
  // Find plants where soil moisture is dropping fast (>10% in last 6 hours)
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: readings } = await supabase
    .from('sensor_readings')
    .select('plant_id, soil_moisture, created_at')
    .eq('profile_id', profileId)
    .not('plant_id', 'is', null)
    .not('soil_moisture', 'is', null)
    .gte('created_at', sixHoursAgo)
    .order('created_at', { ascending: true });

  if (!readings || readings.length < 2) return [];

  // Group by plant, compute trend
  const byPlant: Record<string, { values: number[]; times: number[] }> = {};
  for (const r of readings) {
    if (!byPlant[r.plant_id]) byPlant[r.plant_id] = { values: [], times: [] };
    byPlant[r.plant_id].values.push(r.soil_moisture);
    byPlant[r.plant_id].times.push(new Date(r.created_at).getTime());
  }

  const events: ProactiveEvent[] = [];
  for (const [plantId, data] of Object.entries(byPlant)) {
    if (data.values.length < 2) continue;
    const first = data.values[0];
    const last = data.values[data.values.length - 1];
    const drop = first - last;

    if (drop > 10) {
      // Soil is drying fast — fetch plant name
      const { data: plant } = await supabase
        .from('plants')
        .select('name, nickname, species')
        .eq('id', plantId)
        .single();

      const plantName = plant?.nickname || plant?.name || plant?.species || 'Unknown';
      events.push({
        type: 'sensor_trend' as const,
        priority: drop > 20 ? 1 : 2,
        data: {
          plant_id: plantId,
          plant_name: plantName,
          metric: 'soil_moisture',
          current_value: last,
          drop_amount: Math.round(drop),
          hours: 6,
        },
        message_hint: `${plantName}'s soil moisture dropped ${Math.round(drop)}% in the last 6 hours (now at ${Math.round(last)}%)`,
      });
    }
  }

  return events;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const runStartedAt = new Date();
  const startTime = Date.now();
  const triggerSource = req.headers.get('X-Trigger-Source') || 'unknown';
  console.log(`[ProactiveAgent] Function invoked | trigger=${triggerSource} | timestamp=${runStartedAt.toISOString()}`);

  // Run-level tracking
  const skipReasons: Record<string, number> = {};
  let profilesScanned = 0;
  let totalEventsFound = 0;
  let messagesDelivered = 0;
  let messagesSkipped = 0;

  function trackSkip(reason: string) {
    skipReasons[reason] = (skipReasons[reason] || 0) + 1;
    messagesSkipped++;
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[ProactiveAgent] Missing required environment variables');
      return new Response(JSON.stringify({ error: 'Configuration error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, telegram_chat_id, personality, timezone, location, notification_frequency, display_name, experience_level, primary_concerns, proactive_enabled');

    if (!profiles || profiles.length === 0) {
      console.log('[ProactiveAgent] No profiles found');
      await logProactiveRun(supabase, {
        runStartedAt, runEndedAt: new Date(), triggerSource,
        profilesScanned: 0, eventsFound: 0, messagesDelivered: 0, messagesSkipped: 0,
        skipReasons,
      });
      return new Response(JSON.stringify({ processed: 0, triggered: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[ProactiveAgent] Found ${profiles.length} profiles to process`);

    let processed = 0;
    let triggered = 0;

    for (const profile of profiles as ProfileContext[]) {
      const profileStartTime = Date.now();
      processed++;
      profilesScanned++;
      console.log(`[ProactiveAgent] Processing profile ${profile.id} | telegram_chat_id=${profile.telegram_chat_id || 'none'} | timezone=${profile.timezone} | frequency=${profile.notification_frequency || 'default'} | proactive_enabled=${profile.proactive_enabled}`);

      // ===== KILL SWITCH CHECK =====
      if (profile.proactive_enabled === false) {
        console.log(`[ProactiveAgent] SKIP profile ${profile.id} | reason=proactive_disabled (kill switch)`);
        trackSkip('proactive_disabled');
        continue;
      }

      // ===== FREQUENCY NORMALIZATION & ENFORCEMENT =====
      const frequency = normalizeFrequency(profile.notification_frequency);
      if (frequency === 'off') {
        console.log(`[ProactiveAgent] SKIP profile ${profile.id} | reason=frequency_off (value="${profile.notification_frequency}")`);
        trackSkip('frequency_off');
        // Log to audit as skipped
        await logOutboundMessage(supabase, {
          sourceFunction: 'proactive-agent',
          sourceMode: 'proactive',
          profileId: profile.id,
          telegramChatId: profile.telegram_chat_id,
          deliveryStatus: 'skipped',
          errorDetail: `Frequency is off (raw value: "${profile.notification_frequency}")`,
        });
        continue;
      }

      // Check agent permissions
      const { data: sendPermission } = await supabase
        .from('agent_permissions')
        .select('enabled')
        .eq('profile_id', profile.id)
        .eq('capability', 'send_reminders')
        .maybeSingle();

      if (sendPermission && !sendPermission.enabled) {
        console.log(`[ProactiveAgent] SKIP profile ${profile.id} | reason=send_reminders_disabled`);
        trackSkip('send_reminders_disabled');
        continue;
      }

      // Get proactive preferences
      const { data: preferences } = await supabase
        .from('proactive_preferences')
        .select('topic, enabled, quiet_hours_start, quiet_hours_end')
        .eq('profile_id', profile.id);

      if (!preferences || preferences.length === 0) {
        console.log(`[ProactiveAgent] SKIP profile ${profile.id} | reason=no_preferences`);
        trackSkip('no_preferences');
        continue;
      }

      const enabledTopics = preferences.filter(p => p.enabled).map(p => p.topic);
      console.log(`[ProactiveAgent] Profile ${profile.id} preferences | enabled_topics=[${enabledTopics.join(',')}]`);

      // Check quiet hours
      const quietStart = preferences[0]?.quiet_hours_start || '22:00';
      const quietEnd = preferences[0]?.quiet_hours_end || '08:00';

      if (isQuietHours(quietStart, quietEnd, profile.timezone || 'America/New_York')) {
        console.log(`[ProactiveAgent] SKIP profile ${profile.id} | reason=quiet_hours | window=${quietStart}-${quietEnd}`);
        trackSkip('quiet_hours');
        continue;
      }

      // ===== RATE LIMITING BY NORMALIZED FREQUENCY =====
      if (frequency === 'daily') {
        if (await hasSentToday(supabase, profile.id)) {
          console.log(`[ProactiveAgent] SKIP profile ${profile.id} | reason=daily_limit_reached`);
          trackSkip('daily_limit_reached');
          continue;
        }
      } else if (frequency === 'weekly') {
        if (await hasSentThisWeek(supabase, profile.id)) {
          console.log(`[ProactiveAgent] SKIP profile ${profile.id} | reason=weekly_limit_reached`);
          trackSkip('weekly_limit_reached');
          continue;
        }
      } else if (frequency === 'realtime') {
        // Realtime: still enforce per-event dedup (no duplicate sends for same event same day)
        // Checked per-event below via fingerprint
      }

      // Collect events
      const allEvents: ProactiveEvent[] = [];
      for (const pref of preferences) {
        if (!pref.enabled) continue;
        if (pref.topic === 'care_reminders') {
          const reminders = await getDueReminders(supabase, profile.id);
          console.log(`[ProactiveAgent] Profile ${profile.id} | care_reminders found=${reminders.length}`);
          allEvents.push(...reminders);
        } else if (pref.topic === 'observations') {
          const inactive = await getInactivePlants(supabase, profile.id);
          console.log(`[ProactiveAgent] Profile ${profile.id} | observations found=${inactive.length}`);
          allEvents.push(...inactive);
        } else if (pref.topic === 'health_followups') {
          const followups = await getDiagnosisFollowups(supabase, profile.id);
          console.log(`[ProactiveAgent] Profile ${profile.id} | health_followups found=${followups.length}`);
          allEvents.push(...followups);
        } else if (pref.topic === 'seasonal_tips') {
          const seasonal = getSeasonalContext(profile.location);
          const includeSeasonalTip = seasonal && Math.random() < 0.3;
          if (includeSeasonalTip) {
            allEvents.push({
              type: 'seasonal', priority: 4,
              data: { season: seasonal.season, tips: seasonal.tips },
              message_hint: `Seasonal ${seasonal.season} care tip`,
            });
          }
        }
      }

      // Sensor intelligence — collected once, outside preference loop
      if (enabledTopics.includes('observations') || enabledTopics.includes('care_reminders')) {
        const [sensorAlerts, offlineDevices, trends] = await Promise.all([
          getActiveSensorAlerts(supabase, profile.id),
          getOfflineDevices(supabase, profile.id),
          getSensorTrends(supabase, profile.id),
        ]);
        console.log(`[ProactiveAgent] Profile ${profile.id} | sensor: alerts=${sensorAlerts.length} offline=${offlineDevices.length} trends=${trends.length}`);
        allEvents.push(...sensorAlerts, ...offlineDevices, ...trends);
      }

      totalEventsFound += allEvents.length;

      if (allEvents.length === 0) {
        console.log(`[ProactiveAgent] SKIP profile ${profile.id} | reason=no_pending_events`);
        trackSkip('no_pending_events');
        continue;
      }

      // ===== EVENT FINGERPRINT DEDUP (especially for realtime) =====
      const dedupedEvents: ProactiveEvent[] = [];
      for (const event of allEvents) {
        const identifiers: Record<string, string> = { type: event.type };
        if (event.data.reminder_id) identifiers.reminder_id = event.data.reminder_id;
        if (event.data.plant_id) identifiers.plant_id = event.data.plant_id;
        if (event.data.diagnosis_id) identifiers.diagnosis_id = event.data.diagnosis_id;
        if (event.data.alert_id) identifiers.alert_id = event.data.alert_id;
        if (event.data.device_id) identifiers.device_id = event.data.device_id;
        
        const fingerprint = computeEventFingerprint(profile.id, event.type, identifiers);
        
        if (frequency === 'realtime') {
          // For realtime, check per-event dedup
          if (await hasRecentFingerprint(supabase, profile.id, fingerprint)) {
            console.log(`[ProactiveAgent] DEDUP: skipping event ${event.type} for profile ${profile.id} (fingerprint=${fingerprint})`);
            continue;
          }
        }
        dedupedEvents.push(event);
      }

      if (dedupedEvents.length === 0) {
        console.log(`[ProactiveAgent] SKIP profile ${profile.id} | reason=all_events_deduped`);
        trackSkip('all_events_deduped');
        continue;
      }

      // Priority boosting
      const userConcerns = profile.primary_concerns || [];
      for (const event of dedupedEvents) {
        if (userConcerns.includes('watering') && event.type === 'reminder_due' && event.data?.reminder_type === 'water') event.priority -= 0.5;
        if (userConcerns.includes('pests') && event.type === 'diagnosis_followup') event.priority -= 0.5;
        if (userConcerns.includes('identification') && event.type === 'inactivity') event.priority -= 0.3;
        if (userConcerns.includes('general') && event.type === 'seasonal') event.priority -= 0.3;
      }

      dedupedEvents.sort((a, b) => a.priority - b.priority);
      const topEvents = dedupedEvents.slice(0, 3);

      const correlationId = generateCorrelationId('proactive');
      const eventSummary = topEvents.map(e => `${e.type}(p=${e.priority})`).join(',');
      console.log(`[ProactiveAgent] DECISION: SEND profile ${profile.id} | correlation=${correlationId} | total_events=${allEvents.length} deduped=${dedupedEvents.length} selected=${topEvents.length} | events=[${eventSummary}]`);

      let delivered = false;

      try {
        const orchidAgentUrl = `${SUPABASE_URL}/functions/v1/orchid-agent`;
        const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

        if (profile.telegram_chat_id) {
          // Log attempt
          await logOutboundMessage(supabase, {
            sourceFunction: 'proactive-agent',
            sourceMode: 'proactive',
            profileId: profile.id,
            telegramChatId: profile.telegram_chat_id,
            correlationId,
            deliveryStatus: 'attempted',
            triggerPayload: { events: topEvents.map(e => ({ type: e.type, hint: e.message_hint, data: e.data })) },
          });

          const proactivePayload = {
            proactiveMode: true,
            profileId: profile.id,
            channel: 'telegram',
            events: topEvents,
            eventSummary: topEvents.map(e => e.message_hint).join('; '),
            correlationId,
          };

          const agentCallStart = Date.now();
          const webhookResponse = await fetch(orchidAgentUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'X-Internal-Agent-Call': 'true',
              'X-Proactive-Trigger': 'true',
              'X-Correlation-Id': correlationId,
            },
            body: JSON.stringify(proactivePayload),
          });
          const agentCallDuration = Date.now() - agentCallStart;

          if (webhookResponse.ok) {
            const agentResponse = await webhookResponse.json();
            console.log(`[ProactiveAgent] Agent response for profile ${profile.id} | correlation=${correlationId} | duration_ms=${agentCallDuration} | has_reply=${!!agentResponse.reply}`);

            if (agentResponse.reply && TELEGRAM_BOT_TOKEN) {
              const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
              const tgResponse = await fetch(telegramUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: profile.telegram_chat_id, text: agentResponse.reply }),
              });

              const tgResult = await tgResponse.json();
              if (tgResult.ok) {
                delivered = true;
                const tgMsgId = tgResult.result?.message_id;
                console.log(`[ProactiveAgent] DELIVERED | profile=${profile.id} | correlation=${correlationId} | chat_id=${profile.telegram_chat_id} | message_id=${tgMsgId}`);

                // Log delivered
                await logOutboundMessage(supabase, {
                  sourceFunction: 'proactive-agent',
                  sourceMode: 'proactive',
                  profileId: profile.id,
                  telegramChatId: profile.telegram_chat_id,
                  correlationId,
                  messagePreview: agentResponse.reply,
                  telegramMessageId: tgMsgId,
                  deliveryStatus: 'delivered',
                  triggerPayload: { events: topEvents.map(e => ({ type: e.type, hint: e.message_hint })) },
                });

                // Send media (best-effort)
                if (agentResponse.mediaToSend?.length > 0) {
                  for (const media of agentResponse.mediaToSend) {
                    const photoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
                    await fetch(photoUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ chat_id: profile.telegram_chat_id, photo: media.url, caption: media.caption || '' }),
                    });
                  }
                }
              } else {
                console.error(`[ProactiveAgent] Telegram API error | profile=${profile.id} | correlation=${correlationId} | error_code=${tgResult.error_code} | description=${tgResult.description}`);
                await logOutboundMessage(supabase, {
                  sourceFunction: 'proactive-agent',
                  sourceMode: 'proactive',
                  profileId: profile.id,
                  telegramChatId: profile.telegram_chat_id,
                  correlationId,
                  messagePreview: agentResponse.reply,
                  deliveryStatus: 'failed',
                  errorCode: String(tgResult.error_code),
                  errorDetail: tgResult.description,
                });
              }
            } else {
              console.log(`[ProactiveAgent] No message to send | profile=${profile.id} | correlation=${correlationId}`);
              await logOutboundMessage(supabase, {
                sourceFunction: 'proactive-agent',
                sourceMode: 'proactive',
                profileId: profile.id,
                telegramChatId: profile.telegram_chat_id,
                correlationId,
                deliveryStatus: 'skipped',
                errorDetail: 'Agent returned no reply or no bot token',
              });
            }
          } else {
            const errorText = await webhookResponse.text();
            console.error(`[ProactiveAgent] Agent call failed | profile=${profile.id} | correlation=${correlationId} | status=${webhookResponse.status} | error=${errorText}`);
            await logOutboundMessage(supabase, {
              sourceFunction: 'proactive-agent',
              sourceMode: 'proactive',
              profileId: profile.id,
              telegramChatId: profile.telegram_chat_id,
              correlationId,
              deliveryStatus: 'failed',
              errorCode: String(webhookResponse.status),
              errorDetail: errorText.substring(0, 500),
            });
          }
        } else {
          console.log(`[ProactiveAgent] SKIP profile ${profile.id} | reason=no_telegram_chat_id`);
          trackSkip('no_telegram_chat_id');
        }

        if (delivered) {
          triggered++;
          messagesDelivered++;

          await supabase.from('proactive_messages').insert({
            profile_id: profile.id,
            trigger_type: topEvents[0].type,
            trigger_data: topEvents.map(e => e.data),
            message_content: `[Triggered via unified agent] ${topEvents.map(e => e.message_hint).join(', ')}`,
            channel: 'telegram',
            sent_at: new Date().toISOString(),
          });

          // Update next_due for reminders
          for (const event of topEvents) {
            if (event.type === 'reminder_due' && event.data.reminder_id) {
              const nextDue = new Date();
              nextDue.setDate(nextDue.getDate() + event.data.frequency_days);
              await supabase
                .from('reminders')
                .update({ next_due: nextDue.toISOString(), updated_at: new Date().toISOString() })
                .eq('id', event.data.reminder_id);
            }
          }

          console.log(`[ProactiveAgent] Profile complete | profile=${profile.id} | correlation=${correlationId} | status=delivered | duration_ms=${Date.now() - profileStartTime}`);
        } else {
          console.log(`[ProactiveAgent] Profile complete | profile=${profile.id} | correlation=${correlationId} | status=not_delivered | duration_ms=${Date.now() - profileStartTime}`);
        }
      } catch (triggerError) {
        console.error(`[ProactiveAgent] Profile error | profile=${profile.id} | error=${triggerError instanceof Error ? triggerError.message : String(triggerError)}`);
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[ProactiveAgent] Run complete | duration_ms=${totalDuration} | profiles=${processed} | delivered=${triggered} | skipped=${messagesSkipped} | skip_reasons=${JSON.stringify(skipReasons)}`);

    // Log run audit
    await logProactiveRun(supabase, {
      runStartedAt,
      runEndedAt: new Date(),
      triggerSource,
      profilesScanned,
      eventsFound: totalEventsFound,
      messagesDelivered,
      messagesSkipped,
      skipReasons,
    });

    return new Response(JSON.stringify({ processed, triggered, skipped: messagesSkipped, skipReasons }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ProactiveAgent] Fatal error | duration_ms=${Date.now() - startTime} | error=${errorMessage}`);

    // Try to log the failed run
    try {
      const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      await logProactiveRun(supabase, {
        runStartedAt,
        runEndedAt: new Date(),
        triggerSource,
        profilesScanned,
        eventsFound: totalEventsFound,
        messagesDelivered,
        messagesSkipped,
        skipReasons,
        error: errorMessage,
      });
    } catch { /* best-effort */ }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
