import React, { useState } from 'react';
import { 
  ArrowLeft, Leaf, Droplets, Calendar, Clock, 
  AlertTriangle, CheckCircle2, Camera, MapPin, 
  FileText, Pill, Microscope, Edit2
} from 'lucide-react';
import { Plant, CareEvent, Reminder } from '@/hooks/usePlants';
import { Tables } from '@/integrations/supabase/types';

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

// Event type icons and colors
const eventConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  watered: { icon: <Droplets size={14} />, label: 'Watered', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  fertilized: { icon: <Pill size={14} />, label: 'Fertilized', color: 'bg-green-100 text-green-700 border-green-200' },
  repotted: { icon: <Leaf size={14} />, label: 'Repotted', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  pruned: { icon: <Leaf size={14} />, label: 'Pruned', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  rotated: { icon: <Leaf size={14} />, label: 'Rotated', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  treated: { icon: <Pill size={14} />, label: 'Treated', color: 'bg-red-100 text-red-700 border-red-200' },
};

const getEventConfig = (type: string) => eventConfig[type] || { 
  icon: <FileText size={14} />, 
  label: type.charAt(0).toUpperCase() + type.slice(1), 
  color: 'bg-stone-100 text-stone-700 border-stone-200' 
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
};

const formatRelativeDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
  return formatDate(dateStr);
};

const severityColors: Record<string, string> = {
  low: 'text-green-600',
  moderate: 'text-amber-600',
  high: 'text-orange-600',
  severe: 'text-red-600',
};

// Etched plant illustration
const EtchedLeaf = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="1">
    <path d="M50,90 Q50,50 20,20 M50,90 Q50,50 80,20 M50,90 L50,10" strokeLinecap="round" />
    <path d="M50,30 L30,40 M50,45 L25,55 M50,60 L30,70" strokeLinecap="round" />
    <path d="M50,30 L70,40 M50,45 L75,55 M50,60 L70,70" strokeLinecap="round" />
  </svg>
);

// Plant photo with loading/error states
const PlantPhoto = ({ src, alt }: { src: string; alt: string }) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <>
        <EtchedLeaf className="w-full h-full p-12 text-stone-300" />
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/90 border-t border-black flex justify-between items-center rounded-b-md">
          <span className="font-mono text-[9px]">LOAD_ERROR</span>
          <Camera size={12} />
        </div>
      </>
    );
  }

  return (
    <>
      {!loaded && (
        <EtchedLeaf className="absolute inset-0 w-full h-full p-12 text-stone-300 animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
        style={{ opacity: loaded ? 1 : 0 }}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
      />
    </>
  );
};

export function PlantDetail({ 
  plant, 
  careEvents, 
  reminders, 
  identifications = [],
  onBack, 
  onEdit,
  isLoading 
}: PlantDetailProps) {
  const latestIdentification = identifications[0];
  const hasHealthConcern = latestIdentification?.diagnosis && latestIdentification?.severity;

  return (
    <main className="flex-1 bg-[#f8f8f8] flex flex-col relative overflow-hidden">
      {/* Background pattern */}
      <div 
        className="absolute inset-0 opacity-40 pointer-events-none" 
        style={{ 
          backgroundImage: 'radial-gradient(circle, #000 0.5px, transparent 0.5px)', 
          backgroundSize: '20px 20px' 
        }} 
      />
      
      {/* Header */}
      <header className="h-16 border-b border-black bg-white/80 backdrop-blur flex items-center justify-between px-6 md:px-12 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="flex items-center gap-2 font-serif italic font-semibold hover:underline"
          >
            <ArrowLeft size={16} /> Back to Collection
          </button>
          <div className="h-6 w-px bg-stone-300" />
          <h1 className="font-mono text-lg md:text-xl tracking-tight uppercase">
            {plant.nickname || plant.name?.split(' ')[0]}
          </h1>
        </div>
        <div className="flex gap-3">
          {onEdit && (
            <button 
              onClick={onEdit}
              className="h-8 px-3 border border-black bg-white rounded-full text-xs font-mono uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-2"
            >
              <Edit2 size={12} /> Edit
            </button>
          )}
          <button className="h-8 px-3 border border-black bg-black rounded-full text-white text-xs font-mono uppercase hover:bg-stone-800 transition-colors flex items-center gap-2">
            <Microscope size={12} /> Analyze
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-12">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* Left Column - Photo */}
          <div className="md:col-span-5 space-y-6">
            <div className="border border-black bg-white p-2 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="aspect-[3/4] bg-white relative overflow-hidden border border-stone-200 rounded-md flex items-center justify-center">
                {plant.photo_url ? (
                  <PlantPhoto src={plant.photo_url} alt={plant.nickname || plant.name || 'Plant'} />
                ) : (
                  <>
                    <EtchedLeaf className="w-full h-full p-12 text-stone-300" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/90 border-t border-black flex justify-between items-center rounded-b-md">
                      <span className="font-mono text-[9px]">NO_PHOTO</span>
                      <Camera size={12} />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Quick Info Cards */}
            <div className="grid grid-cols-2 gap-3">
              {plant.location_in_home && (
                <div className="border border-black bg-white p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1 text-stone-500">
                    <MapPin size={12} />
                    <span className="font-mono text-[9px] uppercase">Location</span>
                  </div>
                  <span className="text-sm font-serif">{plant.location_in_home}</span>
                </div>
              )}
              {plant.acquired_date && (
                <div className="border border-black bg-white p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1 text-stone-500">
                    <Calendar size={12} />
                    <span className="font-mono text-[9px] uppercase">Acquired</span>
                  </div>
                  <span className="text-sm font-serif">{formatDate(plant.acquired_date)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="md:col-span-7 space-y-8">
            {/* Plant Info Header */}
            <div className="border-b border-black pb-6">
              <div className="flex justify-between items-start mb-2">
                {plant.species && (
                  <span className="font-mono text-xs text-stone-500 uppercase tracking-widest">
                    {plant.species}
                  </span>
                )}
                {hasHealthConcern && (
                  <span className={`font-mono text-xs px-2 py-1 uppercase rounded-sm border ${
                    latestIdentification.severity === 'severe' ? 'bg-red-100 text-red-700 border-red-200' :
                    latestIdentification.severity === 'high' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                    latestIdentification.severity === 'moderate' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                    'bg-green-100 text-green-700 border-green-200'
                  }`}>
                    <AlertTriangle size={10} className="inline mr-1" />
                    {latestIdentification.severity}
                  </span>
                )}
              </div>
              <h2 className="text-4xl md:text-5xl font-serif leading-none mb-4">
                {plant.nickname || plant.name?.split(' ')[0]} 
                {plant.name?.split(' ')[1] && (
                  <><br/><span className="italic text-stone-500">{plant.name.split(' ').slice(1).join(' ')}</span></>
                )}
              </h2>
              {plant.notes && (
                <p className="font-serif text-sm leading-relaxed max-w-md text-stone-600">
                  {plant.notes}
                </p>
              )}
            </div>

            {/* Health Diagnosis (if present) */}
            {latestIdentification?.diagnosis && (
              <div className="border border-black bg-white p-6 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle size={16} className={severityColors[latestIdentification.severity || 'low']} />
                  <h3 className="font-serif italic text-lg">Health Diagnosis</h3>
                </div>
                {latestIdentification.photo_url && (
                  <div className="mb-3">
                    <img
                      src={latestIdentification.photo_url}
                      alt="Analyzed photo"
                      className="w-20 h-20 object-cover rounded-md border border-stone-200"
                    />
                  </div>
                )}
                <p className="font-serif text-sm mb-3">{latestIdentification.diagnosis}</p>
                {latestIdentification.treatment && (
                  <div className="bg-stone-50 border border-stone-200 rounded-md p-3">
                    <span className="font-mono text-[9px] text-stone-500 uppercase block mb-1">Recommended Treatment</span>
                    <p className="font-serif text-sm">{latestIdentification.treatment}</p>
                  </div>
                )}
              </div>
            )}

            {/* Upcoming Reminders */}
            {reminders.length > 0 && (
              <div className="border border-black bg-white p-6 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-serif italic text-lg">Upcoming Care</h3>
                  <span className="font-mono text-[9px] text-stone-500">{reminders.length} ACTIVE</span>
                </div>
                <div className="space-y-3">
                  {reminders.map((reminder) => {
                    const eventCfg = getEventConfig(reminder.reminder_type);
                    return (
                      <div 
                        key={reminder.id} 
                        className="flex items-center justify-between p-3 border border-stone-200 rounded-md hover:border-black transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full border ${eventCfg.color}`}>
                            {eventCfg.icon}
                          </div>
                          <div>
                            <span className="font-serif text-sm">{eventCfg.label}</span>
                            {reminder.notes && (
                              <span className="text-xs text-stone-500 block">{reminder.notes}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-xs">{formatRelativeDate(reminder.next_due)}</span>
                          {reminder.frequency_days && (
                            <span className="block font-mono text-[9px] text-stone-400">
                              Every {reminder.frequency_days}d
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Care History Timeline */}
            <div className="border border-black bg-white p-6 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-serif italic text-lg">Care History</h3>
                <span className="font-mono text-[9px] text-stone-500">{careEvents.length} EVENTS</span>
              </div>
              {careEvents.length === 0 ? (
                <div className="text-center py-8">
                  <Leaf className="mx-auto h-8 w-8 text-stone-300 mb-2" />
                  <p className="font-serif text-sm text-stone-500">No care events recorded yet.</p>
                  <p className="font-mono text-[9px] text-stone-400 mt-1">
                    Text WATERED, FERTILIZED, etc. to log care
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[19px] top-0 bottom-0 w-px bg-stone-200" />
                  
                  <div className="space-y-4">
                    {careEvents.map((event, idx) => {
                      const eventCfg = getEventConfig(event.event_type);
                      return (
                        <div key={event.id} className="flex gap-4 relative">
                          <div className={`w-10 h-10 rounded-full border flex items-center justify-center ${eventCfg.color} z-10 bg-white`}>
                            {eventCfg.icon}
                          </div>
                          <div className="flex-1 pt-1">
                            <div className="flex justify-between items-start">
                              <span className="font-serif text-sm font-medium">{eventCfg.label}</span>
                              <span className="font-mono text-[10px] text-stone-500">
                                {formatDate(event.created_at)}
                              </span>
                            </div>
                            {event.notes && (
                              <p className="text-sm text-stone-600 mt-1">{event.notes}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Care Tips (from identification) */}
            {latestIdentification?.care_tips && (
              <div className="border border-black bg-stone-50 p-6 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 size={16} className="text-green-600" />
                  <h3 className="font-serif italic text-lg">Care Tips</h3>
                </div>
                <p className="font-serif text-sm text-stone-700">{latestIdentification.care_tips}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
