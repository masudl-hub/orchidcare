import React from 'react';
import {
  ArrowLeft, Droplets, Calendar, AlertTriangle, CheckCircle2, Camera, MapPin,
  FileText, Pill, Microscope, Edit2
} from 'lucide-react';
import { Plant, CareEvent, Reminder } from '@/hooks/usePlants';
import { Tables } from '@/integrations/supabase/types';
import { revealStyle } from '../dashboard/DashboardShell';

const mono = "ui-monospace, monospace";
const pressStart = '"Press Start 2P", cursive';

export type PlantIdentification = Tables<'plant_identifications'>;

interface PlantDetailProps {
  plant: Plant;
  careEvents: CareEvent[];
  reminders: Reminder[];
  identifications?: PlantIdentification[];
  onBack: () => void;
  onEdit?: () => void;
  isLoading?: boolean;
}

// 1-bit Pixel Leaf
const PixelLeaf = ({ size = 16, className = '', style = {} }: { size?: number, className?: string, style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} style={{ shapeRendering: 'crispEdges', ...style }}>
    <path d="M8 1h2v1h1v1h1v1h1v2h1v4h-1v1h-1v1h-1v1h-1v1h-1v1H8v-2H7v-1H6v-1H5v-1H4V9H3V5h1V4h1V3h1V2h1V1h1zm1 2H8v1H7v1H6v1H5v3h1v1h1v1h1v1h1v-1h1V9h1V6h-1V5h-1V4h-1V3z" />
    <rect x="7" y="5" width="2" height="6" />
    <rect x="9" y="6" width="1" height="2" />
  </svg>
);

const eventConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  watered: { icon: <Droplets size={12} />, label: 'Watered', color: 'rgba(59,130,246,0.3)' },
  fertilized: { icon: <Pill size={12} />, label: 'Fertilized', color: 'rgba(34,197,94,0.3)' },
  repotted: { icon: <PixelLeaf size={12} />, label: 'Repotted', color: 'rgba(245,158,11,0.3)' },
  pruned: { icon: <PixelLeaf size={12} />, label: 'Pruned', color: 'rgba(249,115,22,0.3)' },
  rotated: { icon: <PixelLeaf size={12} />, label: 'Rotated', color: 'rgba(168,85,247,0.3)' },
  treated: { icon: <Pill size={12} />, label: 'Treated', color: 'rgba(239,68,68,0.3)' },
};

const getEventConfig = (type: string) => eventConfig[type] || {
  icon: <FileText size={12} />,
  label: type.charAt(0).toUpperCase() + type.slice(1),
  color: 'rgba(255,255,255,0.2)'
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatRelativeDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
  return formatDate(dateStr);
};

