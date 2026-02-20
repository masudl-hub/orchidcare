import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { SystemProtocols } from '@/components/dashboard/SystemProtocols';
import { useSystemSettings, useUpdateQuietHours, useTogglePreference, useToggleAgentPermission, useInitializeSettings } from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useRef } from 'react';

// QuietHoursClock component (inline for now)
const QuietHoursClock = ({ startHour, endHour, onStartChange, onEndChange, disabled }: any) => {
  return (
    <div className="flex items-center gap-4">
      <div className="text-center">
        <label className="font-mono text-[9px] uppercase text-stone-400 block mb-2">Start</label>
        <input
          type="number"
          min="0"
          max="23"
          value={startHour}
          onChange={(e) => onStartChange(parseInt(e.target.value))}
          disabled={disabled}
          className="w-16 px-2 py-1 border border-stone-300 rounded text-center font-mono disabled:bg-stone-100"
        />
        <span className="text-xs font-mono text-stone-500 ml-1">:00</span>
      </div>
      <div className="text-stone-400">→</div>
      <div className="text-center">
        <label className="font-mono text-[9px] uppercase text-stone-400 block mb-2">End</label>
        <input
          type="number"
          min="0"
          max="23"
          value={endHour}
          onChange={(e) => onEndChange(parseInt(e.target.value))}
          disabled={disabled}
          className="w-16 px-2 py-1 border border-stone-300 rounded text-center font-mono disabled:bg-stone-100"
        />
        <span className="text-xs font-mono text-stone-500 ml-1">:00</span>
      </div>
    </div>
  );
};

