import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { Download, Play, Sprout, Flower2, TreeDeciduous, Brain, Zap, Shield, MessageSquare, Sparkles, Eye, Search, Clock, Users, BookOpen, AlertCircle, Smartphone, UserX } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ScatterChart, Scatter, ZAxis, Label
} from 'recharts';
// DemoChatOverlay archived — replaced by /demo page (see DEMO_PAGE_SPEC.md)
import { MemoryOrb } from '@/components/landing/MemoryOrb';
import { SwarmLoader } from '@/components/landing/SwarmLoader';

// Plant Vision Component - ASCII on load, transparent image on hover
const PlantVision = ({ 
  plantName, 
  scientificName, 
  folder, 
  confidence, 
  traits,
  delay
}: { 
  plantName: string;
  scientificName: string;
  folder: string;
  confidence: string;
  traits: string;
  delay: number;
}) => {
  const [asciiArt, setAsciiArt] = useState('');
  const [isHovered, setIsHovered] = useState(false);

  // Fetch ASCII art
  useEffect(() => {
    const asciiFileName = `${folder}_ascii.txt`;
    fetch(`/plant_assets_art/${folder}/${asciiFileName}`)
      .then(res => res.text())
      .then(text => setAsciiArt(text))
      .catch(() => setAsciiArt(''));
  }, [folder]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="bg-white border-2 border-black rounded-lg overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="aspect-square bg-white relative overflow-hidden flex items-center justify-center">
        <AnimatePresence mode="wait">
          {!isHovered ? (
            <motion.pre 
              key="ascii"
              className="text-[0.22rem] leading-[0.26rem] font-mono text-black overflow-hidden p-1 w-full h-full flex items-center justify-center whitespace-pre"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              {asciiArt}
            </motion.pre>
          ) : (
            <motion.img
              key="transparent"
              src={`/plant_assets_art/${folder}/${folder}_transparent.png`}
              alt={plantName}
              className="w-full h-full object-contain p-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>
      </div>
      <div className="p-4 border-t-2 border-black">
        <p className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-1">Identified</p>
        <p className="font-mono font-bold text-lg text-black">{plantName}</p>
        <p className="font-mono text-xs text-stone-500 italic mb-2">{scientificName}</p>
        <p className="font-mono text-xs text-stone-600 mt-2">{confidence} • {traits}</p>
      </div>
    </motion.div>
  );
};

// Etched botanical patterns
const EtchedFern = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="0.8">
    <path d="M50,95 Q48,70 45,50 Q43,30 50,5" />
    {[...Array(12)].map((_, i) => {
      const y = 15 + i * 6.5;
      const width = 12 - Math.abs(i - 6) * 1.5;
      return (
        <g key={i}>
          <path d={`M50,${y} Q${45 - width},${y - 2} ${35 - width},${y - 1}`} />
          <path d={`M50,${y} Q${55 + width},${y - 2} ${65 + width},${y - 1}`} />
        </g>
      );
    })}
  </svg>
);

const EtchedMonstera = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" strokeWidth="1">
    <ellipse cx="50" cy="50" rx="35" ry="40" />
    <path d="M50,10 L50,90" />
    <path d="M50,20 L25,25 M50,35 L20,40 M50,50 L22,55 M50,65 L25,70 M50,80 L30,82" />
    <path d="M50,20 L75,25 M50,35 L80,40 M50,50 L78,55 M50,65 L75,70 M50,80 L70,82" />
    <ellipse cx="35" cy="35" rx="4" ry="6" />
    <ellipse cx="65" cy="35" rx="4" ry="6" />
  </svg>
);

