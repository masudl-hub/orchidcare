import { useState } from 'react';
import { Radio, CheckCircle, XCircle, AlertTriangle, Clock, Filter } from 'lucide-react';
import { useOutboundAudit } from '@/hooks/useAudit';
import { useInView, revealStyle } from './DashboardShell';

const mono = "ui-monospace, monospace";

type AuditFilter = 'all' | 'proactive' | 'telegram_reply' | 'failed';

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  delivered: CheckCircle,
  failed: XCircle,
  skipped: AlertTriangle,
  attempted: Clock,
};

const STATUS_COLORS: Record<string, string> = {
  delivered: 'rgba(34,197,94,0.6)',
  failed: 'rgba(239,68,68,0.6)',
  skipped: 'rgba(234,179,8,0.5)',
  attempted: 'rgba(255,255,255,0.3)',
};

export function NotificationActivity() {
  const [filter, setFilter] = useState<AuditFilter>('all');
  const { data: auditEntries = [], isLoading } = useOutboundAudit(100);
  const { ref, visible } = useInView(0.1);

  const filtered = auditEntries.filter((entry: any) => {
    if (filter === 'all') return true;
    if (filter === 'failed') return entry.delivery_status === 'failed' || entry.delivery_status === 'skipped';
    return entry.source_mode === filter;
  });

  const filters: { id: AuditFilter; label: string }[] = [
    { id: 'all', label: 'all' },
    { id: 'proactive', label: 'proactive' },
    { id: 'telegram_reply', label: 'replies' },
    { id: 'failed', label: 'failed' },
  ];

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} style={revealStyle(visible, 0)}>
      <div style={{ border: '1px solid rgba(255,255,255,0.06)', padding: '24px' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
          <div className="flex items-center gap-2">
            <Radio size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
            <span style={{ fontFamily: mono, fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>notification activity</span>
          </div>
          <span style={{ fontFamily: mono, fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>
            {auditEntries.length} entries
          </span>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="cursor-pointer transition-all duration-200"
              style={{
                fontFamily: mono, fontSize: '10px', letterSpacing: '0.08em',
                textTransform: 'uppercase' as const, padding: '4px 10px',
                border: '1px solid',
                borderColor: filter === f.id ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.06)',
                backgroundColor: filter === f.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                color: filter === f.id ? 'white' : 'rgba(255,255,255,0.3)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Entries */}
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
          {isLoading ? (
            <div style={{ fontFamily: mono, fontSize: '12px', color: 'rgba(255,255,255,0.25)', padding: '16px 0', textAlign: 'center' }}>
              loading audit trail...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ fontFamily: mono, fontSize: '12px', color: 'rgba(255,255,255,0.2)', padding: '16px 0', textAlign: 'center' }}>
              no entries found
            </div>
          ) : (
            filtered.map((entry: any) => {
              const StatusIcon = STATUS_ICONS[entry.delivery_status] || Clock;
              const statusColor = STATUS_COLORS[entry.delivery_status] || 'rgba(255,255,255,0.3)';

              return (
                <div
                  key={entry.id}
                  style={{
                    padding: '8px 10px',
                    border: '1px solid rgba(255,255,255,0.04)',
                    backgroundColor: 'rgba(255,255,255,0.01)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <StatusIcon size={12} className="mt-0.5 shrink-0" style={{ color: statusColor }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span style={{ fontFamily: mono, fontSize: '10px', fontWeight: 'bold', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {entry.source_mode}
                          </span>
                          <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>
                            via {entry.source_function}
                          </span>
                        </div>
                        {entry.message_preview && (
                          <div style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.message_preview.substring(0, 120)}
                          </div>
                        )}
                        {entry.error_detail && (
                          <div style={{ fontFamily: mono, fontSize: '10px', color: 'rgba(239,68,68,0.5)', marginTop: '2px' }}>
                            {entry.error_detail.substring(0, 100)}
                          </div>
                        )}
                        {entry.correlation_id && (
                          <div style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.12)', marginTop: '2px' }}>
                            corr: {entry.correlation_id}
                          </div>
                        )}
                      </div>
                    </div>
                    <span style={{ fontFamily: mono, fontSize: '10px', color: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>
                      {formatTime(entry.created_at)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
