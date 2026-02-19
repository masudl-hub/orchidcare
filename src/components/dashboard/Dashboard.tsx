import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, Cell } from 'recharts';
import { 
  Wind, Sun, Droplets, ArrowUpRight, Leaf, Search, Menu, X, 
  Share2, Bookmark, MoreHorizontal, Camera, Radio, MapPin, 
  Layout, FileText, Database, Settings, Activity, Microscope,
  AlertTriangle, Zap, Thermometer, Gauge, CheckCircle2,
  User, Shield, Smartphone, Bell, Edit2, Save, Plus, Trash2, Calendar, Calendar as CalendarIcon, Clock, ChevronRight, ChevronDown,
  MessageSquare, Send, Command,
  Dog, Cat, Bird, Rabbit, Lightbulb, Terminal, Filter, LogOut, Key, CreditCard, Download, Phone, ArrowLeft,
  Smile, Coffee, Brain, Fish, Loader2
} from 'lucide-react';
import { SystemProtocols } from './SystemProtocols';
import { useAuth } from '@/contexts/AuthContext';
import { usePlants, usePlant, useCareEvents, usePlantReminders, usePlantIdentifications } from '@/hooks/usePlants';
import { useActivityFeed } from '@/hooks/useActivity';
import { PlantDetail } from '@/components/plants/PlantDetail';
import { useSystemSettings, useUpdateQuietHours, useTogglePreference, useToggleAgentPermission, useInitializeSettings } from '@/hooks/useSettings';
import { useUserInsights, useDeleteInsight } from '@/hooks/useInsights';

// --- Assets & Patterns ---

const EtchingPattern = () => (
  <svg className="absolute w-0 h-0">
    <defs>
      <pattern id="halftone" width="4" height="4" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1" fill="currentColor" className="text-stone-300" />
      </pattern>
      <pattern id="diagonal-thin" width="6" height="6" patternUnits="userSpaceOnUse">
        <path d="M-1,1 l2,-2 M0,6 l6,-6 M5,7 l2,-2" stroke="currentColor" strokeWidth="0.5" className="text-stone-400" />
      </pattern>
      <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-stone-200" />
      </pattern>
    </defs>
  </svg>
);

// Custom SVG Plant Illustration (Etching Style)
const EtchedLeaf = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="1">
    <path d="M50,90 Q50,50 20,20 M50,90 Q50,50 80,20 M50,90 L50,10" strokeLinecap="round" />
    <path d="M50,30 L30,40 M50,45 L25,55 M50,60 L30,70" strokeLinecap="round" />
    <path d="M50,30 L70,40 M50,45 L75,55 M50,60 L70,70" strokeLinecap="round" />
  </svg>
);

