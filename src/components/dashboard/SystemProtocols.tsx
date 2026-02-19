import React from 'react';
import { Shield, Bell, Trash2, MessageSquare, Lightbulb, Calendar, Edit2, Save, X, Zap, Brain, Leaf, Heart } from 'lucide-react';

interface SystemProtocolsProps {
  protocols: {
    quietHoursStart: number;
    quietHoursEnd: number;
    // Proactive preferences
    careReminders: boolean;
    observations: boolean;
    seasonalTips: boolean;
    healthFollowups: boolean;
    // Agent permissions
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
  // Show loading state if protocols are not yet initialized
  if (!protocols) {
    return (
      <div className="bg-white border border-black p-6 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-shadow duration-300">
        <div className="flex items-center justify-between mb-6 border-b border-black pb-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-black text-white flex items-center justify-center rounded-sm text-[9px] font-bold"><Shield size={12} /></div>
            <h3 className="font-serif text-lg">System Protocols</h3>
          </div>
        </div>
        <div className="flex items-center justify-center py-8 text-stone-500">
          <p className="font-mono text-sm">Initializing settings...</p>
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
        className={`flex items-center justify-between p-3 border rounded-lg transition-all group ${
          isEditingProtocols 
            ? 'border-black cursor-pointer hover:bg-stone-50' 
            : 'border-stone-200 cursor-default bg-stone-50'
        }`}
      >
        <div className="flex items-start gap-3">
          <Icon size={16} className={`mt-0.5 ${isDestructive ? 'text-red-400' : 'text-stone-400'}`} />
          <div>
            <div className={`font-bold text-xs group-hover:text-stone-700 transition-colors ${isDestructive && isEnabled ? 'text-red-600' : ''}`}>
              {item.label}
            </div>
            <div className="text-[9px] text-stone-500 font-mono mt-0.5">
              {item.desc}
            </div>
          </div>
        </div>
        {/* Toggle Switch */}
        <div
          className={`w-10 h-5 border rounded-full relative transition-colors ${
            isEnabled
              ? isDestructive ? 'bg-red-500 border-red-600' : 'bg-black border-black'
              : 'bg-stone-200 border-stone-300'
          }`}
        >
          <div
            className={`absolute top-0.5 bottom-0.5 w-4 rounded-full bg-white transition-transform ${
              isEnabled
                ? 'translate-x-5'
                : 'translate-x-0.5'
            }`}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-black p-6 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-shadow duration-300">
      {/* Header with Edit/Save */}
      <div className="flex items-center justify-between mb-6 border-b border-black pb-2">
        <div className="flex items-center gap-2">
          <Shield size={16} />
          <h3 className="font-serif text-lg">System Protocols</h3>
        </div>
        
        {!isEditingProtocols ? (
          <button
            onClick={onEdit}
            className="p-2 hover:bg-stone-100 rounded-full border border-transparent hover:border-black transition-all"
          >
            <Edit2 size={16} />
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="p-2 hover:bg-stone-100 rounded-full border border-transparent hover:border-black transition-all"
            >
              <X size={16} />
            </button>
            <button
              onClick={onSave}
              className="p-2 hover:bg-stone-100 rounded-full border border-transparent hover:border-black transition-all"
            >
              <Save size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Quiet Hours Clock */}
        <div className={`bg-stone-50 p-4 border border-stone-200 rounded-lg transition-all ${isEditingProtocols ? 'border-black bg-white' : ''}`}>
          <div className="flex items-center gap-2 mb-4">
            <Bell size={14} />
            <span className="font-mono text-[10px] uppercase font-bold">Quiet Hours</span>
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
          <div className="text-center font-mono text-[9px] text-stone-500 mt-2">
            No notifications during these hours
          </div>
        </div>

        {/* Proactive Preferences */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Brain size={14} />
            <span className="font-mono text-[10px] uppercase font-bold text-stone-600">Proactive Features</span>
          </div>
          <div className="space-y-3">
            {proactiveSettings.map((item) => (
              <ToggleRow key={item.key} item={item} />
            ))}
          </div>
        </div>

        {/* Agent Permissions */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} />
            <span className="font-mono text-[10px] uppercase font-bold text-stone-600">Agent Permissions</span>
          </div>
          <div className="space-y-3">
            {/* Non-destructive permissions first */}
            {agentPermissions.filter(p => !p.key.includes('Delete')).map((item) => (
              <ToggleRow key={item.key} item={item} />
            ))}
          </div>
          
          {/* Destructive permissions with warning */}
          <div className="mt-4 pt-4 border-t border-stone-200">
            <div className="flex items-center gap-2 mb-3">
              <Trash2 size={12} className="text-red-400" />
              <span className="font-mono text-[9px] uppercase text-red-500">Destructive Actions</span>
            </div>
            <div className="space-y-3">
              {agentPermissions.filter(p => p.key.includes('Delete')).map((item) => (
                <ToggleRow key={item.key} item={item} isDestructive />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};