function TelegramConnectionCard() {
  const { user, profile, refreshProfile } = useAuth();
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const isConnected = !!profile?.telegram_chat_id;

  const generateCode = async () => {
    if (!user) return;
    setGenerating(true);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const { error } = await supabase
      .from('linking_codes')
      .insert({ user_id: user.id, code });

    if (error) {
      const retry = Math.floor(100000 + Math.random() * 900000).toString();
      const { error: retryErr } = await supabase
        .from('linking_codes')
        .insert({ user_id: user.id, code: retry });
      if (!retryErr) setLinkCode(retry);
    } else {
      setLinkCode(code);
    }
    setGenerating(false);
  };

  // Poll for connection after code is generated
  useEffect(() => {
    if (!user || !linkCode || isConnected) return;

    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('telegram_chat_id')
        .eq('user_id', user.id)
        .single();

      if (data?.telegram_chat_id) {
        clearInterval(pollRef.current);
        setLinkCode(null);
        await refreshProfile();
      }
    }, 3000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user, linkCode, isConnected, refreshProfile]);

  return (
    <div className="bg-white border-2 border-black rounded-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-xs uppercase tracking-widest text-stone-500">Telegram</h3>
        {isConnected && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-green-600 border border-green-600 px-2 py-0.5 rounded">
            Connected
          </span>
        )}
      </div>

      {isConnected ? (
        <p className="font-mono text-sm text-stone-600">
          Linked as <span className="font-bold">@{profile?.telegram_username || 'unknown'}</span>
        </p>
      ) : linkCode ? (
        <div>
          <a
            href={`https://t.me/orchidcare_bot?start=${linkCode}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full border-2 border-black bg-black text-white px-4 py-3 font-mono text-xs uppercase tracking-widest text-center hover:bg-stone-800 transition-colors mb-3 rounded-lg"
          >
            Open Orchid on Telegram
          </a>
          <p className="font-mono text-[10px] text-stone-400 text-center">
            Or send <span className="font-bold tracking-wider">{linkCode}</span> to @orchidcare_bot
          </p>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <div className="w-1 h-1 bg-stone-300 rounded-full animate-pulse" />
            <span className="font-mono text-[10px] text-stone-400 uppercase tracking-widest">Waiting...</span>
          </div>
        </div>
      ) : (
        <button
          onClick={generateCode}
          disabled={generating}
          className="w-full border-2 border-black bg-black text-white px-4 py-3 font-mono text-xs uppercase tracking-widest text-center hover:bg-stone-800 transition-colors rounded-lg disabled:opacity-50"
        >
          {generating ? 'Generating...' : 'Connect Telegram'}
        </button>
      )}
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { data: settings, isLoading, needsInitialization } = useSystemSettings();
  const updateQuietHours = useUpdateQuietHours();
  const togglePreference = useTogglePreference();
  const toggleAgentPermission = useToggleAgentPermission();
  const initializeSettings = useInitializeSettings();
  
  // Track if initialization has been attempted to prevent infinite loop
  const initializationAttempted = useRef(false);
  
  // Auto-initialize settings if they're missing (once)
  useEffect(() => {
    if (needsInitialization && !initializationAttempted.current && !initializeSettings.isPending) {
      if (import.meta.env.DEV) console.log('Settings need initialization - creating default rows');
      initializationAttempted.current = true;
      initializeSettings.mutate();
    }
  }, [needsInitialization, initializeSettings]);
  
  const [isEditingProtocols, setIsEditingProtocols] = useState(false);
  const [tempProtocols, setTempProtocols] = useState({
    quietHoursStart: 22,
    quietHoursEnd: 8,
    careReminders: true,
    observations: true,
    seasonalTips: true,
    healthFollowups: true,
    canDeletePlants: false,
    canDeleteNotes: false,
    canDeleteInsights: false,
    canSendReminders: true,
    canSendInsights: true,
    canCreateReminders: true,
  });

  // Build protocols from backend data
  // If needsInitialization is true, wait for initialization instead of showing fallbacks
  const protocols = (settings && !needsInitialization) ? {
    quietHoursStart: parseInt(settings.quiet_hours_start?.split(':')[0] || '22'),
    quietHoursEnd: parseInt(settings.quiet_hours_end?.split(':')[0] || '8'),
    careReminders: settings.care_reminders_enabled ?? true,
    observations: settings.observations_enabled ?? true,
    seasonalTips: settings.seasonal_tips_enabled ?? true,
    healthFollowups: settings.health_followups_enabled ?? true,
    canDeletePlants: settings.can_delete_plants ?? false,
    canDeleteNotes: settings.can_delete_notes ?? false,
    canDeleteInsights: settings.can_delete_insights ?? false,
    canSendReminders: settings.can_send_reminders ?? true,
    canSendInsights: settings.can_send_insights ?? true,
    canCreateReminders: settings.can_create_reminders ?? true,
  } : null;

  // Sync tempProtocols when settings load
  useEffect(() => {
    if (settings && !isEditingProtocols) {
      setTempProtocols({
        quietHoursStart: parseInt(settings.quiet_hours_start?.split(':')[0] || '22'),
        quietHoursEnd: parseInt(settings.quiet_hours_end?.split(':')[0] || '8'),
        careReminders: settings.care_reminders_enabled ?? true,
        observations: settings.observations_enabled ?? true,
        seasonalTips: settings.seasonal_tips_enabled ?? true,
        healthFollowups: settings.health_followups_enabled ?? true,
        canDeletePlants: settings.can_delete_plants ?? false,
        canDeleteNotes: settings.can_delete_notes ?? false,
        canDeleteInsights: settings.can_delete_insights ?? false,
        canSendReminders: settings.can_send_reminders ?? true,
        canSendInsights: settings.can_send_insights ?? true,
        canCreateReminders: settings.can_create_reminders ?? true,
      });
    }
  }, [settings, isEditingProtocols]);

  const handleEdit = () => {
    setTempProtocols(protocols);
    setIsEditingProtocols(true);
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      // Update quiet hours
      const startTime = `${String(tempProtocols.quietHoursStart).padStart(2, '0')}:00`;
      const endTime = `${String(tempProtocols.quietHoursEnd).padStart(2, '0')}:00`;
      await updateQuietHours.mutateAsync({ start: startTime, end: endTime });

      // Update proactive preferences if changed
      if (tempProtocols.careReminders !== protocols.careReminders) {
        await togglePreference.mutateAsync({ topic: 'care_reminders', enabled: tempProtocols.careReminders });
      }
      if (tempProtocols.observations !== protocols.observations) {
        await togglePreference.mutateAsync({ topic: 'observations', enabled: tempProtocols.observations });
      }
      if (tempProtocols.seasonalTips !== protocols.seasonalTips) {
        await togglePreference.mutateAsync({ topic: 'seasonal_tips', enabled: tempProtocols.seasonalTips });
      }
      if (tempProtocols.healthFollowups !== protocols.healthFollowups) {
        await togglePreference.mutateAsync({ topic: 'health_followups', enabled: tempProtocols.healthFollowups });
      }

      // Update agent permissions if changed
      if (tempProtocols.canDeletePlants !== protocols.canDeletePlants) {
        await toggleAgentPermission.mutateAsync({ capability: 'delete_plants', enabled: tempProtocols.canDeletePlants });
      }
      if (tempProtocols.canDeleteNotes !== protocols.canDeleteNotes) {
        await toggleAgentPermission.mutateAsync({ capability: 'delete_notes', enabled: tempProtocols.canDeleteNotes });
      }
      if (tempProtocols.canDeleteInsights !== protocols.canDeleteInsights) {
        await toggleAgentPermission.mutateAsync({ capability: 'delete_insights', enabled: tempProtocols.canDeleteInsights });
      }
      if (tempProtocols.canSendReminders !== protocols.canSendReminders) {
        await toggleAgentPermission.mutateAsync({ capability: 'send_reminders', enabled: tempProtocols.canSendReminders });
      }
      if (tempProtocols.canSendInsights !== protocols.canSendInsights) {
        await toggleAgentPermission.mutateAsync({ capability: 'send_insights', enabled: tempProtocols.canSendInsights });
      }
      if (tempProtocols.canCreateReminders !== protocols.canCreateReminders) {
        await toggleAgentPermission.mutateAsync({ capability: 'create_reminders', enabled: tempProtocols.canCreateReminders });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }

    setIsEditingProtocols(false);
  };

  const handleCancel = () => {
    setTempProtocols(protocols);
    setIsEditingProtocols(false);
  };

  const updateTempProtocol = (key: string, value: any) => {
    setTempProtocols(prev => ({ ...prev, [key]: value }));
  };

  const toggleTempProtocol = (key: string) => {
    if (!isEditingProtocols) return;
    setTempProtocols(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  return (
    <div className="min-h-screen bg-[#ECE8E0] p-4 relative overflow-hidden">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        onClick={() => navigate('/dashboard')}
        className="absolute top-8 left-8 font-mono text-sm uppercase tracking-widest text-black hover:text-stone-600 transition-colors flex items-center gap-2"
      >
        <ArrowLeft size={16} />
        Back
      </motion.button>

      <div className="max-w-2xl mx-auto pt-24">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block border border-black rounded-lg px-3 py-1 mb-6 bg-white">
            <span className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
              SYSTEM SETTINGS
            </span>
          </div>
          
          <h1 className="text-5xl font-serif text-black mb-2">
            Settings
          </h1>
          <p className="font-mono text-sm text-stone-600">
            Configure your Orchid experience.
          </p>
        </div>

        {/* Telegram Connection */}
        <TelegramConnectionCard />

        {/* SystemProtocols Component */}
        {isLoading ? (
          <div className="bg-white border-2 border-black rounded-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
            </div>
          </div>
        ) : settings ? (
          <SystemProtocols
            protocols={protocols}
            tempProtocols={tempProtocols}
            isEditingProtocols={isEditingProtocols}
            onEdit={handleEdit}
            onSave={handleSave}
            onCancel={handleCancel}
            updateTempProtocol={updateTempProtocol}
            toggleTempProtocol={toggleTempProtocol}
            QuietHoursClock={QuietHoursClock}
          />
        ) : (
          <div className="bg-white border-2 border-black rounded-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8">
            <p className="font-mono text-sm text-stone-500 text-center">
              Unable to load settings. Please try again.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
