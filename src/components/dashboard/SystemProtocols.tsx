import React from 'react';
import { Shield, Bell, Trash2, MessageSquare, Lightbulb, Calendar, Edit2, Save, X, Zap, Brain, Leaf, Heart } from 'lucide-react';

const mono = "ui-monospace, monospace";

interface SystemProtocolsProps {
  protocols: {
    quietHoursStart: number;
    quietHoursEnd: number;
    careReminders: boolean;
    observations: boolean;
    seasonalTips: boolean;
    healthFollowups: boolean;
    canDeletePlants: boolean;
    canDeleteNotes: boolean;
    canDeleteInsights: boolean;
    canSendReminders: boolean;
    canSendInsights: boolean;
    canCreateReminders: boolean;
  } | null;
  tempProtocols: {
    quietHoursStart: number;
    quietHoursEnd: number;
    careReminders: boolean;
    observations: boolean;
    seasonalTips: boolean;
    healthFollowups: boolean;
    canDeletePlants: boolean;
    canDeleteNotes: boolean;
    canDeleteInsights: boolean;
    canSendReminders: boolean;
    canSendInsights: boolean;
    canCreateReminders: boolean;
  };
  isEditingProtocols: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  updateTempProtocol: (key: string, value: any) => void;
  toggleTempProtocol: (key: string) => void;
  QuietHoursClock: React.ComponentType<any>;
}

