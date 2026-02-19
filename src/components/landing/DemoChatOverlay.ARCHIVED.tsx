// ============================================================================
// ARCHIVED — This component is no longer used.
// Replaced by the new generative UI demo page at src/pages/DemoPage.tsx
// which uses structured artifacts instead of chat bubbles.
// Kept for reference only. See DEMO_PAGE_SPEC.md for the new design.
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, MicOff, Image, Send, Loader2 } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  media?: { type: string; preview: string }[];
  timestamp: Date;
}

interface MediaFile {
  id: string;
  file: File;
  preview: string;
  type: string;
}

interface DemoChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  context?: 'identification' | 'diagnosis' | 'guides' | 'shopping' | 'general';
}

// Suggested prompts per context
const suggestedPrompts: Record<string, { text: string; hasMedia?: boolean }[]> = {
  identification: [
    { text: "What plant is this?", hasMedia: true },
    { text: "Can you identify this from a photo?", hasMedia: true },
    { text: "Is this plant safe for cats?" },
  ],
  diagnosis: [
    { text: "My plant has brown leaf tips", hasMedia: true },
    { text: "Why are my leaves turning yellow?" },
    { text: "I think I'm overwatering—help!" },
  ],
  guides: [
    { text: "How do I repot a plant?" },
    { text: "When should I prune?" },
    { text: "How do I propagate from cuttings?" },
  ],
  shopping: [
    { text: "Find neem oil near me" },
    { text: "Where can I buy perlite?" },
    { text: "Best soil for succulents?" },
  ],
  general: [
    { text: "What plant is this?", hasMedia: true },
    { text: "My plant looks sick", hasMedia: true },
    { text: "Best low-light plants?" },
    { text: "How often should I water?" },
  ],
};

// Typing indicator
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-stone-400 rounded-full"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

