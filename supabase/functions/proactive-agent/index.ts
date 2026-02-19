import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// PROACTIVE AGENT - Unified Trigger Mechanism
// This function identifies WHEN to reach out and triggers the main orchid-agent
// with proactive context, so the user gets the same agent experience.
// ============================================================================

interface ProactiveEvent {
  type: 'reminder_due' | 'inactivity' | 'seasonal' | 'diagnosis_followup';
  priority: number;
  data: any;
  message_hint: string;
}

interface ProfileContext {
  id: string;
  phone_number: string | null;
  whatsapp_number: string | null;
  telegram_chat_id: number | null;
  personality: string;
  timezone: string;
  location: string | null;
  notification_frequency: string;
  display_name: string | null;
  experience_level: string | null;
  primary_concerns: string[] | null;
}

// Check if current time is within quiet hours for a profile
function isQuietHours(quietStart: string, quietEnd: string, timezone: string): boolean {
  try {
    const now = new Date();
    const userTime = now.toLocaleTimeString('en-US', { 
      timeZone: timezone, 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    const currentMinutes = parseInt(userTime.split(':')[0]) * 60 + parseInt(userTime.split(':')[1]);
    const startMinutes = parseInt(quietStart.split(':')[0]) * 60 + parseInt(quietStart.split(':')[1]);
    const endMinutes = parseInt(quietEnd.split(':')[0]) * 60 + parseInt(quietEnd.split(':')[1]);
    
    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch {
    return false;
  }
}

// Check if we've already sent a proactive message today
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

// Check if we've sent in the last 7 days (for weekly frequency)
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

// Query for due reminders
async function getDueReminders(supabase: any, profileId: string): Promise<ProactiveEvent[]> {
  const { data: reminders } = await supabase
    .from('reminders')
    .select(`
      id, reminder_type, notes, next_due, frequency_days,
      plants!inner(id, name, nickname, species)
    `)
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

// Query for inactive plants
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
    // Skip plants created less than a week ago
    if (new Date(plant.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
      continue;
    }
    
    const { count } = await supabase
      .from('care_events')
      .select('*', { count: 'exact', head: true })
      .eq('plant_id', plant.id)
      .gte('created_at', twoWeeksAgo.toISOString());
    
    if (count === 0) {
      events.push({
        type: 'inactivity',
        priority: 3,
        data: {
          plant_id: plant.id,
          plant_name: plant.nickname || plant.name || plant.species,
          days_inactive: 14,
        },
        message_hint: `Haven't heard about ${plant.nickname || plant.species} in a while`,
      });
    }
  }
  
  return events;
}

// Query for diagnosis follow-ups
async function getDiagnosisFollowups(supabase: any, profileId: string): Promise<ProactiveEvent[]> {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { data: diagnoses } = await supabase
    .from('plant_identifications')
    .select(`
      id, diagnosis, severity, treatment, created_at,
      plants!inner(id, name, nickname, species, profile_id)
    `)
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

// Get seasonal tips based on location and date
function getSeasonalContext(location: string | null): { season: string; tips: string[] } | null {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  
  // Northern hemisphere seasons (simple approximation)
  let season: string;
  let tips: string[] = [];
  
  if (month >= 2 && month <= 4) {
    season = 'spring';
    tips = [
      'Time to start fertilizing after winter dormancy',
      'Increase watering as growth picks up',
      'Check for new growth and consider repotting',
    ];
  } else if (month >= 5 && month <= 7) {
    season = 'summer';
    tips = [
      'Watch for signs of heat stress',
      'Consider moving plants away from direct afternoon sun',
      'Misting can help with humidity during hot days',
    ];
  } else if (month >= 8 && month <= 10) {
    season = 'fall';
    tips = [
      'Reduce fertilizing as plants slow down',
      'Move tropical plants away from cold drafts',
      'Great time to take cuttings before winter',
    ];
  } else {
    season = 'winter';
    tips = [
      'Reduce watering - most plants are dormant',
      'Keep plants away from cold windows and heating vents',
      'Avoid fertilizing during dormancy',
    ];
  }
  
  return { season, tips };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const triggerSource = req.headers.get('X-Trigger-Source') || 'unknown';
  console.log(`[ProactiveAgent] Function invoked | trigger=${triggerSource} | timestamp=${new Date().toISOString()}`);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[ProactiveAgent] Missing required environment variables');
      return new Response(JSON.stringify({ error: 'Configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('[ProactiveAgent] Starting proactive check...');

    // Get all profiles with extended onboarding data
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, phone_number, whatsapp_number, telegram_chat_id, personality, timezone, location, notification_frequency, display_name, experience_level, primary_concerns');

    if (!profiles || profiles.length === 0) {
      console.log('[ProactiveAgent] No profiles found in database');
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
      console.log(`[ProactiveAgent] Processing profile ${profile.id} | telegram_chat_id=${profile.telegram_chat_id || 'none'} | timezone=${profile.timezone} | frequency=${profile.notification_frequency || 'default'}`);

      // Check agent permissions for sending (default: enabled if no row exists)
      const { data: sendPermission } = await supabase
        .from('agent_permissions')
        .select('enabled')
        .eq('profile_id', profile.id)
        .eq('capability', 'send_reminders')
        .maybeSingle();

      if (sendPermission && !sendPermission.enabled) {
        console.log(`[ProactiveAgent] SKIP profile ${profile.id} | reason=send_reminders_disabled`);
        continue;
      }

      // Get user's proactive preferences
      const { data: preferences } = await supabase
        .from('proactive_preferences')
        .select('topic, enabled, quiet_hours_start, quiet_hours_end')
        .eq('profile_id', profile.id);

      if (!preferences || preferences.length === 0) {
        console.log(`[ProactiveAgent] SKIP profile ${profile.id} | reason=no_preferences`);
        continue;
      }

      const enabledTopics = preferences.filter(p => p.enabled).map(p => p.topic);
      console.log(`[ProactiveAgent] Profile ${profile.id} preferences | enabled_topics=[${enabledTopics.join(',')}]`);

      // Check quiet hours
      const quietStart = preferences[0]?.quiet_hours_start || '22:00';
      const quietEnd = preferences[0]?.quiet_hours_end || '08:00';

      if (isQuietHours(quietStart, quietEnd, profile.timezone || 'America/New_York')) {
        console.log(`[ProactiveAgent] SKIP profile ${profile.id} | reason=quiet_hours | window=${quietStart}-${quietEnd}`);
        continue;
      }

      // Check notification frequency
      if (profile.notification_frequency === 'daily' || !profile.notification_frequency) {
        if (await hasSentToday(supabase, profile.id)) {
          console.log(`[ProactiveAgent] SKIP profile ${profile.id} | reason=daily_limit_reached`);
          continue;
        }
      } else if (profile.notification_frequency === 'weekly') {
        if (await hasSentThisWeek(supabase, profile.id)) {
          console.log(`[ProactiveAgent] SKIP profile ${profile.id} | reason=weekly_limit_reached`);
          continue;
        }
      }

      // Collect events based on enabled preferences
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
          console.log(`[ProactiveAgent] Profile ${profile.id} | seasonal_tips eligible=${!!seasonal} include=${includeSeasonalTip}`);
          if (includeSeasonalTip) { // 30% chance to include seasonal tip
            allEvents.push({
              type: 'seasonal',
              priority: 4,
              data: { season: seasonal.season, tips: seasonal.tips },
              message_hint: `Seasonal ${seasonal.season} care tip`,
            });
          }
        }
      }

      if (allEvents.length === 0) {
        console.log(`[ProactiveAgent] SKIP profile ${profile.id} | reason=no_pending_events`);
        continue;
      }

      // ======================================================================
      // PRIORITY BOOSTING based on user's primary_concerns
      // ======================================================================
      const userConcerns = profile.primary_concerns || [];
      
      for (const event of allEvents) {
        // Boost priority for events matching user's stated concerns
        // Lower priority number = higher priority
        if (userConcerns.includes('watering') && event.type === 'reminder_due' && 
            event.data?.reminder_type === 'water') {
          event.priority -= 0.5; // Boost watering reminders
        }
        if (userConcerns.includes('pests') && event.type === 'diagnosis_followup') {
          event.priority -= 0.5; // Boost health followups for pest-concerned users
        }
        if (userConcerns.includes('identification') && event.type === 'inactivity') {
          event.priority -= 0.3; // Boost inactivity checks for ID-focused users
        }
        if (userConcerns.includes('general') && event.type === 'seasonal') {
          event.priority -= 0.3; // Boost seasonal tips for general-care users
        }
      }

      // Sort by priority and take top 3
      allEvents.sort((a, b) => a.priority - b.priority);
      const topEvents = allEvents.slice(0, 3);

      const eventSummary = topEvents.map(e => `${e.type}(p=${e.priority})`).join(',');
      console.log(`[ProactiveAgent] DECISION: SEND profile ${profile.id} | total_events=${allEvents.length} selected_events=${topEvents.length} | events=[${eventSummary}]`);

      // ========================================================================
      // UNIFIED AGENT APPROACH: Trigger orchid-agent with proactive context
      // This ensures the user gets the same Orchid, same memory, same personality
      // ========================================================================
      
      // Track whether THIS profile's message was actually delivered
      let delivered = false;

      try {
        const orchidAgentUrl = `${SUPABASE_URL}/functions/v1/orchid-agent`;
        const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

        if (profile.telegram_chat_id) {
          // ================================================================
          // TELEGRAM PATH: Use internal agent call + direct Telegram Bot API
          // ================================================================
          console.log(`[ProactiveAgent] Calling orchid-agent for profile ${profile.id} | chat_id=${profile.telegram_chat_id}`);

          const proactivePayload = {
            proactiveMode: true,
            profileId: profile.id,
            channel: 'telegram',
            events: topEvents,
            eventSummary: topEvents.map(e => e.message_hint).join('; '),
          };

          const agentCallStart = Date.now();
          const webhookResponse = await fetch(orchidAgentUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'X-Internal-Agent-Call': 'true',
              'X-Proactive-Trigger': 'true',
            },
            body: JSON.stringify(proactivePayload),
          });
          const agentCallDuration = Date.now() - agentCallStart;

          if (webhookResponse.ok) {
            const agentResponse = await webhookResponse.json();
            console.log(`[ProactiveAgent] Agent response received for profile ${profile.id} | duration_ms=${agentCallDuration} | has_reply=${!!agentResponse.reply} | has_media=${agentResponse.mediaToSend?.length || 0}`);

            // Send via Telegram Bot API directly — check response for delivery confirmation
            if (agentResponse.reply && TELEGRAM_BOT_TOKEN) {
              console.log(`[ProactiveAgent] Sending to Telegram chat_id=${profile.telegram_chat_id} | message_length=${agentResponse.reply.length}`);
              const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
              const tgSendStart = Date.now();
              const tgResponse = await fetch(telegramUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: profile.telegram_chat_id,
                  text: agentResponse.reply,
                }),
              });
              const tgSendDuration = Date.now() - tgSendStart;

              const tgResult = await tgResponse.json();
              if (tgResult.ok) {
                delivered = true;
                console.log(`[ProactiveAgent] Message delivered successfully | profile=${profile.id} chat_id=${profile.telegram_chat_id} duration_ms=${tgSendDuration} message_id=${tgResult.result?.message_id}`);

                // Send any media (best-effort, don't block delivery status)
                if (agentResponse.mediaToSend?.length > 0) {
                  console.log(`[ProactiveAgent] Sending ${agentResponse.mediaToSend.length} media attachments to chat_id=${profile.telegram_chat_id}`);
                  for (const media of agentResponse.mediaToSend) {
                    const photoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
                    await fetch(photoUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        chat_id: profile.telegram_chat_id,
                        photo: media.url,
                        caption: media.caption || '',
                      }),
                    });
                  }
                }
              } else {
                console.error(`[ProactiveAgent] Telegram API error | profile=${profile.id} chat_id=${profile.telegram_chat_id} error_code=${tgResult.error_code} description=${tgResult.description}`);
              }
            } else {
              console.log(`[ProactiveAgent] No message to send | profile=${profile.id} has_reply=${!!agentResponse.reply} has_token=${!!TELEGRAM_BOT_TOKEN}`);
            }
          } else {
            const errorText = await webhookResponse.text();
            console.error(`[ProactiveAgent] Agent call failed | profile=${profile.id} status=${webhookResponse.status} duration_ms=${agentCallDuration} error=${errorText}`);
          }
        } else {
          // No Telegram — skip (Twilio disabled)
          console.log(`[ProactiveAgent] SKIP profile ${profile.id} | reason=no_telegram_chat_id (Telegram-only mode)`);
        }

        // Only log and update reminders if message was actually delivered
        if (delivered) {
          triggered++;

          await supabase.from('proactive_messages').insert({
            profile_id: profile.id,
            trigger_type: topEvents[0].type,
            trigger_data: topEvents.map(e => e.data),
            message_content: `[Triggered via unified agent] ${topEvents.map(e => e.message_hint).join(', ')}`,
            channel: 'telegram',
            sent_at: new Date().toISOString(),
          });
          console.log(`[ProactiveAgent] Logged proactive_message record | profile=${profile.id} trigger_type=${topEvents[0].type}`);

          // Update next_due for any reminders we notified about
          for (const event of topEvents) {
            if (event.type === 'reminder_due' && event.data.reminder_id) {
              const nextDue = new Date();
              nextDue.setDate(nextDue.getDate() + event.data.frequency_days);

              await supabase
                .from('reminders')
                .update({ next_due: nextDue.toISOString(), updated_at: new Date().toISOString() })
                .eq('id', event.data.reminder_id);

              console.log(`[ProactiveAgent] Updated reminder next_due | reminder_id=${event.data.reminder_id} next_due=${nextDue.toISOString()}`);
            }
          }

          const profileDuration = Date.now() - profileStartTime;
          console.log(`[ProactiveAgent] Profile complete | profile=${profile.id} status=delivered duration_ms=${profileDuration}`);
        } else {
          const profileDuration = Date.now() - profileStartTime;
          console.log(`[ProactiveAgent] Profile complete | profile=${profile.id} status=not_delivered duration_ms=${profileDuration}`);
        }
      } catch (triggerError) {
        const profileDuration = Date.now() - profileStartTime;
        console.error(`[ProactiveAgent] Profile error | profile=${profile.id} duration_ms=${profileDuration} error=${triggerError instanceof Error ? triggerError.message : String(triggerError)}`);
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[ProactiveAgent] Run complete | total_duration_ms=${totalDuration} profiles_processed=${processed} messages_delivered=${triggered} success_rate=${processed > 0 ? ((triggered / processed) * 100).toFixed(1) : 0}%`);

    return new Response(JSON.stringify({ processed, triggered }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(`[ProactiveAgent] Fatal error | duration_ms=${totalDuration} error=${errorMessage}`);
    if (errorStack) {
      console.error(`[ProactiveAgent] Stack trace: ${errorStack}`);
    }
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