export const SystemProtocols: React.FC<SystemProtocolsProps> = ({
  protocols,
  tempProtocols,
  isEditingProtocols,
  onEdit,
  onSave,
  onCancel,
  updateTempProtocol,
  toggleTempProtocol,
  QuietHoursClock,
}) => {
  if (!protocols) {
    return (
      <div style={{ border: '1px solid rgba(255,255,255,0.06)', padding: '24px' }}>
        <div className="flex items-center gap-2 mb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
          <Shield size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
          <span style={{ fontFamily: mono, fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>system protocols</span>
        </div>
        <div className="flex items-center justify-center py-8">
          <p style={{ fontFamily: mono, fontSize: '12px', color: 'rgba(255,255,255,0.25)' }}>initializing settings...</p>
        </div>
      </div>
    );
  }

  const activeProtocols = isEditingProtocols ? tempProtocols : protocols;

  const proactiveSettings = [
    { key: 'careReminders', label: 'Care Reminders', desc: 'Receive watering & care notifications', icon: Zap },
    { key: 'observations', label: 'Proactive Observations', desc: 'AI insights about your plants', icon: Brain },
    { key: 'seasonalTips', label: 'Seasonal Tips', desc: 'Tips based on time of year', icon: Leaf },
    { key: 'healthFollowups', label: 'Health Follow-ups', desc: 'Check-ins after health issues', icon: Heart },
  ];

  const agentPermissions = [
    { key: 'canSendReminders', label: 'Send Reminders', desc: 'Agent can send care reminder messages', icon: Bell },
    { key: 'canSendInsights', label: 'Send Insights', desc: 'Agent can share plant observations', icon: Lightbulb },
    { key: 'canCreateReminders', label: 'Create Reminders', desc: 'Agent can schedule new reminders', icon: Calendar },
    { key: 'canDeletePlants', label: 'Delete Plants', desc: 'Agent can remove plants from collection', icon: Trash2 },
    { key: 'canDeleteNotes', label: 'Delete Notes', desc: 'Agent can remove care notes', icon: MessageSquare },
    { key: 'canDeleteInsights', label: 'Delete Insights', desc: 'Agent can remove learned insights', icon: Lightbulb },
  ];

  const ToggleRow = ({ item, isDestructive = false }: { item: typeof agentPermissions[0]; isDestructive?: boolean }) => {
    const Icon = item.icon;
    const isEnabled = activeProtocols[item.key as keyof typeof activeProtocols];

    return (
      <div
        onClick={() => toggleTempProtocol(item.key)}
        className="flex items-center justify-between transition-all"
        style={{
          padding: '10px 12px',
          border: '1px solid',
          borderColor: isEditingProtocols ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
          cursor: isEditingProtocols ? 'pointer' : 'default',
          backgroundColor: 'transparent',
        }}
        onMouseEnter={(e) => { if (isEditingProtocols) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = isEditingProtocols ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'; }}
      >
        <div className="flex items-start gap-3">
          <Icon size={14} className="mt-0.5" style={{ color: isDestructive ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.2)' }} />
          <div>
            <div style={{
              fontFamily: mono, fontSize: '12px', fontWeight: 'bold',
              color: isDestructive && isEnabled ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.6)',
            }}>
              {item.label}
            </div>
            <div style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.2)', marginTop: '2px' }}>
              {item.desc}
            </div>
          </div>
        </div>
        {/* Toggle Switch */}
        <div style={{
          width: '36px', height: '18px', borderRadius: '9px', position: 'relative',
          transition: 'all 200ms',
          backgroundColor: isEnabled
            ? (isDestructive ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.3)')
            : 'rgba(255,255,255,0.08)',
          border: '1px solid',
          borderColor: isEnabled
            ? (isDestructive ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.4)')
            : 'rgba(255,255,255,0.12)',
        }}>
          <div style={{
            position: 'absolute', top: '2px', width: '12px', height: '12px', borderRadius: '6px',
            backgroundColor: 'white', transition: 'transform 200ms',
            transform: isEnabled ? 'translateX(18px)' : 'translateX(2px)',
          }} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.06)', padding: '24px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
        <div className="flex items-center gap-2">
          <Shield size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
          <span style={{ fontFamily: mono, fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>system protocols</span>
        </div>

        {!isEditingProtocols ? (
          <button onClick={onEdit} className="cursor-pointer" style={{ padding: '6px', border: '1px solid transparent', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.3)' }}>
            <Edit2 size={14} />
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={onCancel} className="cursor-pointer" style={{ padding: '6px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)' }}>
              <X size={14} />
            </button>
            <button onClick={onSave} className="cursor-pointer" style={{ padding: '6px', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white' }}>
              <Save size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {/* Quiet Hours */}
        <div style={{
          padding: '16px',
          border: '1px solid',
          borderColor: isEditingProtocols ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
        }}>
          <div className="flex items-center gap-2 mb-4">
            <Bell size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
            <span style={{ fontFamily: mono, fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)' }}>quiet hours</span>
          </div>
          <div className="flex items-center justify-center py-2">
            <QuietHoursClock
              startHour={activeProtocols.quietHoursStart}
              endHour={activeProtocols.quietHoursEnd}
              onStartChange={(hour: number) => updateTempProtocol('quietHoursStart', hour)}
              onEndChange={(hour: number) => updateTempProtocol('quietHoursEnd', hour)}
              disabled={!isEditingProtocols}
            />
          </div>
          <div style={{ textAlign: 'center', fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.2)', marginTop: '8px' }}>
            no notifications during these hours
          </div>
        </div>

        {/* Proactive */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Brain size={12} style={{ color: 'rgba(255,255,255,0.25)' }} />
            <span style={{ fontFamily: mono, fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>proactive features</span>
          </div>
          <div className="flex flex-col gap-3">
            {proactiveSettings.map((item) => <ToggleRow key={item.key} item={item} />)}
          </div>
        </div>

        {/* Agent Permissions */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield size={12} style={{ color: 'rgba(255,255,255,0.25)' }} />
            <span style={{ fontFamily: mono, fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>agent permissions</span>
          </div>
          <div className="flex flex-col gap-3">
            {agentPermissions.filter(p => !p.key.includes('Delete')).map((item) => <ToggleRow key={item.key} item={item} />)}
          </div>

          {/* Destructive */}
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Trash2 size={10} style={{ color: 'rgba(239,68,68,0.4)' }} />
              <span style={{ fontFamily: mono, fontSize: '9px', textTransform: 'uppercase', color: 'rgba(239,68,68,0.5)' }}>destructive actions</span>
            </div>
            <div className="flex flex-col gap-3">
              {agentPermissions.filter(p => p.key.includes('Delete')).map((item) => <ToggleRow key={item.key} item={item} isDestructive />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};