export function PlantDetail({
  plant, careEvents, reminders, identifications = [], onBack, onEdit, isLoading
}: PlantDetailProps) {
  const latestId = identifications[0];
  const hasHealthConcern = latestId?.diagnosis && latestId?.severity;

  // Extract all photos associated with this plant (from the plant profile, care events, and identifications)
  const allSnapshots = React.useMemo(() => {
    const snaps: { id: string; url: string; date: string; label: string }[] = [];
    if (plant.photo_url) {
      snaps.push({ id: 'primary', url: plant.photo_url, date: plant.created_at || new Date().toISOString(), label: 'Profile' });
    }
    identifications.forEach(id => {
      if (id.photo_url) {
        snaps.push({ id: id.id, url: id.photo_url, date: id.created_at || new Date().toISOString(), label: 'Analysis' });
      }
    });
    careEvents.forEach(evt => {
      if (evt.photo_url) {
        snaps.push({ id: evt.id, url: evt.photo_url, date: evt.created_at || new Date().toISOString(), label: evt.event_type });
      }
    });
    // Sort newest first
    return snaps.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [plant, identifications, careEvents]);

  const cardStyle = { border: '1px solid rgba(255,255,255,0.06)', padding: '24px' };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={onBack} className="flex items-center gap-2 cursor-pointer transition-colors" style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.5)' }} onMouseEnter={(e) => e.currentTarget.style.color = 'white'} onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}>
          <ArrowLeft size={14} /> back
        </button>
        <div className="flex gap-3">
          {onEdit && (
            <button onClick={onEdit} className="cursor-pointer transition-colors flex items-center gap-2" style={{ fontFamily: mono, fontSize: '10px', textTransform: 'uppercase', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
              <Edit2 size={12} /> edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">

        {/* Left Column - Photo & Quick Info */}
        <div className="md:col-span-5 space-y-6">
          <div style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '8px' }}>
            <div className="aspect-[3/4] relative overflow-hidden border border-[rgba(255,255,255,0.05)] flex items-center justify-center bg-[rgba(255,255,255,0.02)]">
              {plant.photo_url ? (
                <>
                  <img src={plant.photo_url} alt="Plant" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20" />
                </>
              ) : (
                <div className="flex flex-col items-center opacity-30">
                  <PixelLeaf size={32} />
                  <span style={{ fontFamily: mono, fontSize: '9px', marginTop: '12px', letterSpacing: '0.1em' }}>NO_PHOTO</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {plant.location_in_home && (
              <div style={{ border: '1px solid rgba(255,255,255,0.06)', padding: '12px' }}>
                <div className="flex items-center gap-2 mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <MapPin size={10} />
                  <span style={{ fontFamily: mono, fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>location</span>
                </div>
                <div style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>{plant.location_in_home}</div>
              </div>
            )}
            {plant.acquired_date && (
              <div style={{ border: '1px solid rgba(255,255,255,0.06)', padding: '12px' }}>
                <div className="flex items-center gap-2 mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <Calendar size={10} />
                  <span style={{ fontFamily: mono, fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>acquired</span>
                </div>
                <div style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>{formatDate(plant.acquired_date)}</div>
              </div>
            )}
            <div style={{ border: '1px solid rgba(255,255,255,0.06)', padding: '12px', gridColumn: plant.location_in_home && plant.acquired_date ? 'span 2' : 'span 1' }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                <FileText size={10} />
                <span style={{ fontFamily: mono, fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>added to db</span>
              </div>
              <div style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>{formatDate(plant.created_at)}</div>
            </div>
          </div>
        </div>

        {/* Right Column - Details */}
        <div className="md:col-span-7 space-y-8">

          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '24px' }}>
            <div className="flex justify-between items-start mb-4">
              <span style={{ fontFamily: mono, fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {plant.species || 'unknown species'}
              </span>
              {hasHealthConcern && (
                <span className="flex items-center gap-1" style={{ fontFamily: mono, fontSize: '9px', textTransform: 'uppercase', padding: '4px 8px', border: '1px solid rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                  <AlertTriangle size={10} /> {latestId.severity}
                </span>
              )}
            </div>
            <h2 style={{ fontFamily: pressStart, fontSize: 'clamp(18px, 4vw, 24px)', lineHeight: 1.4, marginBottom: '16px' }}>
              {plant.nickname || plant.name}
            </h2>
            {plant.notes && (
              <p style={{ fontFamily: mono, fontSize: '12px', lineHeight: 1.6, color: 'rgba(255,255,255,0.6)' }}>
                {plant.notes}
              </p>
            )}
          </div>

          {/* Reminders */}
          {reminders.length > 0 && (
            <div style={cardStyle}>
              <div className="flex justify-between items-center mb-6">
                <h3 style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>upcoming care</h3>
                <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>{reminders.length} ACTIVE</span>
              </div>
              <div className="flex flex-col gap-3">
                {reminders.map(r => {
                  const cfg = getEventConfig(r.reminder_type);
                  return (
                    <div key={r.id} className="flex justify-between items-center" style={{ border: '1px solid rgba(255,255,255,0.06)', padding: '12px' }}>
                      <div className="flex items-center gap-4">
                        <div style={{ color: cfg.color }}>{cfg.icon}</div>
                        <div>
                          <div style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>{cfg.label}</div>
                          {r.notes && <div style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{r.notes}</div>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div style={{ fontFamily: mono, fontSize: '11px', color: 'white' }}>{formatRelativeDate(r.next_due)}</div>
                        {r.frequency_days && <div style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>every {r.frequency_days}d</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* History */}
          <div style={cardStyle}>
            <div className="flex justify-between items-center mb-6">
              <h3 style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>care history</h3>
              <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>{careEvents.length} EVENTS</span>
            </div>

            {careEvents.length === 0 ? (
              <div className="text-center py-8">
                <PixelLeaf size={24} style={{ margin: '0 auto', color: 'rgba(255,255,255,0.1)' }} />
                <div style={{ fontFamily: mono, fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '12px' }}>no care events recorded yet.</div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 relative" style={{ paddingLeft: '24px' }}>
                <div className="absolute top-0 bottom-0 left-[7px] w-px bg-[rgba(255,255,255,0.1)]" />
                {careEvents.map(evt => {
                  const cfg = getEventConfig(evt.event_type);
                  return (
                    <div key={evt.id} className="relative">
                      <div className="absolute -left-[24px] top-[2px] w-[15px] h-[15px] rounded-full flex items-center justify-center bg-black border border-[rgba(255,255,255,0.2)]">
                        <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: cfg.color }} />
                      </div>
                      <div className="flex justify-between items-start">
                        <div style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>{cfg.label}</div>
                        <div style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{formatDate(evt.created_at)}</div>
                      </div>
                      {evt.notes && <div style={{ fontFamily: mono, fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '6px', lineHeight: 1.5 }}>{evt.notes}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tips */}
          {latestId?.care_tips && (
            <div style={{ border: '1px solid rgba(74,222,128,0.2)', backgroundColor: 'rgba(74,222,128,0.05)', padding: '24px' }}>
              <div className="flex items-center gap-2 mb-4" style={{ color: '#4ade80' }}>
                <CheckCircle2 size={14} />
                <span style={{ fontFamily: mono, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>care tips</span>
              </div>
              <p style={{ fontFamily: mono, fontSize: '11px', lineHeight: 1.6, color: 'rgba(255,255,255,0.7)' }}>{latestId.care_tips}</p>
            </div>
          )}

          {/* Snapshots Grid */}
          {allSnapshots.length > 0 && (
            <div style={cardStyle}>
              <div className="flex justify-between items-center mb-6">
                <h3 style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>snapshots</h3>
                <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>{allSnapshots.length} PHOTOS</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {allSnapshots.map(snap => (
                  <div key={snap.id} className="relative aspect-square border border-[rgba(255,255,255,0.1)] group overflow-hidden">
                    <img src={snap.url} alt={snap.label} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                      <div style={{ fontFamily: mono, fontSize: '9px', color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{snap.label}</div>
                      <div style={{ fontFamily: mono, fontSize: '8px', color: 'rgba(255,255,255,0.5)' }}>{formatDate(snap.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
