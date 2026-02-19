import { motion } from 'framer-motion';
import { useState } from 'react';
import { EtchedFern, EtchedMonstera, EtchedPalm, EtchedLeaf } from './BrutalistPatterns';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { MemoryOrb } from './MemoryOrb';
// DemoChatOverlay archived — replaced by /demo page (see DEMO_PAGE_SPEC.md)

// Typing indicator component
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1">
      <motion.div
        style={{ width: '6px', height: '6px', backgroundColor: '#57534e' }}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        style={{ width: '6px', height: '6px', backgroundColor: '#57534e' }}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
      />
      <motion.div
        style={{ width: '6px', height: '6px', backgroundColor: '#57534e' }}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />
    </div>
  );
}

// Simple map SVG component
function SimpleMapIllustration() {
  return (
    <svg viewBox="0 0 300 150" className="w-full h-auto mb-4 border-2 border-white/20 rounded-lg bg-stone-800/50">
      {/* Grid lines */}
      <defs>
        <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      
      {/* Roads */}
      <path d="M 0 75 L 300 75" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
      <path d="M 150 0 L 150 150" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
      <path d="M 50 0 L 50 150" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <path d="M 250 0 L 250 150" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      
      {/* You marker */}
      <circle cx="180" cy="85" r="8" fill="white" stroke="black" strokeWidth="2" />
      <text x="180" y="89" textAnchor="middle" fontSize="8" fontWeight="bold" fill="black">Y</text>
      <text x="180" y="105" textAnchor="middle" fontSize="8" fill="white" fontFamily="monospace">YOU</text>
      
      {/* Store pins */}
      <g>
        <circle cx="80" cy="60" r="6" fill="#22c55e" stroke="white" strokeWidth="1.5" />
        <text x="80" y="63" textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">1</text>
      </g>
      <g>
        <circle cx="130" cy="95" r="6" fill="#22c55e" stroke="white" strokeWidth="1.5" />
        <text x="130" y="98" textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">2</text>
      </g>
      <g>
        <circle cx="220" cy="45" r="6" fill="#78716c" stroke="white" strokeWidth="1.5" />
        <text x="220" y="48" textAnchor="middle" fontSize="7" fontWeight="bold" fill="white">3</text>
      </g>
    </svg>
  );
}

interface FeatureBentoProps {
  onStartGrowing?: () => void;
}