export function DemoChatOverlay({ isOpen, onClose, context = 'general' }: DemoChatOverlayProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [exchangeCount, setExchangeCount] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Reset state when overlay opens
  useEffect(() => {
    if (isOpen) {
      setMessages([]);
      setInputValue('');
      setMediaFiles([]);
      setExchangeCount(0);
    }
  }, [isOpen]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(prev => prev + transcript);
        setIsListening(false);
      };
      
      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleSpeechRecognition = () => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    files.forEach(file => {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const newMedia: MediaFile = {
            id: `${Date.now()}-${Math.random()}`,
            file,
            preview: reader.result as string,
            type: file.type,
          };
          setMediaFiles(prev => [...prev, newMedia]);
        };
        reader.readAsDataURL(file);
      }
    });
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeMedia = (id: string) => {
    setMediaFiles(prev => prev.filter(m => m.id !== id));
  };

  const sendMessage = async (text: string, media: MediaFile[] = []) => {
    if (!text.trim() && media.length === 0) return;
    
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      media: media.map(m => ({ type: m.type, preview: m.preview })),
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setMediaFiles([]);
    setIsLoading(true);
    
    try {
      // Prepare media for API
      const mediaForApi = await Promise.all(
        media.map(async (m) => {
          // Extract base64 data from data URL
          const base64 = m.preview.split(',')[1];
          return { type: m.type, data: base64 };
        })
      );
      
      // Build conversation history
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));
      conversationHistory.push({ role: 'user', content: text });
      
      // Call demo-agent
      const { data, error } = await supabase.functions.invoke('demo-agent', {
        body: {
          messages: conversationHistory,
          media: mediaForApi.length > 0 ? mediaForApi : undefined,
          exchangeCount,
        },
      });
      
      if (error) throw error;
      
      // Handle navigation action
      if (data?.action === 'navigate') {
        window.location.href = data.path;
        return;
      }
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data?.content || "I'm having trouble responding. Please try again.",
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setExchangeCount(prev => prev + 1);
      
    } catch (err) {
      console.error('Demo agent error:', err);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "Oops, something went wrong! Try asking me about plant care or send a photo of your plant. 🌱",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue, mediaFiles);
  };

  const handleSuggestedPrompt = (prompt: { text: string; hasMedia?: boolean }) => {
    if (prompt.hasMedia) {
      // Open file picker, then send
      setInputValue(prompt.text);
      fileInputRef.current?.click();
    } else {
      sendMessage(prompt.text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const prompts = suggestedPrompts[context] || suggestedPrompts.general;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={onClose}
          />
          
          {/* Chat Panel */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed z-50 bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col
                       inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl
                       md:inset-auto md:bottom-8 md:left-1/2 md:-translate-x-1/2 md:w-[520px] md:max-h-[700px] md:rounded-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black bg-stone-100 rounded-t-2xl md:rounded-t-2xl shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black border-2 border-black rounded-lg flex items-center justify-center text-white font-serif font-bold text-lg">
                  V
                </div>
                <div>
                  <h3 className="font-mono font-bold text-sm uppercase tracking-wide">TRY ORCHID</h3>
                  <p className="font-mono text-xs text-stone-500">Demo Mode • No Account Needed</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center border-2 border-black rounded-lg bg-white hover:bg-stone-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 min-h-[300px] max-h-[50vh]">
              {/* Suggested Prompts - show when no messages */}
              {messages.length === 0 && !isLoading && (
                <div className="space-y-4">
                  <p className="font-mono text-xs text-stone-500 uppercase tracking-wider text-center">
                    Try asking...
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {prompts.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestedPrompt(prompt)}
                        className="px-4 py-2 border-2 border-black rounded-lg bg-white hover:bg-stone-100 
                                   font-mono text-sm transition-all hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                                   flex items-center gap-2"
                      >
                        {prompt.hasMedia && <Image className="w-3 h-3" />}
                        {prompt.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Message List */}
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] ${message.role === 'user' ? '' : ''}`}>
                      {/* Media previews */}
                      {message.media && message.media.length > 0 && (
                        <div className="flex gap-2 mb-2 justify-end">
                          {message.media.map((m, i) => (
                            <div key={i} className="w-20 h-20 border-2 border-black rounded-lg overflow-hidden">
                              {m.type.startsWith('image/') ? (
                                <img src={m.preview} alt="Uploaded" className="w-full h-full object-cover" />
                              ) : (
                                <video src={m.preview} className="w-full h-full object-cover" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Message bubble */}
                      <div
                        className={`border-2 border-black rounded-lg px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-black text-white'
                            : 'bg-white text-black'
                        }`}
                      >
                        <p className="font-mono text-sm whitespace-pre-wrap leading-relaxed">
                          {message.content}
                        </p>
                      </div>
                      <p className={`text-[10px] font-mono text-stone-400 uppercase tracking-wider px-2 mt-1 ${
                        message.role === 'user' ? 'text-right' : 'text-left'
                      }`}>
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
                
                {/* Typing indicator */}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border-2 border-black rounded-lg">
                      <TypingIndicator />
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </div>
            
            {/* Media Preview Bar */}
            {mediaFiles.length > 0 && (
              <div className="px-4 py-2 border-t border-stone-200 bg-stone-50 shrink-0">
                <ScrollArea className="w-full whitespace-nowrap">
                  <div className="flex gap-2">
                    {mediaFiles.map((media) => (
                      <div key={media.id} className="relative shrink-0">
                        <div className="w-16 h-16 border-2 border-black rounded-lg overflow-hidden">
                          {media.type.startsWith('image/') ? (
                            <img src={media.preview} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <video src={media.preview} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <button
                          onClick={() => removeMedia(media.id)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-black text-white rounded-full flex items-center justify-center text-xs border border-white"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            )}
            
            {/* Input Area */}
            <form onSubmit={handleSubmit} className="px-4 py-4 border-t-2 border-black bg-stone-100 shrink-0 md:rounded-b-2xl">
              <div className="flex items-center gap-2">
                {/* Media upload button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-11 h-11 shrink-0 flex items-center justify-center border-2 border-black rounded-lg bg-white hover:bg-stone-50 transition-colors"
                >
                  <Image className="w-5 h-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {/* Speech-to-text button */}
                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  disabled={!recognitionRef.current}
                  className={`w-11 h-11 shrink-0 flex items-center justify-center border-2 border-black rounded-lg transition-colors
                    ${isListening ? 'bg-red-500 text-white' : 'bg-white hover:bg-stone-50'}
                    ${!recognitionRef.current ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                
                {/* Text input */}
                <div className="flex-1">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your plants..."
                    className="w-full h-11 px-4 border-2 border-black rounded-lg bg-white font-mono text-sm 
                               placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1"
                  />
                </div>
                
                {/* Send button */}
                <button
                  type="submit"
                  disabled={isLoading || (!inputValue.trim() && mediaFiles.length === 0)}
                  className="w-11 h-11 shrink-0 flex items-center justify-center border-2 border-black rounded-lg 
                             bg-black text-white hover:bg-stone-800 transition-colors
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default DemoChatOverlay;