const MicroChart = ({ data }: { data: Array<{ val: number }> }) => (
  <div className="h-8 w-16">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <Area type="step" dataKey="val" stroke="#000" strokeWidth={1} fill="none" />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

const DetailChart = () => {
  const data = [
    { x: '00', y: 30 }, { x: '04', y: 45 }, { x: '08', y: 65 },
    { x: '12', y: 85 }, { x: '16', y: 60 }, { x: '20', y: 50 }, { x: '24', y: 40 },
  ];

  return (
    <div className="h-48 w-full relative border-y border-black bg-stone-50 mt-6 rounded-md overflow-hidden transition-shadow hover:shadow-md">
      <div className="absolute top-2 left-2 z-10 font-mono text-[9px] bg-white px-1 border border-black rounded-sm">FIG 2.4 - PHOTOSYNTHESIS</div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
          <defs>
             <linearGradient id="gradientBlack" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#000" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#000" stopOpacity={0}/>
             </linearGradient>
          </defs>
          <XAxis dataKey="x" tick={{fontSize: 10, fontFamily: 'monospace'}} axisLine={false} tickLine={false} dy={10} />
          <Tooltip contentStyle={{ fontFamily: 'serif', border: '1px solid black', borderRadius: '4px' }} />
          <Area type="monotone" dataKey="y" stroke="#000" strokeWidth={1.5} fill="url(#gradientBlack)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// --- INTERACTIVE WIDGETS ---

const RotaryClock = () => {
  const [rotation, setRotation] = useState(220); // Represents time, roughly 10pm
  
  // Simple interaction handler
  const handleTurn = () => {
    setRotation(prev => (prev + 45) % 360);
  };

  return (
    <div className="relative w-32 h-32 flex items-center justify-center cursor-pointer select-none group" onClick={handleTurn}>
      {/* Dial Marks */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full text-stone-300 transition-colors group-hover:text-stone-400">
        {[...Array(12)].map((_, i) => (
          <line 
            key={i} 
            x1="50" y1="10" x2="50" y2="15" 
            stroke="currentColor" 
            strokeWidth="1" 
            transform={`rotate(${i * 30} 50 50)`} 
          />
        ))}
      </svg>
      
      {/* Knob Body */}
      <div className="w-20 h-20 rounded-full border border-black bg-white shadow-sm flex items-center justify-center relative transition-transform duration-500 ease-out group-hover:scale-105 group-active:scale-95" style={{ transform: `rotate(${rotation}deg)` }}>
        <div className="absolute top-2 w-1 h-3 bg-red-500 rounded-full" />
        <div className="font-mono text-[10px] transform -rotate-180">QUIET</div>
      </div>

      {/* Label */}
      <div className="absolute -bottom-6 font-mono text-[9px] text-stone-500 uppercase group-hover:text-black transition-colors">
        Tap to Rotate
      </div>
    </div>
  );
};

const CalendarWidget = () => (
  <div className="grid grid-cols-7 gap-px bg-stone-200 border border-stone-200 rounded-lg overflow-hidden">
    {['S','M','T','W','T','F','S'].map((d, i) => (
      <div key={i} className="bg-stone-50 p-1 text-center font-mono text-[9px] text-stone-400">{d}</div>
    ))}
    {[...Array(28)].map((_, i) => (
      <div key={i} className={`bg-white h-8 hover:bg-black hover:text-white cursor-pointer transition-colors flex items-center justify-center font-mono text-[10px] ${i === 14 ? 'bg-black text-white rounded-sm' : 'text-stone-600'}`}>
        {i + 1}
      </div>
    ))}
  </div>
);

// Draggable Quiet Hours Clock
const QuietHoursClock = ({ 
  startHour, 
  endHour, 
  onStartChange, 
  onEndChange, 
  disabled 
}: { 
  startHour: number; 
  endHour: number; 
  onStartChange: (hour: number) => void; 
  onEndChange: (hour: number) => void;
  disabled?: boolean;
}) => {
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const clockRef = useRef<HTMLDivElement>(null);

  // Convert 24-hour to 12-hour clock angle (30 degrees per hour, -90 to start at 12)
  const hourToAngle = (hour: number) => {
    const hour12 = hour % 12;
    return (hour12 * 30) - 90;
  };
  
  // Convert angle back to 24-hour format
  const angleToHour = (angle: number, currentHour: number) => {
    const normalized = ((angle + 90) % 360 + 360) % 360;
    const hour12 = Math.round(normalized / 30) % 12;
    // Preserve AM/PM from the current hour
    const isPM = currentHour >= 12;
    if (isPM) {
      return hour12 === 0 ? 12 : hour12 + 12;
    } else {
      return hour12 === 0 ? 0 : hour12;
    }
  };

  const handleMouseDown = (e: React.MouseEvent, isStart: boolean) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    if (isStart) {
      setIsDraggingStart(true);
    } else {
      setIsDraggingEnd(true);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!clockRef.current || (!isDraggingStart && !isDraggingEnd)) return;
    
    const rect = clockRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    
    if (isDraggingStart) {
      const hour = angleToHour(angle, startHour);
      onStartChange(hour);
    } else if (isDraggingEnd) {
      const hour = angleToHour(angle, endHour);
      onEndChange(hour);
    }
  };

  const handleMouseUp = () => {
    setIsDraggingStart(false);
    setIsDraggingEnd(false);
  };

  useEffect(() => {
    if (isDraggingStart || isDraggingEnd) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingStart, isDraggingEnd, startHour, endHour]);

  // Calculate the arc for quiet hours
  const getArcPath = () => {
    const radius = 45;
    const centerX = 50;
    const centerY = 50;
    
    const startAngle = hourToAngle(startHour);
    const endAngle = hourToAngle(endHour);
    
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);
    
    // Calculate the hour difference
    let diff = endHour - startHour;
    if (diff < 0) diff += 24;
    
    // Use large arc if the quiet hours span more than 12 hours
    const largeArc = diff > 12 ? 1 : 0;
    
    return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  };

  // Format hour to 12-hour with AM/PM
  const formatHour = (hour: number) => {
    const hour12 = hour % 12 || 12;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${hour12}:00 ${ampm}`;
  };

  return (
    <div className="flex flex-col items-center">
      <div 
        ref={clockRef}
        className="relative w-40 h-40 select-none"
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
          {/* Clock circle */}
          <circle cx="50" cy="50" r="48" fill="white" stroke="black" strokeWidth="1.5" />
          
          {/* Hour markers for 12-hour clock */}
          {[...Array(12)].map((_, i) => {
            const angle = (i * 30) - 90;
            const rad = (angle * Math.PI) / 180;
            const isMainHour = i % 3 === 0;
            const r1 = isMainHour ? 38 : 42;
            const r2 = 45;
            return (
              <line
                key={i}
                x1={50 + r1 * Math.cos(rad)}
                y1={50 + r1 * Math.sin(rad)}
                x2={50 + r2 * Math.cos(rad)}
                y2={50 + r2 * Math.sin(rad)}
                stroke={isMainHour ? "black" : "#d4d4d4"}
                strokeWidth={isMainHour ? "1.5" : "0.5"}
              />
            );
          })}
          
          {/* Hour labels for 12, 3, 6, 9 */}
          {[12, 3, 6, 9].map((hour) => {
            const hourIndex = hour === 12 ? 0 : hour;
            const angle = (hourIndex * 30) - 90;
            const rad = (angle * Math.PI) / 180;
            const r = 32;
            return (
              <text
                key={hour}
                x={50 + r * Math.cos(rad)}
                y={50 + r * Math.sin(rad)}
                textAnchor="middle"
                dominantBaseline="middle"
                className="font-mono text-[7px] fill-black font-bold"
              >
                {hour}
              </text>
            );
          })}
          
          {/* Quiet hours arc (black fill) */}
          <path
            d={getArcPath()}
            fill="black"
            opacity="0.9"
          />
          
          {/* Start hour hand */}
          <g
            transform={`rotate(${hourToAngle(startHour)} 50 50)`}
            style={{ cursor: disabled ? 'default' : 'grab' }}
            onMouseDown={(e) => handleMouseDown(e, true)}
            className={isDraggingStart ? 'cursor-grabbing' : ''}
          >
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="10"
              stroke="black"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="50" cy="50" r="4" fill="black" />
            <circle cx="50" cy="10" r="3" fill="black" />
          </g>
          
          {/* End hour hand */}
          <g
            transform={`rotate(${hourToAngle(endHour)} 50 50)`}
            style={{ cursor: disabled ? 'default' : 'grab' }}
            onMouseDown={(e) => handleMouseDown(e, false)}
            className={isDraggingEnd ? 'cursor-grabbing' : ''}
          >
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="10"
              stroke="black"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="50" cy="50" r="4" fill="black" />
            <circle cx="50" cy="10" r="3" fill="black" />
          </g>
        </svg>
      </div>
      
      {/* Time display */}
      <div className="mt-3 font-mono text-xs text-center text-black">
        {formatHour(startHour)} — {formatHour(endHour)}
      </div>
      {!disabled && (
        <div className="font-mono text-[9px] text-stone-400 mt-1">
          Drag hands to adjust
        </div>
      )}
    </div>
  );
};

// --- AGENT CHAT COMPONENT (FLOATING BAR) ---

const CommandAgent = () => {
  const [messages, setMessages] = useState([
    { id: 1, type: 'system', text: 'Agent active. Waiting for input...' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isExpanded) {
        scrollToBottom();
    }
  }, [messages, isExpanded]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    // Auto-expand on first interaction
    if (!isExpanded) setIsExpanded(true);

    // Add user message
    const userMsg = { id: Date.now(), type: 'user', text: inputValue };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    // Simulate system response
    setTimeout(() => {
      let responseText = "Command not recognized. Please verify syntax.";
      const lowerInput = userMsg.text.toLowerCase();
      
      if (lowerInput.includes('change name') || lowerInput.includes('update profile')) {
        responseText = "Request to update USER_PROFILE initiated. Confirm changes?";
      } else if (lowerInput.includes('email') || lowerInput.includes('contact')) {
        responseText = "Updating contact registry. Confirmation required.";
      } else if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
        responseText = "Greetings, Administrator. How may I assist with the facility today?";
      } else if (lowerInput.includes('close') || lowerInput.includes('minimize')) {
         setIsExpanded(false);
         return;
      }

      setMessages(prev => [...prev, { id: Date.now() + 1, type: 'system', text: responseText }]);
    }, 600);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white text-black border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col transition-all duration-300 ease-in-out ${isExpanded ? 'w-[90%] max-w-2xl h-96 rounded-lg' : 'w-[55%] max-w-md h-14 rounded-full'} overflow-hidden`}>
      
      {/* Header & Chat History (Hidden when collapsed) */}
      {isExpanded && (
        <>
            <div className="flex items-center justify-between px-3 py-2 border-b border-black bg-stone-50">
                <div className="flex items-center gap-2">
                    <Command size={14} />
                    <span className="font-mono text-xs uppercase tracking-widest text-stone-500">Command_Agent</span>
                </div>
                <button onClick={() => setIsExpanded(false)} className="hover:bg-stone-200 p-1 rounded-sm transition-colors">
                    <ChevronDown size={14} />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 p-4 font-mono text-xs bg-white">
                {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-2 rounded-lg border ${msg.type === 'user' ? 'bg-black text-white border-black shadow-md' : 'bg-stone-50 text-black border-stone-200'}`}>
                        {msg.type === 'system' && <span className="mr-2 font-bold opacity-50">&gt;</span>}
                        {msg.text}
                    </div>
                </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
        </>
      )}

      {/* Input Area */}
      <div className={`flex items-center gap-2 px-3 ${isExpanded ? 'py-3 border-t border-black bg-white' : 'h-full'}`}>
        <span className="text-black font-mono font-bold text-sm">{isExpanded ? '$' : '>'}</span>
        <input 
          type="text" 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          className="bg-transparent border-none outline-none flex-1 font-mono text-sm text-black placeholder-stone-400"
          placeholder={isExpanded ? "Enter command..." : "Type command to initialize agent..."}
        />
        <button onClick={handleSend} className="text-black hover:bg-black hover:text-white p-1.5 rounded-full border border-transparent hover:border-black transition-all">
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};

// --- LOGS COMPONENT ---

const FieldLogs = () => {
  const [filter, setFilter] = useState('ALL');
  const { activities, isLoading } = useActivityFeed();

  // Map activity types to filter categories
  const getActivityCategory = (activity: any) => {
    if (activity.type === 'care') return 'user';
    if (activity.type === 'conversation') {
      return activity.subtype === 'inbound' ? 'user' : 'agent';
    }
    return 'system';
  };

  const filteredLogs = filter === 'ALL' 
    ? activities 
    : activities.filter(a => getActivityCategory(a) === filter.toLowerCase());

  const getIcon = (type: string) => {
    switch(type) {
      case 'user': return <User size={14} />;
      case 'agent': return <Terminal size={14} />;
      case 'alert': return <AlertTriangle size={14} />;
      default: return <Activity size={14} />;
    }
  };

  const getStyle = (activity: any) => {
    const category = getActivityCategory(activity);
    switch(category) {
      case 'user': return 'bg-white border-stone-300';
      case 'agent': return 'bg-black text-white border-black';
      case 'system': return 'bg-stone-50 border-stone-200';
      default: return 'bg-stone-50 border-stone-200';
    }
  };

  return (
    <div className="flex-1 bg-[#f8f8f8] p-6 md:p-12 overflow-y-auto relative h-full">
      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'url(#grid-pattern)' }} />
      
      {/* Header */}
      <div className="relative z-10 mb-8 flex flex-col md:flex-row md:items-end justify-between border-b border-black pb-6 gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-serif text-black">Activity</h1>
          <p className="font-mono text-xs uppercase tracking-widest text-stone-500 mt-2">USER AND AGENT EVENTS</p>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2">
          {['ALL', 'USER', 'AGENT', 'SYSTEM'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-mono border transition-all ${
                filter === f ? 'bg-black text-white border-black' : 'bg-white text-stone-500 border-stone-200 hover:border-black'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative z-10 max-w-3xl mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <Activity size={48} className="mx-auto text-stone-300 mb-4" />
            <p className="font-serif text-stone-500">No activity yet</p>
            <p className="font-mono text-xs text-stone-400 mt-2">Care events and messages will appear here</p>
          </div>
        ) : (
          <>
        <div className="absolute left-6 top-0 bottom-0 w-px bg-stone-300 border-l border-dashed border-stone-300" />
        
        <div className="space-y-8">
          {filteredLogs.map((activity) => (
            <div key={activity.id} className="relative pl-16 group">
              {/* Timeline Node */}
              <div className={`absolute left-4 top-0 w-5 h-5 -translate-x-1/2 rounded-full border flex items-center justify-center z-10 bg-white transition-all group-hover:scale-110 ${
                getActivityCategory(activity) === 'agent' ? 'border-black' : 'border-stone-400'
              }`}>
                <div className={`w-2 h-2 rounded-full ${getActivityCategory(activity) === 'agent' ? 'bg-black' : 'bg-stone-300'}`} />
              </div>

              {/* Card */}
              <div className={`border p-4 rounded-lg shadow-sm transition-all hover:translate-x-1 hover:shadow-md cursor-pointer ${getStyle(activity)}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {getIcon(getActivityCategory(activity))}
                    <span className="font-mono text-[10px] uppercase font-bold tracking-wider">{activity.type}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-mono text-[10px] opacity-60">
                        {new Date(activity.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="font-mono text-[10px] opacity-60">
                        {new Date(activity.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
                <h3 className="font-serif text-lg leading-tight mb-1">{activity.title}</h3>
                <p className="font-serif text-sm opacity-80 leading-relaxed">{activity.description}</p>
                
                {activity.plantName && (
                  <div className="mt-2 inline-flex items-center gap-1 text-xs font-mono text-stone-500">
                    <Leaf size={12} />
                    <span>{activity.plantName}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        </>
        )}
        
        <div className="mt-12 text-center">
           <button className="px-6 py-2 border border-black rounded-full hover:bg-black hover:text-white transition-colors text-xs font-mono uppercase">
             Load Archived Logs
           </button>
        </div>
      </div>
    </div>
  );
};

// --- COLLECTION LIST COMPONENT ---

interface Specimen {
  id: string;
  code: string;
  name: string;
  family: string;
  zone: string;
  status: string;
  trend: Array<{ val: number }>;
  moisture: string;
  light: string;
  co2: string;
  growth: string;
  image: string;
}

const CollectionView = ({ onNavigateToPlant }: { onNavigateToPlant: (id: string) => void }) => {
  const { data: plants, isLoading: loadingPlants } = usePlants();
  
  const reminders = [
    { id: 1, task: 'Nutrient Flush', target: 'Monstera Deliciosa', date: 'Today, 14:00', urgent: true },
    { id: 2, task: 'Prune Dead Leaves', target: 'Ficus Lyrata', date: 'Tomorrow', urgent: false },
    { id: 3, task: 'Sensor Calibration', target: 'System', date: 'Jan 28', urgent: false },
  ];

  return (
    <div className="flex-1 bg-[#f8f8f8] p-6 md:p-12 overflow-y-auto relative h-full">
      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'url(#grid-pattern)' }} />
      
      {/* Header */}
      <div className="relative z-10 mb-8 flex flex-col md:flex-row md:items-end justify-between border-b border-black pb-6 gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-serif text-black">Collection</h1>
          <p className="font-mono text-xs uppercase tracking-widest text-stone-500 mt-2">
            SAVED PLANTS • {loadingPlants ? '...' : plants?.length || 0} Entries
          </p>
        </div>
        <div className="flex gap-2">
           <button className="flex items-center gap-2 px-4 py-2 border border-stone-300 rounded-full hover:border-black text-xs font-mono uppercase bg-white">
              <Filter size={14} /> Filter
           </button>
           <button className="flex items-center gap-2 px-4 py-2 border border-black rounded-full hover:bg-black hover:text-white transition-colors text-xs font-mono uppercase bg-white">
              <Plus size={14} /> New Entry
           </button>
        </div>
      </div>

      <div className="relative z-10 space-y-12">
        {/* Loading State */}
        {loadingPlants && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
          </div>
        )}
        
        {/* Empty State */}
        {!loadingPlants && (!plants || plants.length === 0) && (
          <div className="text-center py-12">
            <Leaf size={48} className="mx-auto text-stone-300 mb-4" />
            <h3 className="font-serif text-2xl text-stone-600 mb-2">No plants yet</h3>
            <p className="font-mono text-xs text-stone-400 mb-6">Start building your collection</p>
            <button className="flex items-center gap-2 px-6 py-3 border-2 border-black rounded-full hover:bg-black hover:text-white transition-colors text-sm font-mono uppercase bg-white mx-auto">
              <Plus size={16} /> Add Your First Plant
            </button>
          </div>
        )}
        
        {/* Collection Grid */}
        {!loadingPlants && plants && plants.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {plants.map((plant) => (
              <div 
                key={plant.id} 
                onClick={() => onNavigateToPlant(plant.id)}
                className="group relative bg-white border border-black p-6 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all cursor-pointer overflow-hidden"
              >
                 {/* Background Image */}
                 {plant.photo_url && (
                   <img 
                      src={plant.photo_url} 
                      alt={plant.name}
                      className="absolute inset-0 w-full h-full object-cover z-0 opacity-10 grayscale group-hover:opacity-30 group-hover:grayscale-0 transition-all duration-700 pointer-events-none"
                   />
                 )}
                 
                 {/* Content Overlay */}
                 <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                            <Leaf size={20} className="text-stone-400 group-hover:text-black transition-colors" />
                            <span className="font-mono text-xs font-bold bg-white/50 px-1 rounded-sm backdrop-blur-sm">
                              {plant.id.slice(0, 8)}
                            </span>
                        </div>
                        <span className="px-2 py-1 rounded-full text-[10px] font-mono border backdrop-blur-md bg-green-50/80 border-green-200 text-green-700">
                          ACTIVE
                        </span>
                    </div>
                    
                    <div className="mb-6">
                        <h3 className="font-serif text-xl leading-tight mb-1">{plant.nickname || plant.name}</h3>
                        <p className="font-mono text-xs text-stone-500">{plant.species || 'Unknown species'}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t border-stone-200/50 pt-4">
                        <div>
                        <p className="font-mono text-[9px] uppercase text-stone-400 mb-1">Location</p>
                        <p className="font-serif text-sm">{plant.location_in_home || '—'}</p>
                        </div>
                        <div>
                        <p className="font-mono text-[9px] uppercase text-stone-400 mb-1">Added</p>
                        <p className="font-serif text-sm">
                          {plant.acquired_date 
                            ? new Date(plant.acquired_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : '—'}
                        </p>
                        </div>
                        <div>
                        <p className="font-mono text-[9px] uppercase text-stone-400 mb-1">Care</p>
                        <p className="font-serif text-sm">{plant.nextReminder ? 'Due' : '—'}</p>
                        </div>
                    </div>
                 </div>
              </div>
           ))}
        </div>
        )}

        {/* Reminders/Tasks */}
        {!loadingPlants && plants && plants.length > 0 && (
        <div>
           <div className="flex items-center gap-3 mb-6 border-b border-black pb-4">
              <Bell size={20} className="text-black" />
              <h2 className="text-2xl font-serif text-black">Scheduled Care</h2>
           </div>
           
           <div className="bg-white border border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
               <div className="divide-y divide-stone-200">
                  {reminders.map((rem) => (
                      <div key={rem.id} className="flex items-center gap-6 p-4 hover:bg-stone-50 transition-colors group cursor-pointer">
                          <div className={`w-8 h-8 rounded-full border border-black flex items-center justify-center flex-shrink-0 ${rem.urgent ? 'bg-red-50 text-red-600' : 'bg-white text-stone-400'}`}>
                              {rem.urgent && <div className="w-3 h-3 bg-red-500 rounded-full" />}
                          </div>
                          
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div>
                                <span className={`font-serif text-lg leading-none ${rem.urgent ? 'font-bold text-red-700' : 'text-black'}`}>{rem.task}</span>
                                <p className="font-mono text-[10px] text-stone-400 mt-1 uppercase tracking-wider">Action Required</p>
                             </div>
                             
                             <div>
                                <span className="font-mono text-xs font-bold">{rem.target}</span>
                                <p className="font-mono text-[10px] text-stone-400 mt-1 uppercase tracking-wider">Target Specimen</p>
                             </div>
                             
                             <div className="flex items-center md:justify-end">
                                <span className="font-mono text-xs bg-stone-100 px-2 py-1 rounded-sm border border-stone-200 group-hover:border-black transition-colors">{rem.date}</span>
                             </div>
                          </div>
                          
                          <ChevronRight size={16} className="text-stone-300 group-hover:text-black transition-colors" />
                      </div>
                  ))}
               </div>
               <div className="bg-stone-50 p-3 text-center border-t border-black">
                  <span className="font-mono text-[10px] text-stone-500 uppercase tracking-widest cursor-pointer hover:text-black hover:underline">View Full Schedule</span>
               </div>
           </div>
        </div>
        )}

      </div>
    </div>
  );
};

// --- TAB COMPONENTS ---

const OverviewView = ({ onNavigateToPlant, onViewAllPlants, allSpecimens }: { onNavigateToPlant: (id: string) => void; onViewAllPlants: () => void; allSpecimens: Specimen[] }) => {
  const { user, profile: authProfile, updateProfile, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  type PersonalityType = 'warm' | 'expert' | 'philosophical' | 'playful';
  type ExperienceLevelType = 'beginner' | 'intermediate' | 'expert';
  
  // Local editing state - initialized from authProfile
  const [editableProfile, setEditableProfile] = useState<{
    display_name: string;
    location: string;
    experience_level: ExperienceLevelType;
    pets: string[];
    personality: PersonalityType;
    primary_concerns: string[];
  }>({
    display_name: authProfile?.display_name || '',
    location: authProfile?.location || '',
    experience_level: (authProfile?.experience_level as ExperienceLevelType) || 'beginner',
    pets: authProfile?.pets || [],
    personality: authProfile?.personality || 'warm',
    primary_concerns: authProfile?.primary_concerns || [],
  });
  
  // Sync local state when authProfile changes
  useEffect(() => {
    if (authProfile) {
      setEditableProfile({
        display_name: authProfile.display_name || '',
        location: authProfile.location || '',
        experience_level: (authProfile.experience_level as ExperienceLevelType) || 'beginner',
        pets: authProfile.pets || [],
        personality: authProfile.personality || 'warm',
        primary_concerns: authProfile.primary_concerns || [],
      });
    }
  }, [authProfile]);

  // Handle save profile
  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveError(null);
    
    const { error } = await updateProfile({
      display_name: editableProfile.display_name || null,
      location: editableProfile.location || null,
      experience_level: editableProfile.experience_level as 'beginner' | 'intermediate' | 'expert',
      pets: editableProfile.pets,
      personality: editableProfile.personality as 'warm' | 'expert' | 'philosophical' | 'playful',
      primary_concerns: editableProfile.primary_concerns,
    });
    
    setIsSaving(false);
    
    if (error) {
      setSaveError(error.message);
    } else {
      setIsEditingProfile(false);
    }
  };
  
  // Handle cancel editing
  const handleCancelEdit = () => {
    // Reset to authProfile values
    if (authProfile) {
      setEditableProfile({
        display_name: authProfile.display_name || '',
        location: authProfile.location || '',
        experience_level: authProfile.experience_level || 'beginner',
        pets: authProfile.pets || [],
        personality: authProfile.personality || 'warm',
        primary_concerns: authProfile.primary_concerns || [],
      });
    }
    setIsEditingProfile(false);
    setSaveError(null);
  };
  
  // Handle sign out
  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // System Protocols - fetch from backend
  const { data: systemSettings, isLoading: settingsLoading, needsInitialization } = useSystemSettings();
  const updateQuietHours = useUpdateQuietHours();
  const togglePreference = useTogglePreference();
  const toggleAgentPermission = useToggleAgentPermission();
  const initializeSettings = useInitializeSettings();
  
  // Track if initialization has been attempted to prevent infinite loop
  const initializationAttempted = useRef(false);
  
  // Auto-initialize settings if they're missing (once)
  useEffect(() => {
    console.log('[Dashboard] Auto-init effect:', {
      needsInitialization,
      attempted: initializationAttempted.current,
      isPending: initializeSettings.isPending
    });
    if (needsInitialization && !initializationAttempted.current && !initializeSettings.isPending) {
      console.log('Settings need initialization - creating default rows');
      initializationAttempted.current = true;
      initializeSettings.mutate();
    }
  }, [needsInitialization, initializeSettings]);
  
  const [isEditingProtocols, setIsEditingProtocols] = useState(false);
  
  // Build protocols from backend data
  // If needsInitialization is true, wait for initialization instead of showing fallbacks
  const protocols = (systemSettings && !needsInitialization) ? {
    quietHoursStart: parseInt(systemSettings.quiet_hours_start?.split(':')[0] || '22'),
    quietHoursEnd: parseInt(systemSettings.quiet_hours_end?.split(':')[0] || '7'),
    // Proactive preferences
    careReminders: systemSettings.care_reminders_enabled ?? true,
    observations: systemSettings.observations_enabled ?? true,
    seasonalTips: systemSettings.seasonal_tips_enabled ?? true,
    healthFollowups: systemSettings.health_followups_enabled ?? true,
    // Agent permissions
    canDeletePlants: systemSettings.can_delete_plants ?? false,
    canDeleteNotes: systemSettings.can_delete_notes ?? false,
    canDeleteInsights: systemSettings.can_delete_insights ?? false,
    canSendReminders: systemSettings.can_send_reminders ?? true,
    canSendInsights: systemSettings.can_send_insights ?? true,
    canCreateReminders: systemSettings.can_create_reminders ?? true,
  } : null;

  console.log('[Dashboard] Protocols result:', {
    hasSystemSettings: !!systemSettings,
    needsInitialization,
    protocolsIsNull: protocols === null,
    protocols
  });

  const [tempProtocols, setTempProtocols] = useState(protocols);
  
  // Update tempProtocols when systemSettings loads
  useEffect(() => {
    if (systemSettings && !isEditingProtocols) {
      setTempProtocols({
        quietHoursStart: parseInt(systemSettings.quiet_hours_start?.split(':')[0] || '22'),
        quietHoursEnd: parseInt(systemSettings.quiet_hours_end?.split(':')[0] || '7'),
        careReminders: systemSettings.care_reminders_enabled ?? true,
        observations: systemSettings.observations_enabled ?? true,
        seasonalTips: systemSettings.seasonal_tips_enabled ?? true,
        healthFollowups: systemSettings.health_followups_enabled ?? true,
        canDeletePlants: systemSettings.can_delete_plants ?? false,
        canDeleteNotes: systemSettings.can_delete_notes ?? false,
        canDeleteInsights: systemSettings.can_delete_insights ?? false,
        canSendReminders: systemSettings.can_send_reminders ?? true,
        canSendInsights: systemSettings.can_send_insights ?? true,
        canCreateReminders: systemSettings.can_create_reminders ?? true,
      });
    }
  }, [systemSettings, isEditingProtocols]);

  const [settings, setSettings] = useState({
    autoDiagnosis: true,
    dataSharing: false,
  });

  // Fetch user insights from database
  const { data: userInsights = [], isLoading: insightsLoading } = useUserInsights();
  const deleteInsight = useDeleteInsight();

  const toggleSetting = (key: string) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

  const togglePet = (petId: string) => {
    if (!isEditingProfile) return;
    setEditableProfile(prev => {
      const newPets = prev.pets.includes(petId) 
        ? prev.pets.filter(p => p !== petId)
        : [...prev.pets, petId];
      return { ...prev, pets: newPets };
    });
  };

  const updatePersonality = (mode: PersonalityType) => {
    if (!isEditingProfile) return;
    setEditableProfile(prev => ({ ...prev, personality: mode }));
  };

  const removeInsight = (insightId: string) => {
    deleteInsight.mutate(insightId);
  };

  // Protocol editing functions
  const handleEditProtocols = () => {
    setTempProtocols(protocols);
    setIsEditingProtocols(true);
  };

  const handleSaveProtocols = async () => {
    // Save quiet hours to backend
    const startTime = `${String(tempProtocols.quietHoursStart).padStart(2, '0')}:00`;
    const endTime = `${String(tempProtocols.quietHoursEnd).padStart(2, '0')}:00`;
    
    try {
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
      console.error('Failed to save protocols:', error);
    }
    
    setIsEditingProtocols(false);
  };

  const handleCancelProtocols = () => {
    setTempProtocols(protocols);
    setIsEditingProtocols(false);
  };

  const updateTempProtocol = (key: string, value: any) => {
    if (!isEditingProtocols) return;
    setTempProtocols(prev => ({ ...prev, [key]: value }));
  };

  const toggleTempProtocol = (key: string) => {
    if (!isEditingProtocols) return;
    setTempProtocols(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  return (
    <div className="flex-1 bg-[#f8f8f8] p-6 md:p-12 overflow-y-auto relative h-full">
      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none" style={{ backgroundImage: 'url(#grid-pattern)' }} />
      
      {/* Header */}
      <div className="relative z-10 mb-8 flex flex-col md:flex-row md:items-end justify-between border-b border-black pb-6 gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-serif text-black">Profile</h1>
        </div>
        <div className="flex items-center gap-4">
           <div className="text-right hidden sm:block">
              <p className="font-serif text-sm text-stone-500">System Time</p>
              <p className="font-mono text-xs font-bold">{new Date().toLocaleTimeString()}</p>
           </div>
        </div>
      </div>

      <div className="relative z-10 space-y-8 mb-24">
         
         {/* Top Section: Profile & Protocols */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             {/* LEFT COLUMN: Profile */}
             <div className="space-y-8">
                
                {/* Profile Card */}
                <div className="bg-white border border-black p-6 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-shadow duration-300 relative">
                    <div className="absolute top-0 left-0 bg-black text-white px-2 py-1 font-mono text-[9px] uppercase rounded-tl-lg rounded-br-lg">
                      {authProfile?.id ? `User_ID: ${authProfile.id.slice(0, 8)}` : 'User_ID: ---'}
                    </div>
                    
                    {/* Error message */}
                    {saveError && (
                      <div className="mt-4 mb-2 p-2 bg-red-50 border border-red-200 rounded-md">
                        <p className="font-mono text-xs text-red-600">{saveError}</p>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-start mt-4 mb-6">
                       <div className="flex-1">
                          <label className="font-mono text-[10px] uppercase text-stone-400 block mb-1">Display Name</label>
                           {isEditingProfile ? (
                                <input 
                                  type="text" 
                                  value={editableProfile.display_name} 
                                  onChange={(e) => setEditableProfile({...editableProfile, display_name: e.target.value})} 
                                  className="w-full border-b border-black font-serif text-2xl focus:outline-none bg-stone-50 mb-2 rounded-sm"
                                  placeholder="Your name"
                                />
                            ) : (
                                <h2 className="font-serif text-3xl mb-1">{editableProfile.display_name || 'Not set'}</h2>
                            )}
                       </div>
                        <div className="flex gap-2">
                          {isEditingProfile ? (
                            <>
                              <button 
                                onClick={handleCancelEdit} 
                                disabled={isSaving}
                                className="p-2 hover:bg-stone-100 rounded-full border border-stone-300 hover:border-black transition-all"
                              >
                                <X size={16} />
                              </button>
                              <button 
                                onClick={handleSaveProfile} 
                                disabled={isSaving}
                                className="p-2 bg-black text-white hover:bg-stone-800 rounded-full border border-black transition-all flex items-center gap-1"
                              >
                                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={() => setIsEditingProfile(true)} 
                              className="p-2 hover:bg-stone-100 rounded-full border border-transparent hover:border-black transition-all"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="font-mono text-[10px] uppercase text-stone-400 block mb-1">Experience Level</label>
                            {isEditingProfile ? (
                              <select 
                                value={editableProfile.experience_level} 
                                onChange={(e) => setEditableProfile({...editableProfile, experience_level: e.target.value as ExperienceLevelType})}
                                className="w-full border-b border-black font-serif text-sm bg-stone-50 rounded-sm py-1"
                              >
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="expert">Expert</option>
                              </select>
                            ) : (
                              <div className="font-serif text-sm capitalize">{editableProfile.experience_level || 'Not set'}</div>
                            )}
                        </div>
                        <div>
                            <label className="font-mono text-[10px] uppercase text-stone-400 block mb-1">Location</label>
                            {isEditingProfile ? (
                              <input 
                                type="text" 
                                value={editableProfile.location} 
                                onChange={(e) => setEditableProfile({...editableProfile, location: e.target.value})} 
                                className="w-full border-b border-black font-mono text-sm bg-stone-50 rounded-sm"
                                placeholder="City or ZIP"
                              />
                            ) : (
                              <div className="font-mono text-sm flex items-center gap-2">
                                <MapPin size={14} /> {editableProfile.location || 'Not set'}
                              </div>
                            )}
                        </div>
                        
                        <div>
                            <label className="font-mono text-[10px] uppercase text-stone-400 block mb-1">Email</label>
                            <div className="font-mono text-sm truncate">{user?.email || 'Not available'}</div>
                        </div>
                        <div>
                            <label className="font-mono text-[10px] uppercase text-stone-400 block mb-1">Phone Number</label>
                            <div className="font-mono text-sm flex items-center gap-2 truncate">
                              <Phone size={14} /> {authProfile?.phone_number || 'Not linked'}
                            </div>
                        </div>

                        {/* Pets Toggle Section */}
                        <div>
                            <label className="font-mono text-[10px] uppercase text-stone-400 block mb-3">Pets</label>
                            <div className="flex gap-2 flex-wrap">
                                {[
                                    { id: 'dog', name: 'Dog', icon: Dog },
                                    { id: 'cat', name: 'Cat', icon: Cat },
                                    { id: 'bird', name: 'Bird', icon: Bird },
                                    { id: 'fish', name: 'Fish', icon: Fish },
                                    { id: 'rabbit', name: 'Rabbit', icon: Rabbit },
                                ].map((pet) => {
                                    const isSelected = editableProfile.pets.includes(pet.id);
                                    return (
                                        <button 
                                            key={pet.id}
                                            onClick={() => togglePet(pet.id)}
                                            disabled={!isEditingProfile}
                                            title={`${pet.name}`}
                                            className={`transition-all duration-300 hover:scale-110 active:scale-95 ${isEditingProfile ? 'cursor-pointer' : 'cursor-default'}`}
                                        >
                                            <pet.icon size={28} fill={isSelected ? "currentColor" : "none"} strokeWidth={1.5} className={isSelected ? 'text-black drop-shadow-sm' : 'text-stone-300'} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Agent Personality Section */}
                        <div>
                            <label className="font-mono text-[10px] uppercase text-stone-400 block mb-3">Agent Personality</label>
                            <div className="flex gap-2 flex-wrap">
                                {[
                                    { id: 'warm', name: 'Warm', icon: Sun },
                                    { id: 'playful', name: 'Playful', icon: Zap },
                                    { id: 'philosophical', name: 'Philosophical', icon: Lightbulb },
                                    { id: 'expert', name: 'Expert', icon: Microscope },
                                ].map((mode) => {
                                    const isSelected = editableProfile.personality === mode.id;
                                    return (
                                        <button 
                                            key={mode.id}
                                            onClick={() => updatePersonality(mode.id as PersonalityType)}
                                            disabled={!isEditingProfile}
                                            title={`${mode.name}`}
                                            className={`transition-all duration-300 hover:scale-110 active:scale-95 ${isEditingProfile ? 'cursor-pointer' : 'cursor-default'}`}
                                        >
                                            <mode.icon size={28} fill={isSelected ? "currentColor" : "none"} strokeWidth={1.5} className={isSelected ? 'text-black drop-shadow-sm' : 'text-stone-300'} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="col-span-2">
                            <label className="font-mono text-[10px] uppercase text-stone-400 block mb-1">Interests</label>
                            {isEditingProfile ? (
                              <input 
                                type="text" 
                                value={editableProfile.primary_concerns.join(', ')} 
                                onChange={(e) => setEditableProfile({
                                  ...editableProfile, 
                                  primary_concerns: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                })} 
                                className="w-full border-b border-black font-serif text-sm bg-stone-50 rounded-sm"
                                placeholder="Houseplants, Succulents, etc."
                              />
                            ) : (
                              <div className="font-serif text-sm">
                                {editableProfile.primary_concerns.length > 0 
                                  ? editableProfile.primary_concerns.join(', ') 
                                  : 'Not set'}
                              </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* System Protocols - moved under Profile Card */}
                <SystemProtocols
                  protocols={protocols}
                  tempProtocols={tempProtocols}
                  isEditingProtocols={isEditingProtocols}
                  onEdit={handleEditProtocols}
                  onSave={handleSaveProtocols}
                  onCancel={handleCancelProtocols}
                  updateTempProtocol={updateTempProtocol}
                  toggleTempProtocol={toggleTempProtocol}
                  QuietHoursClock={QuietHoursClock}
                />
             </div>

             {/* RIGHT COLUMN: Behavioral Insights and Settings */}
             <div className="space-y-8">
                {/* AI Insights Section - moved to right column */}
                <div className="bg-white border border-black p-6 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-shadow duration-300">
                    <div className="flex items-center gap-2 mb-4 border-b border-black pb-2">
                        <div className="w-4 h-4 bg-black text-white flex items-center justify-center rounded-sm text-[9px] font-bold">AI</div>
                        <h3 className="font-serif text-lg">Behavioral Insights</h3>
                    </div>
                    
                    <div className="space-y-2">
                    {insightsLoading ? (
                        <div className="text-[10px] text-stone-400 p-2 flex items-center gap-2">
                            <Loader2 size={12} className="animate-spin" />
                            Loading insights...
                        </div>
                    ) : userInsights.length > 0 ? (
                        userInsights.map((insight) => {
                            // Map insight keys to appropriate icons
                            const getIcon = (key: string) => {
                                if (key.includes('water')) return Droplets;
                                if (key.includes('light')) return Lightbulb;
                                if (key.includes('care')) return Brain;
                                if (key.includes('schedule')) return Calendar;
                                return Microscope;
                            };
                            const Icon = getIcon(insight.insight_key);
                            
                            return (
                                <div key={insight.id} className="flex items-start gap-2 text-xs font-mono text-stone-600 bg-stone-50 p-2 rounded-sm relative group hover:bg-stone-100 transition-colors">
                                    <Icon size={12} className="mt-0.5 text-stone-400" />
                                    <span className="flex-1">{insight.insight_value}</span>
                                    <button 
                                        onClick={() => removeInsight(insight.id)} 
                                        className="text-stone-300 hover:text-red-500 transition-colors" 
                                        title="Delete Insight"
                                        disabled={deleteInsight.isPending}
                                    >
                                        {deleteInsight.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                    </button>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-[10px] text-stone-400 p-2">No insights generated yet.</div>
                    )}
                    </div>
                </div>

                {/* Security Section */}
                <div className="bg-white border border-black p-6 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                   <div className="flex items-center gap-2 mb-6 border-b border-black pb-2">
                      <Key size={16} />
                      <h3 className="font-serif text-lg">Security & Access</h3>
                   </div>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 border border-stone-200 rounded-md hover:border-black cursor-pointer transition-colors">
                         <div>
                            <div className="font-bold text-sm">Change Password</div>
                            <div className="text-[10px] text-stone-500 font-mono">Last changed 3 months ago.</div>
                         </div>
                         <ChevronRight size={16} />
                      </div>
                      
                      <div className="flex justify-between items-center p-3 border border-stone-200 rounded-md hover:border-black cursor-pointer transition-colors">
                         <div>
                            <div className="font-bold text-sm">Change Linked Number</div>
                            <div className="text-[10px] text-stone-500 font-mono">
                              Current: {authProfile?.phone_number || 'Not linked'}
                            </div>
                         </div>
                         <Phone size={16} />
                      </div>
                   </div>
                </div>

                {/* Data Management Section */}
                <div className="bg-white border border-black p-6 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                   <div className="flex items-center gap-2 mb-6 border-b border-black pb-2">
                      <Database size={16} />
                      <h3 className="font-serif text-lg">Data Management</h3>
                   </div>
                   <div className="flex justify-between items-center p-3 border border-stone-200 rounded-md hover:border-black cursor-pointer transition-colors">
                      <div>
                         <div className="font-bold text-sm">Download My Data</div>
                         <div className="text-[10px] text-stone-500 font-mono">Export a full archive of your logs and settings.</div>
                      </div>
                      <Download size={16} />
                   </div>
                </div>

                {/* Account Actions */}
                <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
                   <div className="flex items-center gap-2 mb-4 text-red-700">
                      <LogOut size={16} />
                      <h3 className="font-serif text-lg">Account Actions</h3>
                   </div>
                   <div className="space-y-3">
                     <button 
                       onClick={handleSignOut}
                       className="w-full px-4 py-2 border border-stone-300 bg-white text-stone-700 rounded-md text-xs font-mono hover:bg-stone-100 transition-colors flex items-center justify-center gap-2"
                     >
                       <LogOut size={14} /> Sign Out
                     </button>
                     <button className="w-full px-4 py-2 border border-red-300 bg-white text-red-600 rounded-md text-xs font-mono hover:bg-red-600 hover:text-white transition-colors">
                        Delete Account
                     </button>
                   </div>
                </div>
             </div>
         </div>
      </div>
    </div>
  );
};

// --- MAIN DASHBOARD SHELL ---

export default function ModernDashboard() {
  const navigate = useNavigate();
  const location = window.location.pathname;
  
  // Determine active tab from URL
  const getActiveTabFromPath = () => {
    if (location.includes('/profile')) return 'Profile';
    if (location.includes('/activity')) return 'Activity';
    return 'Collection';
  };
  
  const [activeTab, setActiveTab] = useState(getActiveTabFromPath());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewState, setViewState] = useState('list');

  // Update active tab when URL changes
  React.useEffect(() => {
    setActiveTab(getActiveTabFromPath());
  }, [location]);

  // Fetch plant detail data when a plant is selected
  const { data: selectedPlant, isLoading: plantLoading } = usePlant(selectedId);
  const { data: careEvents = [], isLoading: careLoading } = useCareEvents(selectedId);
  const { data: reminders = [], isLoading: remindersLoading } = usePlantReminders(selectedId);
  const { data: identifications = [], isLoading: idsLoading } = usePlantIdentifications(selectedId);

  // Fallback specimens for UI demo when no real data
  const allSpecimens: Specimen[] = [
    { 
      id: '1', 
      code: 'MN-42', 
      name: 'Monstera Deliciosa', 
      family: 'Araceae',
      zone: '09', 
      status: 'Active', 
      trend: [ {val:10}, {val:20}, {val:15}, {val:40} ],
      moisture: '64%',
      light: '850',
      co2: '410',
      growth: '+2.4',
      image: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&q=80&w=300&h=300'
    },
    { 
      id: '2',
      code: 'FL-19', 
      name: 'Ficus Lyrata', 
      family: 'Moraceae',
      zone: '11', 
      status: 'Check', 
      trend: [ {val:30}, {val:20}, {val:25}, {val:10} ],
      moisture: '45%',
      light: '920',
      co2: '380',
      growth: '+0.5',
      image: 'https://images.unsplash.com/photo-1613143997235-8c42203135db?auto=format&fit=crop&q=80&w=300&h=300'
    },
    { 
      id: '3',
      code: 'SN-08', 
      name: 'Sansevieria', 
      family: 'Asparagaceae',
      zone: '08', 
      status: 'Active', 
      trend: [ {val:40}, {val:40}, {val:45}, {val:40} ],
      moisture: '20%',
      light: '400',
      co2: '400',
      growth: '+1.1',
      image: 'https://images.unsplash.com/photo-1599598425947-d50c2c27b0d8?auto=format&fit=crop&q=80&w=300&h=300'
    },
    { 
      id: '4',
      code: 'CO-33', 
      name: 'Calathea Orbifolia', 
      family: 'Marantaceae',
      zone: '10', 
      status: 'Risk', 
      trend: [ {val:50}, {val:30}, {val:10}, {val:5} ],
      moisture: '85%',
      light: '200',
      co2: '420',
      growth: '-0.2',
      image: 'https://images.unsplash.com/photo-1601985705806-23998782e46d?auto=format&fit=crop&q=80&w=300&h=300'
    },
  ];

  const handlePlantNavigation = (id: string) => {
    setSelectedId(id);
    setActiveTab('Collection');
    setViewState('detail');
  };

  const activePlant = allSpecimens.find(p => p.id === selectedId) || allSpecimens[0];

  return (
    <div className="h-screen w-screen bg-[#f8f8f8] text-black font-sans selection:bg-black selection:text-white flex overflow-hidden">
      <EtchingPattern />

      {/* --- SIDEBAR --- */}
      <nav className="w-16 md:w-64 bg-white border-r border-black flex flex-col justify-between flex-shrink-0 z-20">
        <div>
          <button 
            onClick={() => navigate('/')}
            className="h-16 flex items-center justify-center md:justify-start md:px-6 border-b border-black w-full hover:bg-stone-50 transition-colors cursor-pointer"
          >
             <div className="w-8 h-8 bg-black text-white rounded-md flex items-center justify-center font-serif text-lg font-bold">V</div>
             <span className="ml-3 font-mono text-xs tracking-widest hidden md:block">ORCHID</span>
          </button>
          <div className="flex flex-col">
            {[
              { id: 'Collection', icon: Database, label: 'Collection', path: '/dashboard/collection' },
              { id: 'Profile', icon: Layout, label: 'Profile', path: '/dashboard/profile' },
              { id: 'Activity', icon: FileText, label: 'Activity', path: '/dashboard/activity' },
            ].map((item, i) => (
              <button 
                key={i} 
                onClick={() => {
                    navigate(item.path);
                    setActiveTab(item.id);
                    if (item.id === 'Collection') setViewState('list');
                }}
                className={`h-12 flex items-center justify-center md:justify-start md:px-6 hover:bg-stone-100 transition-colors ${
                  activeTab === item.id ? 'bg-black text-white hover:bg-stone-800' : 'text-stone-500'
                }`}
              >
                <item.icon size={18} strokeWidth={1.5} />
                <span className={`ml-3 font-mono text-xs uppercase tracking-wider hidden md:block ${activeTab === item.id ? 'text-white' : ''}`}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-black hidden md:block">
           <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-mono text-[10px] uppercase">System Online</span>
           </div>
           <p className="font-serif text-[10px] text-stone-400">v2.4.0</p>
        </div>
      </nav>

      {/* --- CONTENT AREA --- */}
      <CommandAgent />

      {activeTab === 'Profile' ? (
         <OverviewView 
            onNavigateToPlant={handlePlantNavigation} 
            onViewAllPlants={() => {
                navigate('/dashboard/collection');
                setActiveTab('Collection');
                setViewState('list');
            }}
            allSpecimens={allSpecimens}
         />
      ) : activeTab === 'Activity' ? (
         <FieldLogs />
      ) : (
         <>
            {viewState === 'list' ? (
               <CollectionView 
                  onNavigateToPlant={(id) => {
                      setSelectedId(id);
                      setViewState('detail');
                  }}
               />
            ) : selectedPlant ? (
                <PlantDetail
                  plant={selectedPlant}
                  careEvents={careEvents}
                  reminders={reminders}
                  identifications={identifications}
                  onBack={() => {
                    setViewState('list');
                    setSelectedId(null);
                  }}
                  isLoading={plantLoading || careLoading || remindersLoading || idsLoading}
                />
            ) : (
                // Loading state or fallback for demo specimens
                <main className="flex-1 bg-[#f8f8f8] flex flex-col relative overflow-hidden">
                  <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #000 0.5px, transparent 0.5px)', backgroundSize: '20px 20px' }} />
                  
                  <header className="h-16 border-b border-black bg-white/80 backdrop-blur flex items-center justify-between px-6 md:px-12 sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                      <button onClick={() => { setViewState('list'); setSelectedId(null); }} className="flex items-center gap-2 font-serif font-semibold hover:underline">
                        <ArrowLeft size={16} /> Back to Collection
                      </button>
                      <div className="h-6 w-px bg-stone-300" />
                      <h1 className="font-mono text-lg md:text-xl tracking-tight uppercase">
                        {activePlant.code}
                      </h1>
                    </div>
                    <div className="flex gap-3">
                      <button className="h-8 px-3 border border-black bg-white rounded-full text-xs font-mono uppercase hover:bg-black hover:text-white transition-colors flex items-center gap-2"><Share2 size={12} /> Share</button>
                      <button className="h-8 px-3 border border-black bg-black rounded-full text-white text-xs font-mono uppercase hover:bg-stone-800 transition-colors flex items-center gap-2"><Microscope size={12} /> Analyze</button>
                    </div>
                  </header>

                  <div className="flex-1 overflow-y-auto p-6 md:p-12">
                    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8">
                        <div className="md:col-span-5 space-y-6">
                          <div className="border border-black bg-white p-2 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                              <div className="aspect-[3/4] bg-stone-100 relative overflow-hidden border border-stone-200 rounded-md">
                                <div className="absolute inset-0 z-10 opacity-20 pointer-events-none mix-blend-multiply" style={{ backgroundImage: 'url(#halftone)' }} />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <EtchedLeaf className="w-full h-full p-8 text-stone-800" />
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/90 border-t border-black flex justify-between items-center rounded-b-md">
                                    <span className="font-mono text-[9px]">CAM_02.RAW</span>
                                    <Camera size={12} />
                                </div>
                              </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                              {[1,2,3].map(i => (
                                <div key={i} className="aspect-square border border-black bg-white rounded-md hover:bg-stone-100 cursor-pointer flex items-center justify-center"><Leaf size={16} className="text-stone-300" /></div>
                              ))}
                          </div>
                        </div>

                        <div className="md:col-span-7">
                          <div className="mb-8 border-b border-black pb-6">
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-mono text-xs text-stone-500 uppercase tracking-widest">{activePlant.family}</span>
                                <span className={`font-mono text-xs bg-black text-white px-2 py-1 uppercase rounded-sm`}>{activePlant.status === 'Check' ? 'Check Req' : activePlant.status}</span>
                              </div>
                              <h2 className="text-5xl font-serif leading-none mb-4">{activePlant.name.split(' ')[0]} <br/><span className="text-stone-500">{activePlant.name.split(' ')[1]}</span></h2>
                              <p className="font-serif text-sm leading-relaxed max-w-md">
                                Specimen in {activePlant.status === 'Healthy' ? 'optimal' : 'sub-optimal'} condition. Recent telemetry indicates {activePlant.status === 'Risk' ? 'stress markers present' : 'nominal growth patterns'}.
                              </p>
                          </div>

                          <div className="grid grid-cols-2 gap-px bg-black border border-black rounded-lg overflow-hidden mb-8">
                              <div className="bg-white p-4 hover:bg-stone-50 transition-colors">
                                <div className="flex items-center gap-2 mb-1 text-stone-500"><Droplets size={14} /><span className="font-mono text-[10px] uppercase">Moisture</span></div>
                                <span className="text-3xl font-serif">{activePlant.moisture}</span>
                              </div>
                              <div className="bg-white p-4 hover:bg-stone-50 transition-colors">
                                <div className="flex items-center gap-2 mb-1 text-stone-500"><Sun size={14} /><span className="font-mono text-[10px] uppercase">Light (PAR)</span></div>
                                <span className="text-3xl font-serif">{activePlant.light}</span>
                              </div>
                              <div className="bg-white p-4 hover:bg-stone-50 transition-colors">
                                <div className="flex items-center gap-2 mb-1 text-stone-500"><Wind size={14} /><span className="font-mono text-[10px] uppercase">CO2</span></div>
                                <span className="text-3xl font-serif">{activePlant.co2} <span className="text-xs text-stone-400">ppm</span></span>
                              </div>
                              <div className="bg-white p-4 hover:bg-stone-50 transition-colors">
                                <div className="flex items-center gap-2 mb-1 text-stone-500"><Activity size={14} /><span className="font-mono text-[10px] uppercase">Growth</span></div>
                                <span className="text-3xl font-serif">{activePlant.growth} <span className="text-xs text-stone-400">cm</span></span>
                              </div>
                          </div>

                          <div className="border border-black bg-white p-6 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                              <div className="flex justify-between items-center mb-2">
                                <h3 className="font-serif text-lg">Metabolic Rate</h3>
                                <div className="flex gap-2">
                                    <span className="w-2 h-2 rounded-full bg-black"></span>
                                    <span className="font-mono text-[9px] text-stone-500">CURRENT</span>
                                </div>
                              </div>
                              <DetailChart />
                          </div>
                        </div>
                    </div>
                  </div>
                </main>
            )}
         </>
      )}
    </div>
  );
}
