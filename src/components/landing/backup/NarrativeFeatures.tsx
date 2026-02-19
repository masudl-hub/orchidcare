import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Mic, ChevronDown, Phone, Video, PhoneOff, Send, Camera, Image } from 'lucide-react';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { useLenisControl } from '@/components/SmoothScroll';

interface Message {
  id: string;
  text?: string;
  sender: 'user' | 'agent';
  timestamp?: string;
  image?: string;
  images?: string[]; // For multi-image messages like visual guides
  voiceNote?: boolean;
  isTyping?: boolean;
}

interface NarrativeStep {
  id: number;
  // Which messages to show at this step (cumulative)
  messagesUpTo: number;
  // Feature copy for left side (null = keep previous)
  featureCopy?: {
    title: string;
    description: string;
  };
  // Should we show typing before revealing messages?
  showTyping?: boolean;
  // Special states
  showScrollNudge?: boolean;
  showCallInterface?: boolean;
  showDemoMode?: boolean;
}

// All messages in the conversation
const allMessages: Message[] = [
  // Initial identification
  { 
    id: 'm1', 
    text: "What's this plant?", 
    sender: 'user', 
    timestamp: '2:34 PM',
    image: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=400'
  },
  { 
    id: 'm2', 
    text: "That's a Monstera deliciosa! It's perfect for you since you prefer plants that don't need a lot of water.\n\nCaution, however—Monsteras are toxic to cats. I'd recommend keeping it on a high shelf or in a room Whiskers doesn't frequent.\n\nWould you like me to save this to your collection?", 
    sender: 'agent', 
    timestamp: '2:34 PM' 
  },
  { 
    id: 'm3', 
    text: "Sure, and thanks for those notes!", 
    sender: 'user', 
    timestamp: '2:35 PM' 
  },
  
  // Diagnosis
  { 
    id: 'm4', 
    text: "Got it! I've saved your new friend and noted it's getting bright indirect light in your bedroom. The pot looks a bit crowded—it may need repotting in a few months.\n\nBy the way, I'm noticing some silvery streaking and small black dots on the leaves. Your plant friend may have thrips!\n\nInsecticidal soap can help if you're diligent, but given the size of your collection (12 plants), I'd recommend systemic granules to protect everyone. Would you like me to find local stores?", 
    sender: 'agent', 
    timestamp: '2:36 PM' 
  },
  { 
    id: 'm5', 
    text: "Woah, I was wondering what that was! What even are thrips?? And yes please, that would be helpful", 
    sender: 'user', 
    timestamp: '2:37 PM' 
  },
  
  // Thrips explanation
  { 
    id: 'm6', 
    text: "Thrips are tiny insects (1-2mm) that pierce plant cells and suck out the contents, leaving behind that silvery stippling you're seeing. They reproduce quickly—a full lifecycle takes just 2-3 weeks—and can spread through your entire collection if left unchecked.\n\nThe good news: systemic granules are absorbed by the roots and make the whole plant toxic to pests for 6-8 weeks.", 
    sender: 'agent', 
    timestamp: '2:37 PM' 
  },
  
  // Store listings
  { 
    id: 'm7', 
    text: "I found 5 stores near 94110 with systemic granules in stock:\n\n🌿 Flora Grubb Gardens — 0.4 mi\n1634 Jerrold Ave • (415) 626-7256\nBonide Systemic 8oz — $12.99 (8 in stock)\n\n🌿 Sloat Garden Center — 1.2 mi\n3237 Pierce St • (415) 440-1000\nBonide Systemic 8oz — $11.99 (15 in stock)\n\n🌿 Flowercraft — 1.8 mi\n550 Bayshore Blvd • (415) 824-1900\nBioAdvanced 2-in-1 — $14.99 (6 in stock)\n\nWant me to call ahead to hold one?", 
    sender: 'agent', 
    timestamp: '2:38 PM' 
  },
  
  // Application guide
  { 
    id: 'm8', 
    text: "Got it! How should I apply this?", 
    sender: 'user', 
    timestamp: '2:45 PM' 
  },
  { 
    id: 'm9', 
    text: "Here's a quick guide for applying systemic granules to Monty:", 
    sender: 'agent', 
    timestamp: '2:45 PM',
  },
  { 
    id: 'm10', 
    text: "Step 1: Measure about 1 tablespoon per 6 inches of pot diameter. For Monty's 8-inch pot, use ~1.5 tbsp.", 
    sender: 'agent',
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=300'
  },
  { 
    id: 'm11', 
    text: "Step 2: Sprinkle evenly across the soil surface, keeping granules away from the stem.", 
    sender: 'agent',
    image: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=300'
  },
  { 
    id: 'm12', 
    text: "Step 3: Water thoroughly to activate. The roots will absorb the treatment over the next 24-48 hours.", 
    sender: 'agent',
    image: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=300'
  },
  
  // Memory showcase
  { 
    id: 'm13', 
    text: "Thanks!", 
    sender: 'user', 
    timestamp: '2:47 PM' 
  },
  { 
    id: 'm14', 
    text: "Of course! I've recorded the care plan for \"Monty\", so you can follow up anytime. I'll check in in a few weeks to see how the treatment's going!", 
    sender: 'agent', 
    timestamp: '2:47 PM' 
  },
  { 
    id: 'm15', 
    text: "Oh, and since you tend to go lighter on watering 😉, be careful not to overdo it after applying—the salts can burn roots if the soil stays too wet.\n\nAlso, keep Whiskers away from the topsoil for a few days. The granules can be harmful if ingested.", 
    sender: 'agent', 
    timestamp: '2:47 PM' 
  },
  
  // Proactive check-in (2 weeks later)
  { 
    id: 'm16', 
    text: "Hey! How's Monty and the gang doing? Are you noticing any changes in the silvery streaking, or any spreading to other plants?", 
    sender: 'agent', 
    timestamp: '2 weeks ago' 
  },
  { 
    id: 'm17', 
    text: "All good, things seem to be improving but I'll keep checking like you suggested", 
    sender: 'user', 
    timestamp: '2 weeks ago' 
  },
  { 
    id: 'm18', 
    text: "Great! Keep me posted. The granules should stay effective for another 4-5 weeks.", 
    sender: 'agent', 
    timestamp: '2 weeks ago' 
  },
  
  // Weather alert (5 days ago)
  { 
    id: 'm19', 
    text: "Heads up! It's extra warm today (87°F, UV index 8). Since you haven't mentioned watering Monty, your Fiddle Leaf, the Pothos, or the Snake Plant recently, I thought you'd appreciate a prompt to check on them.\n\nWe're also in the sweet spot of summer when monthly fertilizer is appreciated—just go gentle so you don't burn those roots!", 
    sender: 'agent', 
    timestamp: '5 days ago' 
  },
  { 
    id: 'm20', 
    text: "You're a life saver!!!", 
    sender: 'user', 
    timestamp: '5 days ago' 
  },
  
  // Voice/Call
  { 
    id: 'm21', 
    sender: 'user', 
    timestamp: 'Now',
    voiceNote: true 
  },
  { 
    id: 'm22', 
    text: "Of course! I'm free now. Tap below to join:", 
    sender: 'agent', 
    timestamp: 'Now' 
  },
];

