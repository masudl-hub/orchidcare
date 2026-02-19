import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string;
}

const mockMessages: Message[] = [
  { id: 1, text: "What's this plant in my garden?", sender: 'user', timestamp: '10:32 AM' },
  { id: 2, text: "That's a Snake Plant (Sansevieria trifasciata). Excellent for beginners—tolerates neglect.", sender: 'bot', timestamp: '10:32 AM' },
  { id: 3, text: "How often should I water it?", sender: 'user', timestamp: '10:33 AM' },
  { id: 4, text: "Every 2-3 weeks. Allow soil to dry completely between waterings. Overwatering causes root rot.", sender: 'bot', timestamp: '10:33 AM' },
  { id: 5, text: "Does it need direct sunlight?", sender: 'user', timestamp: '10:34 AM' },
  { id: 6, text: "Adaptable. Thrives in indirect light, tolerates low light. Avoid harsh direct sun.", sender: 'bot', timestamp: '10:34 AM' },
];

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

export function ChatDemo() {
  const [visibleMessages, setVisibleMessages] = useState<Message[]>([]);
  const [showTyping, setShowTyping] = useState(false);

  useEffect(() => {
    mockMessages.forEach((message, index) => {
      setTimeout(() => {
        if (message.sender === 'bot' && index > 0) {
          setShowTyping(true);
          setTimeout(() => {
            setShowTyping(false);
            setVisibleMessages((prev) => [...prev, message]);
          }, 1200);
        } else {
          setVisibleMessages((prev) => [...prev, message]);
        }
      }, index * 2000);
    });
  }, []);

  return (
    <section className="min-h-screen bg-stone-50 py-20 px-4 border-b-2 border-black relative">
      {/* Grid pattern background */}
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url(#grid-pattern)' }} />
      
      <div className="max-w-5xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          {/* Technical label */}
          <div className="inline-block border border-black rounded-lg px-3 py-1 mb-6 bg-white">
            <span className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
              FIG 1.1 - CONVERSATIONAL INTERFACE
            </span>
          </div>
          
          <h2 className="text-5xl md:text-6xl font-serif text-black mb-4">
            Agent Communication
          </h2>
          <p className="text-lg font-mono text-stone-600 max-w-2xl mx-auto">
            Natural language plant care via Telegram. No app download required.
          </p>
        </motion.div>

        {/* Chat Interface - Brutalist */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white border-2 border-black rounded-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden max-w-3xl mx-auto"
        >
          {/* Chat Header */}
          <div className="bg-stone-100 px-6 py-4 border-b-2 border-black">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 border-2 border-black rounded-lg bg-white flex items-center justify-center font-serif font-bold text-lg">
                  V
                </div>
                <div>
                  <h3 className="font-mono font-bold text-sm uppercase tracking-wide text-black">ORCHID</h3>
                  <p className="text-xs font-mono text-stone-500">Telegram • Agent Online</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="font-mono text-[10px] text-stone-500 uppercase">Active</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="p-6 space-y-4 min-h-[500px] bg-white">
            {visibleMessages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%] ${message.sender === 'user' ? '' : ''}`}>
                  <div
                    className={`border-2 border-black rounded-lg p-4 ${
                      message.sender === 'user'
                        ? 'bg-black text-white'
                        : 'bg-white text-black'
                    }`}
                  >
                    <p className={`${message.sender === 'user' ? 'font-mono text-sm' : 'font-serif text-sm leading-relaxed'}`}>
                      {message.text}
                    </p>
                  </div>
                  <p className="text-[10px] font-mono text-stone-400 mt-1 px-2 uppercase tracking-wider">
                    {message.timestamp}
                  </p>
                </div>
              </motion.div>
            ))}
            
            {/* Typing Indicator */}
            {showTyping && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="border-2 border-black rounded-lg bg-white p-4">
                  <TypingIndicator />
                </div>
              </motion.div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t-2 border-black bg-stone-50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 border-2 border-black rounded-lg bg-white px-4 py-3 font-mono text-sm text-stone-400">
                Type message...
              </div>
              <button className="px-6 py-3 border-2 border-black rounded-lg bg-black text-white font-mono text-xs uppercase tracking-widest hover:bg-stone-800 transition-colors">
                Send
              </button>
            </div>
          </div>
        </motion.div>

        {/* Technical annotation */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-center"
        >
          <p className="font-mono text-xs text-stone-400 uppercase tracking-widest">
            Specimen Analysis • Real-Time Diagnosis • Care Protocol Generation
          </p>
        </motion.div>
      </div>
    </section>
  );
}