// PDF generation function using jsPDF
const generateAndDownloadPDF = async () => {
  // Dynamic import to keep bundle size down
  const { jsPDF } = await import('jspdf');
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  let y = 20;

  // Helper to add text with line breaks
  const addText = (text: string, fontSize: number = 10, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth);
    
    lines.forEach((line: string) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += fontSize * 0.5;
    });
    y += 3;
  };

  // Helper for section headers with underline
  const addSectionHeader = (text: string) => {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(text, margin, y);
    y += 2;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  };

  // Helper for boxed content
  const addBox = (text: string, bgGray: number = 250) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    const boxPadding = 5;
    const lines = doc.splitTextToSize(text, maxWidth - (boxPadding * 2));
    const boxHeight = (lines.length * 5) + (boxPadding * 2);
    
    doc.setFillColor(bgGray, bgGray, bgGray);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, maxWidth, boxHeight, 'FD');
    
    y += boxPadding + 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    lines.forEach((line: string) => {
      doc.text(line, margin + boxPadding, y);
      y += 5;
    });
    y += boxPadding + 3;
  };

  // Helper for bar chart
  const addBarChart = (title: string, data: {label: string, value: number, maxValue: number}[]) => {
    if (y > 200) {
      doc.addPage();
      y = 20;
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, y);
    y += 8;
    
    const barHeight = 12;
    const maxBarWidth = maxWidth - 60;
    const labelWidth = 50;
    
    data.forEach(item => {
      // Label
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(item.label, margin, y + 8);
      
      // Bar
      const barWidth = (item.value / item.maxValue) * maxBarWidth;
      doc.setFillColor(0, 0, 0);
      doc.rect(margin + labelWidth, y + 2, barWidth, barHeight, 'F');
      
      // Value
      doc.setFont('helvetica', 'bold');
      doc.text(item.value.toString(), margin + labelWidth + barWidth + 3, y + 8);
      
      y += barHeight + 4;
    });
    
    y += 5;
  };

  // Helper for competitive positioning diagram
  const addPositioningDiagram = () => {
    if (y > 180) {
      doc.addPage();
      y = 20;
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Competitive Positioning Matrix', margin, y);
    y += 10;
    
    const chartSize = 80;
    const chartX = margin + 40;
    const chartY = y;
    
    // Draw axes
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.line(chartX, chartY, chartX, chartY + chartSize); // Y-axis
    doc.line(chartX, chartY + chartSize, chartX + chartSize, chartY + chartSize); // X-axis
    
    // Axis labels
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('AI Intelligence', chartX - 35, chartY + chartSize / 2, { angle: 90 });
    doc.text('Platform Friction', chartX + chartSize / 2 - 15, chartY + chartSize + 10);
    
    // Plot points
    const points = [
      { name: 'Websites', x: 10, y: 20, size: 3 },
      { name: 'Plant Apps', x: 20, y: 50, size: 3 },
      { name: 'Chatbots', x: 70, y: 30, size: 3 },
      { name: 'Google', x: 40, y: 10, size: 3 },
      { name: 'ORCHID', x: 90, y: 90, size: 5, isOrchid: true }
    ];
    
    points.forEach(point => {
      const px = chartX + (point.x / 100) * chartSize;
      const py = chartY + chartSize - (point.y / 100) * chartSize;
      
      if (point.isOrchid) {
        // Draw flower icon for Orchid
        doc.setFillColor(0, 0, 0);
        doc.circle(px, py, point.size, 'F');
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text(point.name, px - 8, py - 8);
      } else {
        // Draw circle for others
        doc.setFillColor(128, 128, 128);
        doc.circle(px, py, point.size, 'F');
        doc.setFontSize(6);
        doc.text(point.name, px + 5, py + 2);
      }
    });
    
    y = chartY + chartSize + 15;
  };

  // Helper for retention comparison
  const addRetentionComparison = () => {
    if (y > 200) {
      doc.addPage();
      y = 20;
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('30-Day Retention: Apps vs Messaging', margin, y);
    y += 10;
    
    const barWidth = 60;
    const barHeight = 15;
    const gap = 25;
    
    // Standalone Apps
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Standalone Apps', margin, y + 10);
    doc.setFillColor(200, 200, 200);
    doc.rect(margin + gap, y + 3, barWidth * 0.07, barHeight, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('7%', margin + gap + barWidth * 0.07 + 3, y + 12);
    
    y += 20;
    
    // WhatsApp Business
    doc.setFont('helvetica', 'normal');
    doc.text('WhatsApp Business', margin, y + 10);
    doc.setFillColor(0, 0, 0);
    doc.rect(margin + gap, y + 3, barWidth * 0.88, barHeight, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('88%', margin + gap + barWidth * 0.88 + 3, y + 12);
    
    y += 25;
  };

  // Title Box
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('MSIS 549 Individual Project Proposal', margin, 18);
  
  doc.setFontSize(16);
  doc.text('ORCHID: AI-Powered Plant Care Agent', margin, 28);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('via iMessage & WhatsApp', margin, 35);
  
  y = 50;

  // Sections
  addSectionHeader('FIG 0.1 — ELEVATOR PITCH');
  addText('A lot of plant enthusiasts and beginners struggle with the daily anxiety of plant care—not knowing when to water, how to diagnose problems, or whether their plants are thriving—which costs them money on dead plants, missed opportunities for growth, and the heartbreak of failure.', 10);
  y += 2;
  addText('So I built Orchid, an AI-powered plant care agent that helps them confidently care for their plants by proactively managing their collection, diagnosing issues in real-time, and learning their unique habits and environment.', 10);
  y += 2;
  addBox('Unlike Planta and other plant care apps, Orchid runs through WhatsApp and iMessage, eliminating "yet another app," and uses conversational AI with hierarchical memory to understand that no two plants—or plant parents—are the same.');

  addSectionHeader('FIG 1.0 — PROBLEM STATEMENT');
  addText('I am obsessed with plants. Collecting them, growing them, taking care of them when they\'re unwell, and seeing my friends\' glee when they observe my collection. At the same time, the unknown of caring for plants creates daily stress. My friends feel the same way. "I\'ve killed x plant y times" is a common line.', 10);
  y += 3;
  addText('Key Problems:', 10, true);
  addText('• Information Overload: Generic care guides don\'t account for individual environments', 9);
  addText('• Reactive Care: Users only seek help when problems arise', 9);
  addText('• App Fatigue: Existing solutions require downloading yet another app', 9);
  addText('• Lack of Personalization: Current tools don\'t learn from user behavior', 9);
  y += 3;
  addBox('The Mortality Crisis: 35% of houseplants die at home. 67% of millennials call themselves "plant murderers." 48% worry about keeping plants alive. Average: 7 plants killed per millennial.');
  
  addRetentionComparison();

  addSectionHeader('FIG 2.0 — TECHNICAL APPROACH');
  addText('Multi-Modal AI (Gemini 3 & Perplexity Sonar):', 10, true);
  addText('• Visual Identification: Processes plant images and videos with 98%+ accuracy', 9);
  addText('• Health Diagnosis: Real-time identification of diseases, pests, and deficiencies', 9);
  addText('• Research Integration: Live web search for rare species and cutting-edge care techniques', 9);
  y += 3;
  addText('Hierarchical Memory System:', 10, true);
  addText('• Compressed contextual memories persist across all interactions', 9);
  addText('• Learns user habits, environment variables, and pet safety concerns', 9);
  addText('• Delivers deeply personalized advice that evolves with each conversation', 9);
  y += 3;
  addText('Proactive Intelligence:', 10, true);
  addText('• Scheduled check-ins and watering reminders based on plant-specific needs', 9);
  addText('• Seasonal care adjustments accounting for light/temperature changes', 9);
  addText('• Predictive diagnostics catch issues before visible symptoms appear', 9);

  addSectionHeader('FIG 3.0 — TARGET USERS');
  addBox('Primary: Plant beginners who want plants but fear killing them. Value: Confidence through education.');
  addBox('Secondary: Intermediate enthusiasts managing 5-20 plants. Value: Time-saving proactive care management.');
  addBox('Tertiary: Plant collectors seeking rare species identification. Value: Expert-level AI knowledge database.');

  addSectionHeader('FIG 4.0 — MARKET VALIDATION');
  
  addBarChart('Global Houseplant Market Growth ($B)', [
    { label: '2024', value: 18.5, maxValue: 25 },
    { label: '2026', value: 20.4, maxValue: 25 },
    { label: '2028', value: 22.6, maxValue: 25 }
  ]);
  
  addText('Global Houseplant Market:', 10, true);
  addText('• 2024 Market Size: $18.5B (US: $5.9B)', 9);
  addText('• 2028 Projection: $22.6B (US: $7.2B)', 9);
  addText('• CAGR 2024-2028: 5.2%', 9);
  addText('• 86M US households own plants', 9);
  y += 3;
  addText('User Demographics:', 10, true);
  addText('• 70% of millennials own houseplants', 9);
  addText('• 60% report plant care anxiety', 9);
  addText('• 57% of plant deaths: overwatering (solvable problem)', 9);
  y += 3;
  addText('Channel Advantage:', 10, true);
  addText('• WhatsApp: 3.14B monthly users, 98% open rate, 45-60% CTR', 9);
  addText('• iMessage: 1.2B users, 60% of US mobile messaging, 8.4B daily messages', 9);
  addText('• 90% of standalone apps abandoned within 30 days', 9);
  addText('• WhatsApp Business maintains 88%+ 30-day retention', 9);

  addSectionHeader('FIG 5.0 — TECHNOLOGY STACK');
  addText('AI Layer:', 10, true);
  addText('• Google Gemini 3 Flash (real-time responses) & Pro (complex reasoning)', 9);
  addText('• Perplexity Sonar (live web research for rare species)', 9);
  addText('• OpenRouter (API gateway for model orchestration)', 9);
  y += 2;
  addText('Backend Infrastructure:', 10, true);
  addText('• Supabase PostgreSQL: User data, plant profiles, interaction history', 9);
  addText('• Edge Functions: Serverless compute for AI orchestration', 9);
  addText('• Real-time subscriptions: Instant sync across devices', 9);
  addText('• Row-level security: User data isolation and privacy', 9);
  y += 2;
  addText('Frontend & Interface:', 10, true);
  addText('• React + TypeScript: Type-safe component architecture', 9);
  addText('• Tailwind CSS: Brutalist botanical design system', 9);
  addText('• Framer Motion: Fluid animations and transitions', 9);
  y += 2;
  addText('Messaging Integration:', 10, true);
  addText('• Twilio API: WhatsApp Business + SMS delivery', 9);
  addText('• Multi-modal support: Text, images, videos, voice notes', 9);
  addText('• Webhook architecture: Real-time message processing', 9);

  addPositioningDiagram();

  addSectionHeader('FIG 6.0 — IMPLEMENTATION ROADMAP');
  addText('Phase 1: Core AI Chat (4 weeks)', 10, true);
  addText('• Basic plant identification via Gemini 3 Vision', 9);
  addText('• Text-based Q&A with Perplexity integration', 9);
  addText('• Simple memory: Store basic plant profiles', 9);
  y += 2;
  addText('Phase 2: Memory & Personalization (3 weeks)', 10, true);
  addText('• Hierarchical memory system implementation', 9);
  addText('• Context compression for long conversations', 9);
  addText('• User preference learning (watering style, risk tolerance)', 9);
  y += 2;
  addText('Phase 3: Proactive Features (3 weeks)', 10, true);
  addText('• Scheduled reminders and check-ins', 9);
  addText('• Seasonal care adjustments', 9);
  addText('• Predictive health monitoring', 9);
  y += 2;
  addText('Phase 4: Polish & Scale (2 weeks)', 10, true);
  addText('• Performance optimization', 9);
  addText('• Multi-language support', 9);
  addText('• User testing and iteration', 9);

  addSectionHeader('FIG 7.0 — COMPETITIVE POSITIONING');
  addText('Orchid occupies the ideal quadrant: Maximum accessibility (messaging platforms) + Maximum intelligence (Gemini 3 + memory).', 10);
  y += 3;
  addText('Competitors:', 10, true);
  addText('• Plant Apps (Planta, etc): High friction (app download), moderate AI', 9);
  addText('• Websites: High friction, static guides with no personalization', 9);
  addText('• Basic Chatbots: Easy access but limited intelligence', 9);
  addText('• Google Search: Manual research required, no learning', 9);
  y += 3;
  addBox('Orchid Advantage: Only solution combining conversational memory, multi-modal AI, proactive intelligence, and zero-friction messaging interface.');

  addSectionHeader('FIG 8.0 — SUCCESS METRICS');
  addText('User Engagement:', 10, true);
  addText('• Target: 80%+ 7-day retention (vs 15% for standalone apps)', 9);
  addText('• Target: 3+ interactions per week', 9);
  addText('• Target: 60%+ users add 3+ plants within first month', 9);
  y += 2;
  addText('AI Performance:', 10, true);
  addText('• Target: 95%+ plant identification accuracy', 9);
  addText('• Target: <3 second response time', 9);
  addText('• Target: 85%+ user satisfaction with advice quality', 9);
  y += 2;
  addText('Social Impact:', 10, true);
  addText('• Reduce plant mortality rate by 40%', 9);
  addText('• Improve user confidence scores by 60%', 9);
  addText('• Create educational content for botanical literacy', 9);
  y += 3;
  addBox('This app is entirely free. No monetization plans. Mission: Democratize plant ownership and share my obsession with plants.');

  addSectionHeader('FIG 9.0 — DEMO PLAN');
  addText('Fair Demonstration:', 10, true);
  addText('• Live plant identification demo with audience photos', 9);
  addText('• Real-time Q&A showing memory persistence', 9);
  addText('• Health diagnosis of sample sick plant', 9);
  addText('• Proactive reminder scheduling demonstration', 9);
  y += 2;
  addText('Backup Plans:', 10, true);
  addText('• Pre-recorded video of full conversation flow', 9);
  addText('• Static slides with key features and architecture', 9);
  addText('• Local demo mode (no internet required)', 9);
  y += 5;

  // Closing statement box
  doc.setFillColor(0, 0, 0);
  doc.rect(margin, y, maxWidth, 20, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('I want everyone to share my obsession with plants.', margin + 5, y + 8);
  doc.text('Orchid makes that possible.', margin + 5, y + 15);
  y += 25;

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Contact: masudl@uw.edu  |  Website: orchid.masudlewis.com', margin, y);

  // Save the PDF
  doc.save('MSIS549_Proposal_MasudLewis_Orchid.pdf');
};

export function OrchidProposal() {
  const [demoOpen, setDemoOpen] = useState(false);
  const [showText, setShowText] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const conclusionVideoRef = useRef<HTMLVideoElement>(null);

  // Market data
  const marketSizeData = [
    { year: '2024', global: 18.5, us: 5.9 },
    { year: '2025', global: 19.4, us: 6.2 },
    { year: '2026', global: 20.4, us: 6.5 },
    { year: '2027', global: 21.5, us: 6.8 },
    { year: '2028', global: 22.6, us: 7.2 },
  ];

  const plantDeathCauses = [
    { name: 'Overwatering', value: 57, color: '#000000' },
    { name: 'Poor Light', value: 18, color: '#57534e' },
    { name: 'Underwatering', value: 12, color: '#78716c' },
    { name: 'Other', value: 13, color: '#a8a29e' },
  ];

  const appUsageComparison = [
    { metric: 'Daily Open Rate', standalone: 12, messaging: 95 },
    { metric: 'Avg Session Time (min)', standalone: 2.5, messaging: 8.3 },
    { metric: 'Weekly Engagement', standalone: 18, messaging: 82 },
    { metric: '30-Day Retention', standalone: 7, messaging: 88 },
  ];

  const retentionComparison = [
    { platform: 'Standalone Apps', day1: 100, day3: 23, day7: 15, day30: 7 },
    { platform: 'WhatsApp Business', day1: 100, day3: 95, day7: 92, day30: 88 },
  ];

  const aiAdoptionData = [
    { subject: 'Gen Z', A: 70, fullMark: 100 },
    { subject: 'Millennials', A: 62, fullMark: 100 },
    { subject: 'Gen X', A: 48, fullMark: 100 },
    { subject: 'Boomers', A: 35, fullMark: 100 },
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Demo Chat Overlay — archived, replaced by /demo page */}

      {/* Grid pattern background */}
      <div className="fixed inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url(#grid-pattern)' }} />
      
      {/* Hero with Video */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden border-b-2 border-black">
        {/* Video Background */}
        <div className="absolute inset-0 z-10">
          <div className="w-full h-full overflow-hidden">
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scale(1.15)', transformOrigin: 'center' }}
              onLoadedMetadata={(e) => {
                const video = e.currentTarget;
                video.currentTime = 8;
                setShowText(true);
              }}
            >
              <source src="/Darker_Aesthetic_Plant_Animation.mp4" type="video/mp4" />
            </video>
          </div>
          
          {/* Vignette */}
          <div 
            className="absolute inset-0" 
            style={{
              background: 'radial-gradient(circle at center, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.45) 100%)'
            }}
          />
          <div className="absolute inset-0 bg-black/25" />
        </div>

        {/* Content */}
        {showText && (
          <div className="relative z-40 text-left max-w-5xl mx-auto px-8 w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-block border-2 border-white px-4 py-1 mb-6 bg-white/10 backdrop-blur rounded-lg">
                <span className="font-mono text-xs uppercase tracking-widest text-white">
                  MSIS 549 • Individual Project Proposal
                </span>
              </div>
              
              <motion.h1
                className="text-7xl md:text-9xl font-serif leading-none text-white mb-2"
                style={{ textShadow: '0 4px 16px rgba(0,0,0,0.8)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.8 }}
              >
                ORCHID
              </motion.h1>
              
              <motion.p
                className="text-3xl md:text-5xl font-serif text-white mb-8"
                style={{ textShadow: '0 4px 12px rgba(0,0,0,0.6)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
              >
                Intelligent Botany
              </motion.p>
              
              <motion.p
                className="text-xl font-mono text-white/80 mb-8 max-w-2xl"
                style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.8 }}
              >
                AI-Powered Plant Care Agent via iMessage & WhatsApp
              </motion.p>
              
              <motion.div 
                className="flex gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
              >
                <button 
                  onClick={generateAndDownloadPDF}
                  className="px-6 py-3 border-2 border-white bg-white text-black font-mono text-sm uppercase tracking-wider hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)] rounded-lg flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Proposal
                </button>
                <button 
                  onClick={() => setDemoOpen(true)}
                  className="px-6 py-3 border-2 border-white bg-transparent text-white font-mono text-sm uppercase tracking-wider hover:bg-white hover:text-black transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] rounded-lg flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Try Live Demo
                </button>
              </motion.div>
            </motion.div>
          </div>
        )}
      </section>

      {/* Elevator Pitch */}
      <section className="border-b-2 border-black py-20 px-8 relative overflow-hidden">
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="inline-block border-2 border-black px-3 py-1 mb-6 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-lg">
            <span className="font-mono text-xs uppercase tracking-widest text-stone-500">
              FIG 0.1 — ELEVATOR PITCH
            </span>
          </div>
          
          <h2 className="text-5xl font-serif text-black mb-8">The Problem We Solve</h2>
          
          <div className="bg-black border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-lg p-8">
            <p className="font-mono text-lg text-white leading-relaxed">
              A lot of plant enthusiasts and beginners struggle with the <span className="italic">daily anxiety of plant care</span>—not knowing when to water, how to diagnose problems, or whether their plants are thriving—which costs them money on dead plants, missed opportunities for growth, and the heartbreak of failure.
            </p>
            
            <div className="h-px bg-white/20 my-6" />
            
            <p className="font-mono text-lg text-white leading-relaxed">
              So I built <span className="font-bold">Orchid</span>, an AI-powered plant care agent that helps them confidently care for their plants by proactively managing their collection, diagnosing issues in real-time, and learning their unique habits and environment.
            </p>
            
            <div className="h-px bg-white/20 my-6" />
            
            <p className="font-mono text-lg text-white leading-relaxed">
              Unlike Planta and other plant care apps, Orchid runs through <span className="italic">WhatsApp and iMessage</span>, eliminating "yet another app," and uses conversational AI with hierarchical memory to understand that no two plants—or plant parents—are the same.
            </p>
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="border-b-2 border-black py-20 px-8 bg-white relative overflow-hidden">
        {/* Background plant image with overlay */}
        <div className="absolute inset-0 opacity-5">
          <img 
            src="https://images.unsplash.com/photo-1466781783364-36c955e42a7f?w=1200&h=800&fit=crop" 
            alt="Plant background"
            className="w-full h-full object-cover"
          />
        </div>
        
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="inline-block border-2 border-black px-3 py-1 mb-6 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-lg">
            <span className="font-mono text-xs uppercase tracking-widest text-stone-500">
              FIG 1.0 — PROBLEM STATEMENT
            </span>
          </div>
          
          <h2 className="text-5xl font-serif text-black mb-8">Why This Matters</h2>
          
          <div className="prose max-w-none">
            <p className="font-mono text-base text-stone-700 leading-relaxed mb-6">
              I am obsessed with plants. Collecting them, growing them, taking care of them when they're unwell, and seeing my friends' glee when they observe my collection. At the same time, the unknown of caring for plants creates daily stress. My friends feel the same way. "I've killed x plant y times" is a common line. That conviction that they're unable to maintain plants, driven by the cost of not knowing how and when to care for them, creates a barrier to entry.
            </p>
            
            <div className="grid md:grid-cols-2 gap-6 my-12">
              {[
                {
                  title: 'Information Overload',
                  desc: 'Generic care guides don\'t account for individual environments, watering habits, or the specific needs of each plant',
                  Icon: BookOpen
                },
                {
                  title: 'Reactive Care',
                  desc: 'Users only seek help when problems arise, rather than receiving proactive guidance',
                  Icon: AlertCircle
                },
                {
                  title: 'App Fatigue',
                  desc: 'Existing solutions require downloading yet another standalone app, creating friction',
                  Icon: Smartphone
                },
                {
                  title: 'Lack of Personalization',
                  desc: 'Current tools don\'t learn from user behavior or remember plant-specific history',
                  Icon: UserX
                },
              ].map((issue, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="border-2 border-black rounded-lg p-6 bg-stone-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  <issue.Icon className="w-8 h-8 mb-3" strokeWidth={1.5} />
                  <h3 className="font-mono font-bold text-sm uppercase tracking-wide mb-2">{issue.title}</h3>
                  <p className="font-mono text-sm text-stone-600">{issue.desc}</p>
                </motion.div>
              ))}
            </div>
            
            <p className="font-mono text-base text-stone-700 leading-relaxed">
              This matters because plants improve mental health, air quality, and living spaces. The barrier to plant ownership shouldn't be information access—it should be joy and connection.
            </p>
          </div>
        </div>
      </section>

      {/* AI Technologies Section */}
      <section className="border-b-2 border-black py-20 px-8 bg-stone-100">
        <div className="max-w-5xl mx-auto">
          <div className="inline-block border-2 border-black px-3 py-1 mb-6 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-lg">
            <span className="font-mono text-xs uppercase tracking-widest text-stone-500">
              FIG 2.0 — TECHNICAL APPROACH
            </span>
          </div>
          
          <h2 className="text-5xl font-serif text-black mb-12">How AI Technologies Address This Problem</h2>
          
          <div className="space-y-8">
            {[
              {
                title: 'Multi-Modal AI (Gemini 3 & Perplexity Sonar)',
                icon: Eye,
                features: [
                  'Visual Identification: Users send photos via iMessage/WhatsApp; the AI identifies species with 98%+ accuracy',
                  'Health Diagnosis: Analyzes plant photos to detect diseases, pest infestations, nutrient deficiencies',
                  'Real-Time Research: Performs web research for rare species or complex issues'
                ]
              },
              {
                title: 'Hierarchical Memory System',
                icon: Brain,
                features: [
                  'Conversations summarized into compressed, contextual memories that persist across interactions',
                  'Remembers user habits (e.g., "light waterer"), environmental conditions, pet safety concerns',
                  'Creates deeply personalized advice: "Since Monsteras are drought-tolerant, they\'re actually a solid pick for you since you tend to underwater"'
                ]
              },
              {
                title: 'Proactive Intelligence',
                icon: Zap,
                features: [
                  'Sends seasonal tips, frost warnings, fertilization reminders based on location and patterns',
                  'Granular permission system lets users control autonomous actions',
                  'Weather-aware notifications prevent problems before they start'
                ]
              },
              {
                title: 'Conversational Interface',
                icon: MessageSquare,
                features: [
                  'All interactions happen through natural language on platforms users already use',
                  'No app downloads, no learning curve—just text your plant expert',
                  'Supports photos, videos, and voice messages'
                ]
              }
            ].map((tech, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white border-2 border-black rounded-lg p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
              >
                <div className="flex items-center gap-3 mb-4 border-b-2 border-black pb-2">
                  <tech.icon className="w-6 h-6" strokeWidth={2} />
                  <h3 className="font-mono font-bold text-lg uppercase tracking-wide">
                    {tech.title}
                  </h3>
                </div>
                <ul className="space-y-3">
                  {tech.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-black rounded-full mt-2 flex-shrink-0" />
                      <p className="font-mono text-sm text-stone-700">{feature}</p>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Detection Demo Section */}
      <section className="border-b-2 border-black py-20 px-8 bg-stone-50 relative overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <div className="inline-block border-2 border-black px-3 py-1 mb-6 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-lg">
            <span className="font-mono text-xs uppercase tracking-widest text-stone-500">
              FIG 2.1 — AI VISUAL IDENTIFICATION
            </span>
          </div>
          
          <h2 className="text-5xl font-serif text-black mb-4">See It. Know It.</h2>
          <p className="font-mono text-lg text-stone-700 mb-12 max-w-2xl">
            Multi-modal AI processes plant images and videos in real-time, identifying species, health issues, and care requirements with 98%+ accuracy.
          </p>
          
          <div className="grid md:grid-cols-3 gap-8">
            <PlantVision 
              plantName="Monstera"
              scientificName="Monstera deliciosa"
              folder="Monstera_Deliciosa"
              confidence="98.7% confidence"
              traits="Low maintenance • Pet toxic"
              delay={0}
            />
            
            <PlantVision 
              plantName="Bird of Paradise"
              scientificName="Strelitzia reginae"
              folder="Bird_of_paradise"
              confidence="98.9% confidence"
              traits="Bright light • Tropical beauty"
              delay={0.1}
            />
            
            <PlantVision 
              plantName="Fiddle Leaf Fig"
              scientificName="Ficus lyrata"
              folder="Fiddle_Leaf_Fig"
              confidence="97.2% confidence"
              traits="Bright indirect light • Trendy favorite"
              delay={0.2}
            />
          </div>

          <div className="mt-12 bg-black border-2 border-black rounded-lg p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <p className="font-mono text-4xl font-bold text-white mb-2">98%+</p>
                <p className="font-mono text-sm text-white/70">Identification Accuracy</p>
              </div>
              <div>
                <p className="font-mono text-4xl font-bold text-white mb-2">&lt;2s</p>
                <p className="font-mono text-sm text-white/70">Average Response Time</p>
              </div>
              <div>
                <p className="font-mono text-4xl font-bold text-white mb-2">5000+</p>
                <p className="font-mono text-sm text-white/70">Species Database</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Memory Visualization Section */}
      <section className="border-b-2 border-black py-20 px-8 bg-black text-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="inline-block border-2 border-white px-3 py-1 mb-6 bg-white/10 backdrop-blur rounded-lg">
            <span className="font-mono text-xs uppercase tracking-widest text-white">
              FIG 2.5 — MEMORY NETWORK
            </span>
          </div>
          
          <h2 className="text-5xl font-serif text-white mb-4">Memory That Learns</h2>
          <p className="font-mono text-lg text-white/70 mb-12 max-w-2xl">
            The more you chat, the smarter Orchid gets. Every conversation builds a richer understanding of you and your plants.
          </p>
          
          <div className="flex justify-center">
            <div className="w-full max-w-2xl aspect-square">
              <MemoryOrb />
            </div>
          </div>
        </div>
      </section>

      {/* Target Users */}
      <section className="border-b-2 border-black py-20 px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="inline-block border-2 border-black px-3 py-1 mb-6 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-lg">
            <span className="font-mono text-xs uppercase tracking-widest text-stone-500">
              FIG 3.0 — USER DEMOGRAPHICS
            </span>
          </div>
          
          <h2 className="text-5xl font-serif text-black mb-8">Target Users</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                tier: 'Primary',
                desc: 'Plant beginners who want plants but fear killing them',
                Icon: Sprout
              },
              {
                tier: 'Secondary',
                desc: 'Intermediate enthusiasts managing multiple plants who want optimization',
                Icon: Flower2
              },
              {
                tier: 'Tertiary',
                desc: 'Plant collectors seeking rare species identification and advanced diagnostics',
                Icon: TreeDeciduous
              }
            ].map((user, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="border-2 border-black rounded-lg p-6 bg-stone-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                <user.Icon className="w-10 h-10 mb-4 text-black" strokeWidth={1.5} />
                <p className="font-mono font-bold text-xs uppercase tracking-wider mb-2 text-stone-500">
                  {user.tier}
                </p>
                <p className="font-mono text-sm text-stone-700">{user.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* MARKET RESEARCH SECTION */}
      <section className="border-b-2 border-black py-32 px-8 bg-black text-white relative overflow-hidden">
        <EtchedFern className="absolute top-20 right-20 w-64 h-96 text-white opacity-5" />
        <EtchedMonstera className="absolute bottom-20 left-20 w-80 h-80 text-white opacity-5" />
        
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="inline-block border-2 border-white px-4 py-2 mb-8 bg-white/10 backdrop-blur rounded-lg">
            <span className="font-mono text-sm uppercase tracking-widest text-white">
              FIG 4.0 — MARKET VALIDATION & RESEARCH
            </span>
          </div>
          
          <h2 className="text-6xl font-serif text-white mb-6">The $20B Opportunity</h2>
          <p className="text-lg font-mono text-white/80 mb-16 max-w-3xl">
            Comprehensive market analysis validates Orchid's positioning at the intersection of a massive, growing market and systematic product failure.
          </p>

          {/* Market Size Chart */}
          <div className="bg-white border-2 border-white rounded-lg p-8 mb-12 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
            <h3 className="font-mono font-bold text-lg uppercase tracking-wide mb-2 text-black border-b-2 border-black pb-2">
              Global Houseplant Market Growth
            </h3>
            <p className="font-mono text-sm text-stone-600 mb-6">
              The market continues robust expansion at 4.5-5.5% CAGR, driven by wellness trends and urbanization
            </p>
            
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={marketSizeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6d3d1" />
                <XAxis dataKey="year" stroke="#000" style={{ fontFamily: 'monospace', fontSize: 12 }} />
                <YAxis stroke="#000" style={{ fontFamily: 'monospace', fontSize: 12 }} label={{ value: 'Billions USD', angle: -90, position: 'insideLeft', style: { fontFamily: 'monospace' } }} />
                <Tooltip 
                  contentStyle={{ 
                    border: '2px solid #000', 
                    borderRadius: '8px', 
                    fontFamily: 'serif',
                    boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)'
                  }} 
                />
                <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: 12 }} />
                <Bar dataKey="global" fill="#000000" name="Global Market" radius={[8, 8, 0, 0]} />
                <Bar dataKey="us" fill="#57534e" name="US Market" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t-2 border-stone-200">
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-1">2024 Market Size</p>
                <p className="font-mono text-2xl font-bold text-black">$18.5B</p>
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-1">CAGR 2024-2028</p>
                <p className="font-mono text-2xl font-bold text-black">5.2%</p>
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-1">US Households</p>
                <p className="font-mono text-2xl font-bold text-black">86M</p>
              </div>
            </div>
          </div>

          {/* Plant Death Causes - Pie Chart */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-white border-2 border-white rounded-lg p-8 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
              <h3 className="font-mono font-bold text-lg uppercase tracking-wide mb-2 text-black border-b-2 border-black pb-2">
                Why Plants Die
              </h3>
              <p className="font-mono text-sm text-stone-600 mb-6">
                57% of plant deaths are from overwatering—a solvable problem
              </p>
              
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={plantDeathCauses}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    stroke="#000"
                    strokeWidth={2}
                  >
                    {plantDeathCauses.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ border: '2px solid #000', borderRadius: '8px', fontFamily: 'serif' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white border-2 border-white rounded-lg p-8 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
              <h3 className="font-mono font-bold text-lg uppercase tracking-wide mb-6 text-black border-b-2 border-black pb-2">
                The Mortality Crisis
              </h3>
              
              <div className="space-y-4">
                {[
                  { stat: '35%', label: 'of houseplants die at home' },
                  { stat: '67%', label: 'of millennials call themselves "plant murderers"' },
                  { stat: '48%', label: 'worry about keeping plants alive' },
                  { stat: '7', label: 'average plants killed per millennial' }
                ].map((item, i) => (
                  <div key={i} className="flex items-baseline gap-4 border-b border-stone-200 pb-3">
                    <span className="text-4xl font-mono font-bold text-black">{item.stat}</span>
                    <span className="font-mono text-sm text-stone-600">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* App Engagement Comparison */}
          <div className="bg-white border-2 border-white rounded-lg p-8 mb-12 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
            <h3 className="font-mono font-bold text-lg uppercase tracking-wide mb-2 text-black border-b-2 border-black pb-2">
              App Engagement: Standalone vs. Messaging Platforms
            </h3>
            <p className="font-mono text-sm text-stone-600 mb-6">
              Messaging platforms dramatically outperform standalone apps across all engagement metrics
            </p>
            
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={appUsageComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6d3d1" />
                <XAxis dataKey="metric" stroke="#000" style={{ fontFamily: 'monospace', fontSize: 10 }} angle={-15} textAnchor="end" height={80} />
                <YAxis stroke="#000" style={{ fontFamily: 'monospace', fontSize: 12 }} />
                <Tooltip contentStyle={{ border: '2px solid #000', borderRadius: '8px', fontFamily: 'monospace' }} />
                <Legend wrapperStyle={{ fontFamily: 'monospace', fontSize: 12 }} />
                <Bar dataKey="standalone" fill="#57534e" name="Standalone Apps" radius={[8, 8, 0, 0]} />
                <Bar dataKey="messaging" fill="#000000" name="Messaging Platforms" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* The Channel Advantage: Card-Based Retention Comparison */}
          <div className="bg-white border-2 border-white rounded-lg p-8 mb-12 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
            <h3 className="font-mono font-bold text-lg uppercase tracking-wide mb-2 text-black border-b-2 border-black pb-2">
              The Channel Advantage: Apps vs. Messaging
            </h3>
            <p className="font-mono text-sm text-stone-600 mb-6">
              90% of apps are abandoned within 30 days—WhatsApp maintains 88%+ retention
            </p>
            
            {/* Retention Cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* Standalone Apps Card */}
              <div className="border-2 border-black rounded-lg p-6 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center gap-2 mb-6 pb-3 border-b-2 border-stone-200">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <svg className="w-4 h-4 text-stone-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h4 className="font-mono font-bold text-sm uppercase tracking-wider text-stone-700">Standalone Apps</h4>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                    <span className="font-mono text-sm text-stone-600">DAY 1</span>
                    <span className="font-mono text-lg font-bold text-black">100%</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                    <span className="font-mono text-sm text-stone-600">DAY 3</span>
                    <span className="font-mono text-2xl font-bold text-black">23%</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                    <span className="font-mono text-sm text-stone-600">DAY 7</span>
                    <span className="font-mono text-2xl font-bold text-black">15%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-sm text-stone-600">DAY 30</span>
                    <span className="font-mono text-2xl font-bold text-black">7%</span>
                  </div>
                </div>
              </div>

              {/* WhatsApp Business Card */}
              <div className="border-2 border-black rounded-lg p-6 bg-stone-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-center gap-2 mb-6 pb-3 border-b-2 border-stone-200">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="font-mono font-bold text-sm uppercase tracking-wider text-black">WhatsApp Business</h4>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                    <span className="font-mono text-sm text-stone-600">DAY 1</span>
                    <span className="font-mono text-lg font-bold text-black">100%</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                    <span className="font-mono text-sm text-stone-600">DAY 3</span>
                    <span className="font-mono text-2xl font-bold text-black">95%</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                    <span className="font-mono text-sm text-stone-600">DAY 7</span>
                    <span className="font-mono text-2xl font-bold text-black">92%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-sm text-stone-600">DAY 30</span>
                    <span className="font-mono text-2xl font-bold text-black">88%</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-6 pt-6 border-t-2 border-stone-200">
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-2">WhatsApp Metrics</p>
                <div className="space-y-1">
                  <p className="font-mono text-sm text-black"><span className="font-bold">3.14B</span> monthly active users</p>
                  <p className="font-mono text-sm text-black"><span className="font-bold">98%</span> message open rate</p>
                  <p className="font-mono text-sm text-black"><span className="font-bold">45-60%</span> click-through rate</p>
                </div>
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-2">iMessage Metrics</p>
                <div className="space-y-1">
                  <p className="font-mono text-sm text-black"><span className="font-bold">1.2B</span> active users</p>
                  <p className="font-mono text-sm text-black"><span className="font-bold">60%</span> of US mobile messaging</p>
                  <p className="font-mono text-sm text-black"><span className="font-bold">8.4B</span> daily messages</p>
                </div>
              </div>
            </div>
          </div>

          {/* AI Adoption Radar */}
          <div className="bg-white border-2 border-white rounded-lg p-8 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
            <h3 className="font-mono font-bold text-lg uppercase tracking-wide mb-2 text-black border-b-2 border-black pb-2">
              AI Adoption by Generation
            </h3>
            <p className="font-mono text-sm text-stone-600 mb-6">
              70%+ of Gen Z and 62% of Millennials have adopted AI—the adoption barrier has fallen
            </p>
            
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={aiAdoptionData}>
                <PolarGrid stroke="#d6d3d1" />
                <PolarAngleAxis dataKey="subject" stroke="#000" style={{ fontFamily: 'monospace', fontSize: 12 }} />
                <PolarRadiusAxis stroke="#000" style={{ fontFamily: 'monospace', fontSize: 12 }} />
                <Radar name="AI Adoption %" dataKey="A" stroke="#000000" fill="#000000" fillOpacity={0.6} />
                <Tooltip contentStyle={{ border: '2px solid #000', borderRadius: '8px', fontFamily: 'serif' }} />
              </RadarChart>
            </ResponsiveContainer>
            
            <div className="mt-6 pt-6 border-t-2 border-stone-200 grid grid-cols-2 gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-1">Conversational AI Market</p>
                <p className="font-mono text-2xl font-bold text-black">$16B</p>
                <p className="font-mono text-xs text-stone-600">Growing 20-29% annually</p>
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-stone-500 mb-1">AI Adoption Rate</p>
                <p className="font-mono text-2xl font-bold text-black">66%</p>
                <p className="font-mono text-xs text-stone-600">Of millennials use AI tools regularly</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Implementation Plan */}
      <section className="border-b-2 border-black py-20 px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="inline-block border-2 border-black px-3 py-1 mb-6 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-lg">
            <span className="font-mono text-xs uppercase tracking-widest text-stone-500">
              FIG 5.0 — IMPLEMENTATION PLAN
            </span>
          </div>
          
          <h2 className="text-5xl font-serif text-black mb-12">Technical Architecture</h2>
          
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-stone-50 border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-mono font-bold text-sm uppercase tracking-wide mb-4 border-b-2 border-black pb-2">
                Primary Interface
              </h3>
              <p className="font-mono text-sm text-stone-700 mb-4">
                Conversational AI via Twilio (WhatsApp, SMS)
              </p>
              <div className="space-y-2">
                {['Natural language understanding', 'Multi-modal input (photo, video, voice)', 'Real-time diagnosis', 'Proactive notifications'].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-black rounded-full mt-1.5 flex-shrink-0" />
                    <p className="font-mono text-xs text-stone-600">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-stone-50 border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-mono font-bold text-sm uppercase tracking-wide mb-4 border-b-2 border-black pb-2">
                Secondary Interface
              </h3>
              <p className="font-mono text-sm text-stone-700 mb-4">
                React web dashboard for advanced management
              </p>
              <div className="space-y-2">
                {['Plant collection overview', 'Activity logs & analytics', 'Agent settings & permissions', 'Memory visualization'].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-black rounded-full mt-1.5 flex-shrink-0" />
                    <p className="font-mono text-xs text-stone-600">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-black border-2 border-black rounded-lg p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-12">
            <h3 className="font-mono font-bold text-lg uppercase tracking-wide mb-6 text-white border-b-2 border-white pb-2">
              Technology Stack
            </h3>
            
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  category: 'AI Layer',
                  items: ['Google Gemini 3 Flash & Pro', 'Perplexity Sonar', 'OpenRouter API Gateway']
                },
                {
                  category: 'Backend',
                  items: ['Supabase PostgreSQL', 'Edge Functions', 'Authentication & Storage']
                },
                {
                  category: 'Frontend',
                  items: ['React + TypeScript', 'Tailwind CSS', 'Framer Motion']
                }
              ].map((stack, i) => (
                <div key={i}>
                  <p className="font-mono text-xs uppercase tracking-wider text-white/60 mb-3">{stack.category}</p>
                  <div className="space-y-2">
                    {stack.items.map((item, j) => (
                      <p key={j} className="font-mono text-sm text-white">{item}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-stone-50 border-2 border-black rounded-lg p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <h3 className="font-mono font-bold text-lg uppercase tracking-wide mb-6 text-black border-b-2 border-black pb-2">
              Development Phases
            </h3>
            
            <div className="space-y-4">
              {[
                { phase: 'Phase 1', status: 'Completed', desc: 'Core agent with plant identification, diagnosis, and conversational memory' },
                { phase: 'Phase 2', status: 'Completed', desc: 'Web dashboard with onboarding flow, plant collection management, and settings' },
                { phase: 'Phase 3', status: 'Current', desc: 'Proactive messaging system with seasonal tips and health check-ins' },
                { phase: 'Phase 4', status: 'Fair Prep', desc: 'Visual guide generation, shopping integration, and demo polish' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 pb-4 border-b border-stone-200 last:border-0">
                  <div className={`px-3 py-1 rounded border-2 border-black font-mono text-xs uppercase tracking-wider ${
                    item.status === 'Completed' ? 'bg-black text-white' : 
                    item.status === 'Current' ? 'bg-white text-black' : 
                    'bg-stone-200 text-stone-600'
                  }`}>
                    {item.status}
                  </div>
                  <div className="flex-1">
                    <p className="font-mono font-bold text-sm mb-1">{item.phase}</p>
                    <p className="font-mono text-sm text-stone-600">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Demo Concept */}
      <section className="border-b-2 border-black py-20 px-8 bg-stone-100">
        <div className="max-w-5xl mx-auto">
          <div className="inline-block border-2 border-black px-3 py-1 mb-6 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-lg">
            <span className="font-mono text-xs uppercase tracking-widest text-stone-500">
              FIG 6.0 — FAIR DEMONSTRATION
            </span>
          </div>
          
          <h2 className="text-5xl font-serif text-black mb-8">GenAI & Agentic Fair Demo</h2>
          
          <div className="bg-white border-2 border-black rounded-lg p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] mb-8">
            <h3 className="font-mono font-bold text-lg uppercase tracking-wide mb-4 border-b-2 border-black pb-2">
              Demo Setup (3-5 minutes per visitor)
            </h3>
            
            <div className="space-y-6">
              <div>
                <p className="font-mono font-bold text-sm uppercase tracking-wider mb-2 text-stone-500">Hook (30 seconds)</p>
                <p className="font-mono text-sm text-stone-700">
                  Show sick plant photo → send to Orchid via WhatsApp → instant diagnosis appears on phone. "This is Orchid. It's your personal plant care expert that lives in your messages."
                </p>
              </div>

              <div>
                <p className="font-mono font-bold text-sm uppercase tracking-wider mb-2 text-stone-500">Key Feature Showcase (2 minutes)</p>
                <ul className="space-y-2">
                  {[
                    'Identification: Send photo of mystery plant → AI identifies species, toxicity, care difficulty',
                    'Memory Intelligence: Show "Memory Orb" visualization of user context',
                    'Personalized Advice: Show how AI tailors responses based on history',
                    'Proactive Care: Display notification examples (frost warnings, seasonal tips)'
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-black rounded-full mt-1.5 flex-shrink-0" />
                      <p className="font-mono text-sm text-stone-700">{item}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-mono font-bold text-sm uppercase tracking-wider mb-2 text-stone-500">Physical Props</p>
                <p className="font-mono text-sm text-stone-700">
                  Printed botanical illustrations, small potted plant, "Before/After" photos of plant recovery, QR code for demo WhatsApp number
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-black border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-mono font-bold text-sm uppercase tracking-wide mb-4 text-white border-b-2 border-white pb-2">
                Key Strengths to Highlight
              </h3>
              <ul className="space-y-2">
                {[
                  'No app download required',
                  'Hierarchical memory system',
                  'Real-world impact on plant survival',
                  'Serverless scalability'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-white rounded-full mt-1.5 flex-shrink-0" />
                    <p className="font-serif text-sm text-white">{item}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-black border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-mono font-bold text-sm uppercase tracking-wide mb-4 text-white border-b-2 border-white pb-2">
                Backup Plan
              </h3>
              <ul className="space-y-2">
                {[
                  'Pre-recorded video walkthrough (2 min)',
                  'Screenshot deck of key interactions',
                  'Offline web dashboard with sample data',
                  'Printed conversation examples'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-white rounded-full mt-1.5 flex-shrink-0" />
                    <p className="font-serif text-sm text-white">{item}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Success Metrics */}
      <section className="border-b-2 border-black py-20 px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="inline-block border-2 border-black px-3 py-1 mb-6 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-lg">
            <span className="font-mono text-xs uppercase tracking-widest text-stone-500">
              FIG 7.0 — SUCCESS MATRIX
            </span>
          </div>
          
          <h2 className="text-5xl font-serif text-black mb-4">Why Orchid Will Succeed</h2>
          <p className="font-mono text-lg text-stone-700 mb-12 max-w-3xl">
            Orchid occupies the only position that matters: maximum accessibility combined with maximum intelligence.
          </p>
          
          {/* Competitive Positioning Chart */}
          <div className="bg-white border-2 border-black rounded-lg p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <ResponsiveContainer width="100%" height={520}>
                <ScatterChart margin={{ top: 10, right: 40, bottom: 40, left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6d3d1" />
                <XAxis 
                  type="number" 
                  dataKey="friction" 
                  domain={[0, 10]} 
                  stroke="#000"
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                  label={{ 
                    value: 'Platform Friction (High → Low)', 
                    position: 'insideBottom',
                    offset: -15,
                    style: { fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold' } 
                  }}
                />
                <YAxis 
                  type="number" 
                  dataKey="intelligence" 
                  domain={[0, 10]} 
                  stroke="#000"
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                  label={{ 
                    value: 'AI Intelligence &\nPersonalization\n(Low → High)', 
                    angle: -90,
                    position: 'insideLeft',
                    offset: 0,
                    style: { fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', textAnchor: 'middle' } 
                  }}
                />
                <ZAxis range={[400, 400]} />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ 
                    border: '2px solid #000', 
                    borderRadius: '8px', 
                    fontFamily: 'monospace',
                    boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)'
                  }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white border-2 border-black rounded-lg p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                          <p className="font-mono font-bold text-sm mb-1">{data.name}</p>
                          <p className="font-mono text-xs text-stone-600">{data.description}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter 
                  name="Solutions" 
                  data={[
                    { 
                      name: 'Plant Apps', 
                      shortName: 'Plant Apps',
                      friction: 2, 
                      intelligence: 5,
                      description: 'High friction, moderate AI'
                    },
                    { 
                      name: 'Websites', 
                      shortName: 'Websites',
                      friction: 1, 
                      intelligence: 2,
                      description: 'Static guides, no personalization'
                    },
                    { 
                      name: 'Chatbots', 
                      shortName: 'Chatbots',
                      friction: 7, 
                      intelligence: 3,
                      description: 'Easy access, limited intelligence'
                    },
                    { 
                      name: 'Google', 
                      shortName: 'Google',
                      friction: 4, 
                      intelligence: 1,
                      description: 'Requires manual research'
                    },
                    { 
                      name: 'ORCHID', 
                      shortName: 'ORCHID',
                      friction: 9, 
                      intelligence: 9,
                      description: 'Messaging platform + Gemini 3 + Memory',
                      isOrchid: true
                    }
                  ]} 
                  fill="#57534e"
                  shape={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (payload.isOrchid) {
                      // Orchid gets a flower icon with label
                      return (
                        <g>
                          {/* Flower petals */}
                          <circle cx={cx} cy={cy - 12} r={6} fill="#000" stroke="#000" strokeWidth={2} />
                          <circle cx={cx + 10} cy={cy - 6} r={6} fill="#000" stroke="#000" strokeWidth={2} />
                          <circle cx={cx + 10} cy={cy + 6} r={6} fill="#000" stroke="#000" strokeWidth={2} />
                          <circle cx={cx} cy={cy + 12} r={6} fill="#000" stroke="#000" strokeWidth={2} />
                          <circle cx={cx - 10} cy={cy + 6} r={6} fill="#000" stroke="#000" strokeWidth={2} />
                          <circle cx={cx - 10} cy={cy - 6} r={6} fill="#000" stroke="#000" strokeWidth={2} />
                          {/* Center */}
                          <circle cx={cx} cy={cy} r={8} fill="#000" stroke="#000" strokeWidth={2} />
                          {/* Label to the right */}
                          <text 
                            x={cx + 25} 
                            y={cy + 5} 
                            textAnchor="start" 
                            fill="#000" 
                            style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold' }}
                          >
                            {payload.shortName}
                          </text>
                        </g>
                      );
                    }
                    // Others get gray circles with labels
                    return (
                      <g>
                        <circle 
                          cx={cx} 
                          cy={cy} 
                          r={12} 
                          fill="#57534e" 
                          stroke="#000" 
                          strokeWidth={2}
                        />
                        {/* Label next to circle */}
                        <text 
                          x={cx + 18} 
                          y={cy + 4} 
                          textAnchor="start" 
                          fill="#000" 
                          style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold' }}
                        >
                          {payload.shortName}
                        </text>
                      </g>
                    );
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
            
            {/* Legend */}
            <div className="mt-6 pt-6 border-t-2 border-stone-200 grid md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-mono font-bold text-xs uppercase tracking-wider text-stone-500 mb-2">Market Opportunity</h4>
                <ul className="space-y-1">
                  <li className="font-mono text-xs text-black">$20B+ global market</li>
                  <li className="font-mono text-xs text-black">70% millennials own plants</li>
                  <li className="font-mono text-xs text-black">60% report anxiety</li>
                </ul>
              </div>
              <div>
                <h4 className="font-mono font-bold text-xs uppercase tracking-wider text-stone-500 mb-2">Technical Edge</h4>
                <ul className="space-y-1">
                  <li className="font-mono text-xs text-black">Conversational memory</li>
                  <li className="font-mono text-xs text-black">Multi-modal AI (Gemini 3)</li>
                  <li className="font-mono text-xs text-black">Proactive intelligence</li>
                </ul>
              </div>
              <div>
                <h4 className="font-mono font-bold text-xs uppercase tracking-wider text-stone-500 mb-2">Social Impact</h4>
                <ul className="space-y-1">
                  <li className="font-mono text-xs text-black">Reduces plant waste</li>
                  <li className="font-mono text-xs text-black">Mental health benefits</li>
                  <li className="font-mono text-xs text-black">Free for everyone</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Conclusion */}
      <section className="relative py-20 px-8 overflow-hidden border-b-2 border-black">
        {/* Video Background for Conclusion */}
        <div className="absolute inset-0 z-0">
          <div className="w-full h-full overflow-hidden">
            <video
              ref={conclusionVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scale(1.15)', transformOrigin: 'center' }}
              onLoadedMetadata={() => {
                if (conclusionVideoRef.current) {
                  conclusionVideoRef.current.currentTime = 8;
                  conclusionVideoRef.current.pause();
                }
              }}
            >
              <source src="/Darker_Aesthetic_Plant_Animation.mp4" type="video/mp4" />
            </video>
          </div>
          <div 
            className="absolute inset-0" 
            style={{
              background: 'radial-gradient(circle at center, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.7) 100%)'
            }}
          />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <h2 className="text-5xl font-serif text-white mb-6" style={{ textShadow: '0 4px 16px rgba(0,0,0,0.8)' }}>
            I want everyone to share my obsession with plants.
          </h2>
          <p className="text-2xl font-mono text-white/90 mb-12" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
            Orchid makes that possible.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={generateAndDownloadPDF}
              className="px-8 py-4 border-2 border-white bg-white text-black font-mono text-sm uppercase tracking-wider hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)] rounded-lg"
            >
              Download Proposal
            </button>
            <button 
              onClick={() => setDemoOpen(true)}
              className="px-8 py-4 border-2 border-white bg-transparent text-white font-mono text-sm uppercase tracking-wider hover:bg-white hover:text-black transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] rounded-lg"
            >
              Try Orchid Now
            </button>
          </div>
        </div>
      </section>

      {/* SVG Patterns */}
      <svg className="absolute w-0 h-0">
        <defs>
          <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-stone-200" />
          </pattern>
        </defs>
      </svg>
    </div>
  );
}

export default OrchidProposal;