// Define what happens at each scroll step
const narrativeSteps: NarrativeStep[] = [
  // Step 0: Initial view - user sends photo
  { 
    id: 0, 
    messagesUpTo: 1,
    featureCopy: {
      title: 'Instant Identification',
      description: 'Send a photo, get immediate species identification with personalized context based on your preferences, environment, and existing collection.'
    }
  },
  // Step 1: Agent responds with ID
  { 
    id: 1, 
    messagesUpTo: 2,
    showTyping: true,
  },
  // Step 2: User says sure
  { 
    id: 2, 
    messagesUpTo: 3,
    showScrollNudge: true,
  },
  // Step 3: Agent diagnoses thrips
  { 
    id: 3, 
    messagesUpTo: 4,
    showTyping: true,
    featureCopy: {
      title: 'Diagnosis & Treatment',
      description: 'Orchid automatically detects health issues and provides tailored treatment recommendations based on your plant collection and care style.'
    }
  },
  // Step 4: User asks about thrips
  { id: 4, messagesUpTo: 5 },
  // Step 5: Agent explains thrips
  { id: 5, messagesUpTo: 6, showTyping: true },
  // Step 6: Agent lists stores
  { 
    id: 6, 
    messagesUpTo: 7,
    showTyping: true,
    featureCopy: {
      title: 'Local & Online Shopping',
      description: 'Real-time inventory from local nurseries and online retailers, ranked by distance, price, and availability.'
    },
    showScrollNudge: true,
  },
  // Step 7: User asks how to apply
  { id: 7, messagesUpTo: 8 },
  // Step 8: Agent sends visual guide
  { 
    id: 8, 
    messagesUpTo: 12,
    showTyping: true,
    featureCopy: {
      title: 'Visual Guides',
      description: 'Step-by-step illustrated instructions generated specifically for your plant, pot size, and situation.'
    }
  },
  // Step 9: User says thanks
  { id: 9, messagesUpTo: 13 },
  // Step 10: Agent records care plan + memory warning
  { 
    id: 10, 
    messagesUpTo: 15,
    showTyping: true,
    featureCopy: {
      title: 'Memory That Learns',
      description: 'Orchid remembers your watering habits, pet safety needs, and care preferences to provide increasingly personalized guidance.'
    },
    showScrollNudge: true,
  },
  // Step 11: 2 weeks later - agent check-in
  { 
    id: 11, 
    messagesUpTo: 16,
    showTyping: true,
    featureCopy: {
      title: 'Proactive Intelligence',
      description: 'Automated check-ins, treatment follow-ups, and timely reminders ensure nothing slips through the cracks.'
    }
  },
  // Step 12: User responds + agent reply
  { 
    id: 12, 
    messagesUpTo: 18,
    showScrollNudge: true,
  },
  // Step 13: Weather alert
  { 
    id: 13, 
    messagesUpTo: 19,
    showTyping: true,
  },
  // Step 14: User grateful
  { 
    id: 14, 
    messagesUpTo: 20,
    showScrollNudge: true,
  },
  // Step 15: Voice note
  { 
    id: 15, 
    messagesUpTo: 21,
    featureCopy: {
      title: 'Multimodal Communication',
      description: 'Text, voice notes, photos, videos—communicate however feels natural. Orchid understands it all.'
    }
  },
  // Step 16: Agent offers call
  { 
    id: 16, 
    messagesUpTo: 22,
    showTyping: true,
  },
  // Step 17: Call interface
  { 
    id: 17, 
    messagesUpTo: 22,
    showCallInterface: true,
    featureCopy: {
      title: 'Live Calls',
      description: 'When you need real-time help, hop on a live video or voice call with Orchid for hands-on guidance.'
    }
  },
  // Step 18: Demo mode
  { 
    id: 18, 
    messagesUpTo: 0,
    showDemoMode: true,
    featureCopy: {
      title: 'Try It Yourself',
      description: 'Upload a photo of your plant and experience Orchid firsthand.'
    }
  },
];