export function FeatureBento({ onStartGrowing }: FeatureBentoProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<'identification' | 'diagnosis' | 'guides' | 'shopping' | 'general'>('general');

  const openDemoChat = (context: typeof chatContext) => {
    setChatContext(context);
    setChatOpen(true);
  };

  return (
    <section className="min-h-screen bg-stone-50 py-32 overflow-hidden border-b-2 border-black">
      {/* Demo Chat Overlay — archived, replaced by /demo page */}
      {/* Grid pattern background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'url(#grid-pattern)' }} />
      
      <div className="max-w-7xl mx-auto px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div className="inline-block border-2 border-black px-4 py-1 mb-6 bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-lg">
            <span className="font-mono text-xs uppercase tracking-widest text-stone-500">
              SYSTEM CAPABILITIES
            </span>
          </div>
          <h2 className="text-5xl md:text-7xl font-serif text-black mb-4">
            Plant care, without the guesswork
          </h2>
        </div>

        {/* Feature Collage - Botanical Brutalist Style */}
        <div className="space-y-32">
          {/* Feature 1: Instant Identification */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1 }}
            className="relative"
          >
            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* iMessage mockup */}
              <motion.div
                initial={{ x: -40, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.8 }}
                className="relative order-2 md:order-1"
              >
                {/* Technical annotation */}
                <div className="absolute -top-8 left-0 font-mono text-xs uppercase tracking-widest text-stone-400">
                  FIG 2.1 - SPECIES IDENTIFICATION
                </div>
                
                <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-lg p-6">
                  {/* iMessage header */}
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-stone-200">
                    <div className="w-10 h-10 bg-black border-2 border-black rounded-lg flex items-center justify-center text-white font-serif font-bold">V</div>
                    <div>
                      <p className="font-mono font-bold text-sm uppercase">Orchid</p>
                      <p className="font-mono text-xs text-stone-500">iMessage</p>
                    </div>
                  </div>
                  
                  {/* Messages */}
                  <div className="space-y-1.5">
                    {/* User sends photo */}
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.4, duration: 0.6 }}
                      className="flex justify-end"
                    >
                      <div className="max-w-[70%]">
                        <div className="border-2 border-black rounded-lg p-2 bg-stone-100">
                          <ImageWithFallback 
                            src="https://images.unsplash.com/photo-1653404809389-f370ea4310dd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb25zdGVyYSUyMGRlbGljaW9zYSUyMHBsYW50fGVufDF8fHx8MTc2OTE4MzM5OHww&ixlib=rb-4.1.0&q=80&w=1080"
                            alt="Monstera plant"
                            className="w-40 h-40 object-cover rounded-lg"
                          />
                        </div>
                      </div>
                    </motion.div>
                    
                    {/* User text */}
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.6, duration: 0.6 }}
                      className="flex justify-end"
                    >
                      <div className="max-w-[70%]">
                        <div className="bg-black text-white border-2 border-black rounded-lg px-4 py-2">
                          <p className="font-mono text-sm">What plant is this?</p>
                        </div>
                        <p className="text-right text-[10px] font-mono text-stone-400 uppercase tracking-wider px-2 mt-1">10:32 AM</p>
                      </div>
                    </motion.div>
                    
                    {/* Typing indicator */}
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.9, duration: 0.4 }}
                      className="flex justify-start"
                    >
                      <motion.div
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 0 }}
                        transition={{ delay: 1.4, duration: 0.3 }}
                        className="bg-white border-2 border-black rounded-lg px-4 py-3"
                      >
                        <TypingIndicator />
                      </motion.div>
                    </motion.div>
                    
                    {/* Bot response - expanded */}
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 2.3, duration: 0.6 }}
                      className="flex justify-start"
                    >
                      <div className="max-w-[85%]">
                        <div className="bg-white border-2 border-black rounded-lg px-4 py-3 space-y-3">
                          <div>
                            <p className="font-mono font-bold text-sm">MONSTERA DELICIOSA</p>
                            <p className="font-serif text-xs text-stone-500">Swiss Cheese Plant</p>
                            <div className="flex gap-2 mt-2">
                              <span className="text-[10px] bg-black text-white px-2 py-0.5 font-mono rounded">98% MATCH</span>
                              <span className="text-[10px] bg-stone-100 text-black px-2 py-0.5 font-mono border border-black rounded">TROPICAL</span>
                            </div>
                          </div>
                          
                          <p className="font-serif text-sm text-stone-700 leading-relaxed">
                            Since Monsteras are drought-tolerant, they're actually a solid pick for you since you tend to underwater (no shade).
                          </p>
                          
                          <div className="bg-stone-50 border border-black rounded-lg p-2">
                            <p className="font-mono text-xs text-stone-700">
                              Heads up: toxic to cats. I've got placement ideas to keep Ellie safe.
                            </p>
                          </div>
                          
                          <p className="font-serif text-sm text-stone-600">
                            Want me to add this to your collection?
                          </p>
                        </div>
                        <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider px-2 mt-1">10:33 AM</p>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
              
              {/* Text content */}
              <motion.div
                initial={{ x: 40, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="order-1 md:order-2 relative"
              >
                {/* Etched illustration background */}
                <EtchedLeaf className="absolute -top-12 -right-12 w-32 h-32 text-stone-200 hidden md:block" />
                
                <h3 className="text-5xl font-serif leading-tight mb-4 text-black">
                  Instant<br/>Identification
                </h3>
                <p className="text-xl font-serif italic text-stone-600 mb-4">
                  Snap a photo. Know your plant.
                </p>
                <p className="font-mono text-sm text-stone-700 leading-relaxed max-w-xl mb-6">
                  Send a photo or a video via iMessage and receive instant species identification with personalized context—care tips based on your habits, pet safety alerts, and more.
                </p>
                
                {/* Try without signing in button */}
                <button
                  onClick={() => openDemoChat('identification')}
                  className="px-6 py-3 border-2 border-black bg-white font-mono text-sm uppercase tracking-wider hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 rounded-lg"
                >
                  Try without signing in →
                </button>
              </motion.div>
            </div>
          </motion.div>

          {/* Feature 2: Diagnosis & Treatment */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1 }}
            className="relative"
          >
            <div className="grid md:grid-cols-12 gap-8">
              {/* Text column */}
              <div className="md:col-span-4 flex flex-col justify-center relative">
                <div className="absolute -top-8 left-0 font-mono text-xs uppercase tracking-widest text-stone-400">
                  FIG 2.2 - DIAGNOSTIC PROTOCOL
                </div>
                
                <EtchedMonstera className="absolute -bottom-12 -left-8 w-24 h-24 text-stone-200 hidden md:block" />
                
                <h3 className="text-5xl font-serif leading-tight mb-4 text-black">
                  Diagnosis &<br/>Treatment
                </h3>
                <p className="text-xl font-serif italic text-stone-600 mb-4">
                  Something wrong? We'll figure it out.
                </p>
                <p className="font-mono text-sm text-stone-700 leading-relaxed mb-6">
                  Text a photo of yellowing leaves, spots, or pests. Orchid recognizes plants in your collection, considers the weather, and provides a diagnosis with treatment steps.
                </p>
                
                {/* Try without signing in button */}
                <button
                  onClick={() => openDemoChat('diagnosis')}
                  className="px-6 py-3 border-2 border-black bg-white font-mono text-sm uppercase tracking-wider hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 rounded-lg"
                >
                  Try without signing in →
                </button>
              </div>
              
              {/* iMessage conversation */}
              <div className="md:col-span-8 bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-lg p-6">
                <div className="space-y-1.5">
                  {/* User sends photo of sick plant */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    className="flex justify-end"
                  >
                    <div className="max-w-[75%]">
                      <div className="border-2 border-black rounded-lg p-2 mb-2 bg-stone-100">
                        <ImageWithFallback 
                          src="https://images.unsplash.com/photo-1723969512049-3cfc16c353af?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaWNrJTIwcGxhbnQlMjB5ZWxsb3clMjBsZWF2ZXN8ZW58MXx8fHwxNzY5MjgwMzY1fDA&ixlib=rb-4.1.0&q=80&w=1080"
                          alt="Plant with yellow leaves"
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                      </div>
                      <div className="bg-black text-white border-2 border-black rounded-lg px-4 py-2">
                        <p className="font-mono text-sm">What's going on with this?</p>
                      </div>
                      <p className="text-right text-[10px] font-mono text-stone-400 uppercase tracking-wider px-2 mt-1">2:15 PM</p>
                    </div>
                  </motion.div>
                  
                  {/* Bot recognition and diagnosis */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6, duration: 0.6 }}
                    className="flex justify-start"
                  >
                    <div className="max-w-[90%]">
                      <div className="bg-white border-2 border-black rounded-lg px-4 py-3">
                        <p className="font-serif text-sm text-stone-700 leading-relaxed">
                          It looks like <span className="font-bold">Monty</span>, your Monstera deliciosa from the living room, may be underwatered. Yellow leaves on Monsteras could point to either underwatering <span className="italic">or</span> overwatering—but given that it's been around 45°F for the past few weeks in Seattle (and you're a light waterer), it's probably underwatering.
                        </p>
                        
                        {/* Confirmation tip box */}
                        <div className="bg-stone-50 border border-black rounded-lg p-2 mt-3">
                          <p className="font-mono text-xs text-stone-600">
                            <span className="font-bold uppercase">To confirm:</span> check if the soil feels dry an inch or two down. If it's bone dry, we've got our answer.
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  
                  {/* Bot response 2: Treatment */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.9, duration: 0.6 }}
                    className="flex justify-start"
                  >
                    <div className="max-w-[90%]">
                      <div className="bg-white border-2 border-black rounded-lg px-4 py-3">
                        <p className="font-serif text-sm text-stone-700 leading-relaxed">
                          But don't panic—this is fixable.
                        </p>
                        
                        {/* Treatment steps */}
                        <div className="mt-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 bg-black text-white rounded flex items-center justify-center text-xs font-mono font-bold flex-shrink-0">1</span>
                            <p className="font-serif text-sm text-stone-700">Give Monty a good, deep watering until water drains from the bottom.</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="w-5 h-5 bg-black text-white rounded flex items-center justify-center text-xs font-mono font-bold flex-shrink-0">2</span>
                            <p className="font-serif text-sm text-stone-700">Going forward, water when the top 2 inches of soil are dry.</p>
                          </div>
                        </div>
                        
                        <p className="font-serif text-sm text-stone-600 mt-3 pt-3 border-t border-stone-200">
                          I'll also start prompting you to water Monty based on the weather and your usual watering pattern, so this doesn't happen again.
                        </p>
                      </div>
                      <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider px-2 mt-1">2:16 PM</p>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Feature 3: Memory That Learns - REDESIGNED */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1 }}
            className="relative"
          >
            <div className="flex flex-col gap-8">
              {/* Text content - top */}
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.8 }}
                className="text-center"
              >
                <div className="inline-block font-mono text-xs uppercase tracking-widest text-stone-400 mb-4">
                  FIG 2.3 - ADAPTIVE MEMORY
                </div>
                
                <h3 className="text-5xl font-serif leading-tight mb-4 text-black">
                  Memory That Learns
                </h3>
                <p className="text-xl font-serif italic text-stone-600">
                  The more you chat, the smarter it gets.
                </p>
              </motion.div>
              
              {/* Holographic Memory Orb visualization - full width */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="relative"
              >
                <div className="bg-black border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-lg h-[500px] md:h-[600px] w-full overflow-hidden relative">
                  {/* Canvas visualization */}
                  <MemoryOrb />
                  
                  {/* Corner label */}
                  <div className="absolute bottom-3 left-3 font-mono text-[9px] text-white/30 uppercase tracking-wider">
                    MEMORY NETWORK
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Feature 4: Proactive Intelligence - REDESIGNED */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1 }}
            className="relative"
          >
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ x: -40, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.8 }}
              >
                <div className="absolute -top-8 left-0 font-mono text-xs uppercase tracking-widest text-stone-400">
                  FIG 2.4 - PREDICTIVE ALERTS
                </div>
                
                <h3 className="text-5xl font-serif leading-tight mb-4 text-black">
                  Proactive<br/>Intelligence
                </h3>
                <p className="text-xl font-serif italic text-stone-600 mb-4">
                  We think ahead so you don't have to.
                </p>
                <p className="font-mono text-sm text-stone-700 leading-relaxed">
                  Orchid messages you with weather alerts, seasonal tips, and check-ins—before problems start. You control what notifications you receive.
                </p>
              </motion.div>
              
              <div className="relative">
                <EtchedPalm className="absolute -top-8 -right-8 w-32 h-32 text-stone-200 hidden md:block" />
                
                <div className="space-y-4 relative z-10">
                  {[
                    { time: '2 HOURS AGO', title: 'FROST WARNING', message: 'Temps dropping to 34°F tonight. Bring your patio plants inside!', urgent: true },
                    { time: '5 DAYS AGO', title: 'CHECK-IN', message: "How's Monty recovering from the underwatering? Any new growth yet?", urgent: false },
                    { time: '7 DAYS AGO', title: 'SEASONAL TIP', message: 'Spring is here! Your succulents will appreciate their first fertilizer of the season.', urgent: false }
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ y: 30, opacity: 0 }}
                      whileInView={{ y: 0, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.4 + i * 0.15, duration: 0.6 }}
                      className={`border-2 border-black rounded-lg overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${item.urgent ? 'bg-black' : 'bg-white'}`}
                    >
                      <div className="p-4">
                        {/* Header row with V logo, title, and time */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-serif font-bold text-sm ${item.urgent ? 'bg-white text-black' : 'bg-black text-white'}`}>V</div>
                            <span className={`font-mono font-bold text-xs uppercase tracking-wide ${item.urgent ? 'text-white' : 'text-black'}`}>{item.title}</span>
                          </div>
                          <span className={`text-[10px] font-mono uppercase tracking-wider ${item.urgent ? 'text-white/60' : 'text-stone-400'}`}>{item.time}</span>
                        </div>
                        {/* Message */}
                        <p className={`font-serif text-base leading-relaxed ${item.urgent ? 'text-white' : 'text-stone-700'}`}>
                          {item.message}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Feature 5: Local Shopping - REDESIGNED */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1 }}
            className="relative"
          >
            <div className="bg-black border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-lg p-8 md:p-12">
              <div className="absolute -top-8 left-8 font-mono text-xs uppercase tracking-widest text-stone-400 bg-stone-50 rounded px-2 py-1">
                FIG 2.5 - LOCAL COMMERCE
              </div>
              
              <EtchedFern className="absolute -bottom-12 right-0 w-48 h-64 text-white opacity-5" />
              
              <div className="grid md:grid-cols-2 gap-8 relative z-10">
                {/* Left - text and map */}
                <motion.div
                  initial={{ y: 30, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                  className="flex flex-col justify-center"
                >
                  <h3 className="text-5xl font-serif leading-tight text-white mb-4">
                    Local<br/>Shopping
                  </h3>
                  <p className="text-xl font-serif italic text-white/80 mb-3">
                    Find what you need, nearby.
                  </p>
                  <p className="font-mono text-sm text-white/70 leading-relaxed mb-6">
                    Ask where to buy supplies. Orchid finds local nurseries with verified stock. Can't find it locally? We'll search online options too.
                  </p>
                  
                  {/* Try without signing in button */}
                  <button
                    onClick={() => openDemoChat('shopping')}
                    className="px-6 py-3 border-2 border-white bg-transparent text-white font-mono text-sm uppercase tracking-wider hover:bg-white hover:text-black transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)] hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.5)] hover:-translate-y-0.5 rounded-lg mb-6"
                  >
                    Try without signing in →
                  </button>
                  
                  {/* Map illustration */}
                  <SimpleMapIllustration />
                </motion.div>
                
                {/* Right - chat */}
                <div className="space-y-3">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    className="flex justify-end"
                  >
                    <div className="bg-white border-2 border-white rounded-lg text-black px-4 py-2 max-w-[80%]">
                      <p className="font-mono text-sm">Where can I get neem oil nearby?</p>
                    </div>
                  </motion.div>
                  
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    whileInView={{ y: 0, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 1.8, duration: 0.6 }}
                    className="flex justify-start"
                  >
                    <div className="bg-white border-2 border-white rounded-lg text-black px-4 py-4 max-w-[95%]">
                      <p className="font-mono font-bold text-sm uppercase tracking-wide mb-4">Found 3 stores near you:</p>
                      <div className="space-y-3">
                        {[
                          { name: 'Green Thumb Nursery', distance: '0.8 mi away', price: '$8.99', stock: 'IN STOCK' },
                          { name: 'Urban Garden Center', distance: '1.2 mi away', price: '$9.49', stock: 'IN STOCK' },
                          { name: 'Plant Paradise', distance: '2.1 mi away', price: '$7.99', stock: 'LOW STOCK' }
                        ].map((store, i) => (
                          <div key={i} className="border-2 border-stone-200 rounded-lg p-3">
                            <p className="font-mono font-bold text-sm">{store.name}</p>
                            <p className="text-sm font-mono text-stone-400 mt-1">{store.distance} • {store.price}</p>
                            <span className={`inline-block mt-2 text-[10px] px-2 py-1 font-mono rounded ${store.stock === 'IN STOCK' ? 'bg-black text-white' : 'bg-white text-black border border-black'}`}>
                              {store.stock}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="font-serif text-xs text-stone-500 mt-3 pt-3 border-t border-stone-200">
                        💡 Can't make it out? I can also find options from online retailers.
                      </p>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Feature 6: Visual Guides */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1 }}
            className="relative"
          >
            <div className="grid md:grid-cols-5 gap-8">
              <div className="md:col-span-3 relative">
                <div className="absolute -top-8 left-0 font-mono text-xs uppercase tracking-widest text-stone-400">
                  FIG 2.6 - VISUAL PROTOCOL
                </div>
                
                <EtchedMonstera className="absolute -top-12 -left-12 w-24 h-24 text-stone-200 hidden md:block" />
                
                <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-8 relative z-10 rounded-lg">
                  <h4 className="font-mono font-bold mb-6 text-sm uppercase tracking-wide border-b-2 border-black pb-2">GUIDE TRANSMITTED</h4>
                  
                  <div className="space-y-3 mb-6">
                    <div className="bg-white border-2 border-black rounded-lg px-4 py-3">
                      <p className="font-mono font-bold text-sm mb-2">How to Propagate Your Pothos</p>
                      <p className="font-serif text-xs text-stone-600">Step-by-step visual guide:</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { step: '1', title: 'Cut stem', desc: 'Below leaf node', img: 'https://images.unsplash.com/photo-1760263131813-f63a5c99bb24?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjdXR0aW5nJTIwcGxhbnQlMjBzdGVtJTIwcHJvcGFnYXRpb258ZW58MXx8fHwxNzY5MjgxMzY5fDA&ixlib=rb-4.1.0&q=80&w=1080' },
                        { step: '2', title: 'Remove leaves', desc: 'Bottom 2 inches', img: 'https://images.unsplash.com/photo-1680124744736-859f16257ef0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYW5kcyUyMHBydW5pbmclMjBwbGFudCUyMHNjaXNzb3JzfGVufDF8fHx8MTc2OTI4MTM3MHww&ixlib=rb-4.1.0&q=80&w=1080' },
                        { step: '3', title: 'Place in water', desc: 'Change weekly', img: 'https://images.unsplash.com/photo-1766674745516-6a31204662a2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFudCUyMGN1dHRpbmclMjB3YXRlciUyMGdsYXNzfGVufDF8fHx8MTc2OTI4MTM2OXww&ixlib=rb-4.1.0&q=80&w=1080' },
                        { step: '4', title: 'Wait for roots', desc: '2-3 weeks', img: 'https://images.unsplash.com/photo-1759997724988-ed3648ac28d2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFudCUyMHJvb3RzJTIwZ3Jvd2luZyUyMHdhdGVyfGVufDF8fHx8MTc2OTI4MTM3MHww&ixlib=rb-4.1.0&q=80&w=1080' }
                      ].map((item, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 0.9, opacity: 0 }}
                          whileInView={{ scale: 1, opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
                          className="bg-stone-50 border-2 border-black rounded-lg p-3"
                        >
                          <ImageWithFallback 
                            src={item.img}
                            alt={item.title}
                            className="w-full aspect-square object-cover mb-2 border border-black rounded-lg"
                          />
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-5 h-5 bg-black text-white rounded flex items-center justify-center text-xs font-mono font-bold border border-black">
                              {item.step}
                            </div>
                            <p className="font-mono font-bold text-xs uppercase">{item.title}</p>
                          </div>
                          <p className="text-xs font-serif text-stone-600">{item.desc}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <motion.div
                initial={{ x: 40, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="md:col-span-2 flex flex-col justify-center"
              >
                <h3 className="text-5xl font-serif leading-tight mb-4 text-black">
                  Visual<br/>Guides
                </h3>
                <p className="text-xl font-serif italic text-stone-600 mb-4">
                  Learn by seeing, not just reading.
                </p>
                <p className="font-mono text-sm text-stone-700 leading-relaxed mb-6">
                  Orchid sends illustrated step-by-step guides for propagation, repotting, and pruning—tailored to your plant.
                </p>
                
                {/* Try without signing in button */}
                <button
                  onClick={() => openDemoChat('guides')}
                  className="px-6 py-3 border-2 border-black bg-white font-mono text-sm uppercase tracking-wider hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 rounded-lg"
                >
                  Try without signing in →
                </button>
              </motion.div>
            </div>
          </motion.div>

          {/* Feature 7: Live Calls - WITH VIDEO */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1 }}
            className="relative"
          >
            <div className="bg-black border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 md:p-16 relative overflow-hidden rounded-lg">
              <div className="absolute -top-8 left-8 font-mono text-xs uppercase tracking-widest text-stone-400 bg-stone-50 rounded-lg px-2 py-1">
                FIG 2.7 - VIDEO DIAGNOSIS
              </div>
              
              <EtchedFern className="absolute top-0 left-1/4 w-48 h-64 text-white opacity-5" />
              <EtchedPalm className="absolute bottom-0 right-1/4 w-40 h-48 text-white opacity-5" />
              
              <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
                <motion.div
                  initial={{ x: -40, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3, duration: 0.8 }}
                >
                  <h3 className="text-5xl font-serif leading-tight mb-4 text-white">
                    Live<br/>Calls
                  </h3>
                  <p className="text-xl font-serif italic text-white/80 mb-4">
                    Real-time plant checkups.
                  </p>
                  <p className="font-mono text-sm text-white/70 leading-relaxed">
                    For complex issues, hop on a video call with Orchid. Show us the problem in real-time and get guided diagnosis and treatment.
                  </p>
                </motion.div>
                
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className="bg-stone-900 border-2 border-white rounded-lg min-h-[400px] relative overflow-hidden"
                >
                  {/* Video background */}
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover opacity-50"
                  >
                    <source src="https://videos.pexels.com/video-files/4505445/4505445-uhd_2560_1440_25fps.mp4" type="video/mp4" />
                  </video>
                  
                  {/* Fallback image if video doesn't load */}
                  <ImageWithFallback 
                    src="https://images.unsplash.com/photo-1697472423656-1460c453a25d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwbGFudCUyMGJyb3duJTIwc3BvdHMlMjBmdW5nYWwlMjBkaXNlYXNlfGVufDF8fHx8MTc2OTI4MTM2OHww&ixlib=rb-4.1.0&q=80&w=1080"
                    alt="Plant diagnosis during video call"
                    className="absolute inset-0 w-full h-full object-cover opacity-40"
                  />
                  
                  <div className="absolute top-4 left-4 bg-white border-2 border-black rounded-lg px-3 py-1 flex items-center gap-2 z-10">
                    <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider">Live</span>
                  </div>
                  
                  <div className="absolute top-4 right-4 bg-black border-2 border-white rounded-lg px-3 py-1 z-10">
                    <span className="text-white text-sm font-mono">03:42</span>
                  </div>
                  
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-10">
                    <div className="w-12 h-12 bg-white border-2 border-black rounded-lg flex items-center justify-center">
                      <div className="w-5 h-5 bg-black rounded-lg" />
                    </div>
                    <div className="w-12 h-12 bg-red-600 border-2 border-black rounded-lg flex items-center justify-center">
                      <div className="w-5 h-1 bg-white rounded-lg" />
                    </div>
                    <div className="w-12 h-12 bg-white border-2 border-black rounded-lg flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-black rounded-lg" />
                    </div>
                  </div>
                  
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.8, duration: 0.6 }}
                    className="absolute bottom-20 left-4 right-4 bg-black/90 border-2 border-white rounded-lg p-4 z-10"
                  >
                    <p className="text-white font-serif text-sm">
                      "I can see the brown spots on the leaves. Based on the pattern and location, this looks like a fungal infection from overwatering. Let me walk you through the treatment..."
                    </p>
                  </motion.div>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Feature 8: Privacy & Control - HIDDEN FOR REDESIGN */}
          {/* <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1 }}
            className="relative"
          >
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ x: -40, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.8 }}
              >
                <div className="absolute -top-8 left-0 font-mono text-xs uppercase tracking-widest text-stone-400">
                  FIG 2.8 - PRIVACY BY DESIGN
                </div>
                
                <h3 className="text-5xl font-serif leading-tight mb-4 text-black">
                  Privacy &<br/>Control
                </h3>
                <p className="text-xl font-serif italic text-stone-600 mb-4">
                  Like texting a friend.
                </p>
                <p className="font-mono text-sm text-stone-700 leading-relaxed mb-6">
                  Your conversations are end-to-end encrypted through iMessage. We built on Apple's infrastructure specifically because it's more private. No tracking, no data selling—ever.
                </p>
                
                <div className="bg-stone-100 border-2 border-black rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-mono text-xs font-bold uppercase">iMessage Encrypted</p>
                      <p className="font-serif text-xs text-stone-500">Same security as texting friends & family</p>
                    </div>
                  </div>
                </div>
              </motion.div>
              
              <div className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 rounded-lg">
                <div className="mb-6">
                  <h4 className="font-mono font-bold text-sm uppercase tracking-wide border-b-2 border-black pb-2 mb-4">How Your Data Is Protected</h4>
                  <div className="space-y-3">
                    {[
                      { icon: '🔒', text: 'End-to-end encrypted via iMessage' },
                      { icon: '🚫', text: 'AI not trained on your conversations' },
                      { icon: '🤝', text: 'Never shared with third parties' },
                      { icon: '📍', text: 'No location tracking—optional city/zip only' }
                    ].map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ x: 20, opacity: 0 }}
                        whileInView={{ x: 0, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
                        className="flex items-center gap-3"
                      >
                        <span className="text-lg">{item.icon}</span>
                        <p className="font-serif text-sm text-stone-700">{item.text}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-mono font-bold text-sm uppercase tracking-wide border-b-2 border-black pb-2 mb-4">Your Controls</h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Proactive check-ins', sublabel: 'Orchid reaches out to see how plants are doing', enabled: true },
                      { label: 'Weather alerts', sublabel: 'Frost warnings, heat waves, etc.', enabled: true },
                      { label: 'Care reminders', sublabel: 'Watering and fertilizing prompts', enabled: false },
                      { label: 'Weekly summaries', sublabel: 'Recap of your plant care activity', enabled: false }
                    ].map((setting, i) => (
                      <motion.div
                        key={i}
                        initial={{ x: 30, opacity: 0 }}
                        whileInView={{ x: 0, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5 + i * 0.1, duration: 0.5 }}
                        className="flex items-center justify-between py-2"
                      >
                        <div>
                          <p className="font-mono text-sm mb-0.5">{setting.label}</p>
                          <p className="text-xs font-serif text-stone-400">{setting.sublabel}</p>
                        </div>
                        <div className={`w-10 h-5 border-2 border-black rounded-full relative ${setting.enabled ? 'bg-black' : 'bg-white'}`}>
                          <div className={`w-3 h-3 bg-white border border-black rounded-full absolute top-0.5 transition-all ${setting.enabled ? 'right-0.5' : 'left-0.5'}`} />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div> */}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-center mt-48"
        >
          <div>
            <button 
              onClick={onStartGrowing}
              className="px-12 py-5 border-2 border-black bg-black text-white font-mono text-sm uppercase tracking-widest hover:bg-white hover:text-black transition-all shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 rounded-[10px]"
            >
              Start Growing Today
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