function TypingIndicator() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex justify-start mb-2"
    >
      <div className="bg-stone-200 rounded-[18px] px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-stone-400 rounded-full"
              animate={{ y: [0, -5, 0] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function MessageBubble({ message, isNew }: { message: Message; isNew: boolean }) {
  const isUser = message.sender === 'user';

  if (message.voiceNote) {
    return (
      <motion.div 
        initial={isNew ? { opacity: 0, y: 10 } : false}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end mb-2"
      >
        <div className="bg-[#007AFF] text-white rounded-[18px] px-4 py-3 max-w-[75%] flex items-center gap-3">
          <Mic className="w-4 h-4" />
          <div className="flex-1">
            <div className="h-6 flex items-center gap-0.5">
              {[12, 18, 8, 22, 15, 10, 20, 14, 9, 25, 17, 11, 19, 13, 8, 16, 12, 7, 14, 10].map((height, i) => (
                <motion.div 
                  key={i} 
                  className="w-0.5 bg-white/60 rounded-full"
                  initial={{ height: 4 }}
                  animate={{ height }}
                  transition={{ delay: i * 0.02, duration: 0.3 }}
                />
              ))}
            </div>
          </div>
          <span className="font-mono text-xs opacity-80">0:08</span>
        </div>
      </motion.div>
    );
  }
  
  return (
    <motion.div 
      initial={isNew ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}
    >
      <div className={`rounded-[18px] px-4 py-2 max-w-[75%] ${
        isUser 
          ? 'bg-[#007AFF] text-white' 
          : 'bg-stone-200 text-black'
      }`}>
        {message.image && (
          <div className="mb-2">
            <ImageWithFallback 
              src={message.image} 
              alt="Plant" 
              className="rounded-lg w-full max-w-[200px]"
            />
          </div>
        )}
        {message.text && (
          <p className="text-[15px] leading-snug whitespace-pre-line">{message.text}</p>
        )}
      </div>
    </motion.div>
  );
}

function CallInterface() {
  const [callState, setCallState] = useState<'ringing' | 'connected'>('ringing');
  
  useEffect(() => {
    const timer = setTimeout(() => setCallState('connected'), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-0 bg-gradient-to-b from-[#2E6F40] to-[#1a4025] flex flex-col items-center justify-center text-white z-10"
    >
      <motion.div
        animate={callState === 'ringing' ? { scale: [1, 1.1, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.5 }}
        className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-6"
      >
        <div className="w-20 h-20 rounded-full bg-white/30 flex items-center justify-center">
          <span className="text-4xl font-bold">V</span>
        </div>
      </motion.div>
      
      <h3 className="text-2xl font-serif mb-2">Orchid</h3>
      <p className="text-white/70 font-mono text-sm mb-8">
        {callState === 'ringing' ? 'Connecting...' : 'Connected • 0:03'}
      </p>
      
      {callState === 'connected' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center mb-8 px-8"
        >
          <p className="text-white/90 text-sm font-mono">
            "I can see Monty on your camera—the new growth looks great! Let me walk you through checking for any remaining thrips..."
          </p>
        </motion.div>
      )}
      
      <div className="flex gap-6">
        <button className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
          <Video className="w-6 h-6" />
        </button>
        <button className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center">
          <PhoneOff className="w-6 h-6" />
        </button>
        <button className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
          <Mic className="w-6 h-6" />
        </button>
      </div>
    </motion.div>
  );
}

function DemoInterface({ onStartGrowing }: { onStartGrowing: () => void }) {
  const [inputValue, setInputValue] = useState('');
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col"
    >
      {/* Empty chat area with prompt */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[#2E6F40] flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">V</span>
          </div>
          <h3 className="text-xl font-serif text-black mb-2">Try Orchid</h3>
          <p className="text-sm font-mono text-stone-500 max-w-[250px]">
            Upload a photo of your plant and get instant identification and care advice.
          </p>
        </div>
      </div>
      
      {/* Input Area */}
      <div className="bg-stone-100 px-4 py-3 border-t-2 border-black">
        <div className="bg-white border border-stone-300 rounded-[18px] px-4 py-2 flex items-center gap-2">
          <button className="text-[#007AFF]">
            <Camera className="w-5 h-5" />
          </button>
          <button className="text-[#007AFF]">
            <Image className="w-5 h-5" />
          </button>
          <input 
            type="text" 
            placeholder="Ask about a plant..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <button className="text-[#007AFF] font-bold text-sm">
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-center mt-3">
          <button 
            onClick={onStartGrowing}
            className="text-[#2E6F40] font-mono text-xs underline"
          >
            Or sign up for full access →
          </button>
        </p>
      </div>
    </motion.div>
  );
}

export function NarrativeFeatures({ onStartGrowing }: { onStartGrowing: () => void }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [previousStepIndex, setPreviousStepIndex] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [typingComplete, setTypingComplete] = useState(true);
  
  const sectionRef = useRef<HTMLElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isTransitioning = useRef(false);
  const lastFeatureCopyRef = useRef(narrativeSteps[0].featureCopy);
  
  const lenisControl = useLenisControl();

  const SCROLL_THRESHOLD = 100;
  const TOTAL_STEPS = narrativeSteps.length;

  const currentNarrativeStep = narrativeSteps[currentStepIndex];
  
  // Track current feature copy (persist from last step that had one)
  if (currentNarrativeStep.featureCopy) {
    lastFeatureCopyRef.current = currentNarrativeStep.featureCopy;
  }
  const currentFeatureCopy = lastFeatureCopyRef.current;

  // Get visible messages
  const visibleMessages = allMessages.slice(0, currentNarrativeStep.messagesUpTo);
  
  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      setTimeout(() => {
        chatContainerRef.current?.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [currentStepIndex, showTyping]);

  // Handle typing animation
  useEffect(() => {
    if (currentNarrativeStep.showTyping && currentStepIndex > previousStepIndex) {
      setShowTyping(true);
      setTypingComplete(false);
      
      const timer = setTimeout(() => {
        setShowTyping(false);
        setTypingComplete(true);
      }, 800);
      
      return () => clearTimeout(timer);
    } else {
      setTypingComplete(true);
    }
  }, [currentStepIndex, previousStepIndex, currentNarrativeStep.showTyping]);

  // Lock when section enters view
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && entry.intersectionRatio > 0.7) {
          setIsLocked(true);
          lenisControl.stop(); // Stop Lenis when locked
        }
      },
      { threshold: [0.7] }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [lenisControl]);

  // Handle step advancement
  const goToStep = useCallback((newStep: number) => {
    if (isTransitioning.current || !typingComplete) return;
    
    const clampedStep = Math.max(0, Math.min(TOTAL_STEPS - 1, newStep));
    
    if (clampedStep !== currentStepIndex) {
      isTransitioning.current = true;
      setPreviousStepIndex(currentStepIndex);
      setCurrentStepIndex(clampedStep);
      
      setTimeout(() => {
        isTransitioning.current = false;
      }, 300);
    }
  }, [currentStepIndex, TOTAL_STEPS, typingComplete]);

  // Scroll hijacking
  useEffect(() => {
    if (!isLocked) {
      lenisControl.start(); // Resume Lenis when unlocked
      return;
    }

    let accumulatedDelta = 0;

    const handleWheel = (e: WheelEvent) => {
      const section = sectionRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const isInSection = rect.top <= 50 && rect.bottom >= window.innerHeight - 50;

      if (!isInSection) {
        setIsLocked(false);
        lenisControl.start();
        return;
      }

      // Exit conditions
      if (e.deltaY > 0 && currentStepIndex >= TOTAL_STEPS - 1) {
        setIsLocked(false);
        lenisControl.start();
        return;
      }
      
      if (e.deltaY < 0 && currentStepIndex <= 0) {
        setIsLocked(false);
        lenisControl.start();
        return;
      }

      e.preventDefault();
      
      accumulatedDelta += e.deltaY;

      if (Math.abs(accumulatedDelta) >= SCROLL_THRESHOLD) {
        if (accumulatedDelta > 0) {
          goToStep(currentStepIndex + 1);
        } else {
          goToStep(currentStepIndex - 1);
        }
        accumulatedDelta = 0;
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [isLocked, currentStepIndex, goToStep, TOTAL_STEPS, lenisControl]);

  // Re-lock when scrolling back
  useEffect(() => {
    if (isLocked) return;

    const handleScroll = () => {
      const section = sectionRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      
      if (rect.top <= 50 && rect.top > -100 && currentStepIndex < TOTAL_STEPS - 1) {
        setIsLocked(true);
        lenisControl.stop();
      }
      
      if (rect.bottom >= window.innerHeight && rect.top < 0 && currentStepIndex > 0) {
        setIsLocked(true);
        lenisControl.stop();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLocked, currentStepIndex, TOTAL_STEPS, lenisControl]);

  return (
    <section ref={sectionRef} className="bg-white relative h-screen">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="max-w-7xl mx-auto px-8 pt-8">
          <div className="flex items-center justify-between">
            <div className="inline-block border border-black rounded-lg px-3 py-1 bg-white">
              <span className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
                FIG 1.2 — AGENT COMMUNICATION
              </span>
            </div>
            <div className="font-mono text-[10px] text-stone-400">
              {currentStepIndex + 1} / {TOTAL_STEPS}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="h-full flex items-center">
        <div className="max-w-7xl mx-auto px-8 w-full">
          <div className="grid grid-cols-2 gap-16 items-center">
            
            {/* LEFT: Feature Copy */}
            <div className="min-h-[400px] flex items-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentFeatureCopy?.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <h3 className="text-4xl font-serif text-black mb-4">
                    {currentFeatureCopy?.title}
                  </h3>
                  <p className="text-base font-mono text-stone-600 leading-relaxed max-w-md">
                    {currentFeatureCopy?.description}
                  </p>

                  {currentNarrativeStep.showScrollNudge && !currentNarrativeStep.showDemoMode && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="mt-8 flex items-center gap-2 text-stone-400 font-mono text-xs"
                    >
                      <span>Scroll to continue</span>
                      <ChevronDown className="w-4 h-4 animate-bounce" />
                    </motion.div>
                  )}

                  {currentNarrativeStep.showDemoMode && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="mt-8"
                    >
                      <button
                        onClick={onStartGrowing}
                        className="bg-[#2E6F40] text-white px-6 py-3 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all font-mono font-bold text-sm uppercase tracking-wider"
                      >
                        Get Started
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* RIGHT: iMessage Chat */}
            <div className="relative">
              <div className="bg-white border-2 border-black rounded-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                {/* Chat Header */}
                <div className="bg-stone-100 px-6 py-4 border-b-2 border-black">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#2E6F40] flex items-center justify-center border-2 border-black">
                      <span className="text-white font-bold text-sm">V</span>
                    </div>
                    <div>
                      <div className="font-mono font-bold text-sm">Orchid</div>
                      <div className="font-mono text-[10px] text-stone-500">iMessage</div>
                    </div>
                  </div>
                </div>

                {/* Chat Messages / Call / Demo */}
                <div className="h-[500px] relative">
                  {currentNarrativeStep.showCallInterface ? (
                    <CallInterface />
                  ) : currentNarrativeStep.showDemoMode ? (
                    <DemoInterface onStartGrowing={onStartGrowing} />
                  ) : (
                    <div 
                      ref={chatContainerRef}
                      className="h-full overflow-y-auto p-4 bg-white"
                    >
                      {visibleMessages.map((message, index) => {
                        const isNew = index >= narrativeSteps[previousStepIndex]?.messagesUpTo;
                        return (
                          <div key={message.id}>
                            {message.timestamp && (index === 0 || message.timestamp !== visibleMessages[index - 1]?.timestamp) && (
                              <div className="text-center text-[11px] text-stone-400 font-mono mb-2 mt-4">
                                {message.timestamp}
                              </div>
                            )}
                            <MessageBubble message={message} isNew={isNew && !showTyping} />
                          </div>
                        );
                      })}
                      
                      <AnimatePresence>
                        {showTyping && <TypingIndicator />}
                      </AnimatePresence>
                    </div>
                  )}
                  
                  {/* Input Area (not shown during call) */}
                  {!currentNarrativeStep.showCallInterface && !currentNarrativeStep.showDemoMode && (
                    <div className="absolute bottom-0 left-0 right-0 bg-stone-100 px-4 py-3 border-t-2 border-black">
                      <div className="bg-white border border-stone-300 rounded-[18px] px-4 py-2 flex items-center gap-2">
                        <input 
                          type="text" 
                          placeholder="iMessage" 
                          className="flex-1 bg-transparent outline-none text-sm"
                          disabled
                        />
                        <button className="text-[#007AFF] font-bold text-sm">↑</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="absolute bottom-8 left-8 flex gap-1.5">
        {narrativeSteps.map((_, index) => (
          <div
            key={index}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              index <= currentStepIndex ? 'bg-[#2E6F40]' : 'bg-stone-300'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
