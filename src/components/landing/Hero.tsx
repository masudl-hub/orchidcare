import { motion } from 'framer-motion';
import { EtchedFern, EtchedMonstera } from './BrutalistPatterns';
import { useState, useEffect } from 'react';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';

interface HeroProps {
  onVideoEnd: () => void;
  onTryItClick?: () => void;
}

export function Hero({ onVideoEnd, onTryItClick }: HeroProps) {
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    // Show text quickly after video starts
    const textTimer = setTimeout(() => {
      setShowText(true);
      // Then trigger content load after text is visible
      setTimeout(() => {
        onVideoEnd();
      }, 2500);
    }, 800);

    return () => clearTimeout(textTimer);
  }, [onVideoEnd]);

  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 border-b-2 border-black">
      {/* Botanical Video Background */}
      <motion.div
        className="absolute inset-0 z-10"
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="w-full h-full overflow-hidden">
          <video
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: 'scale(1.15)', transformOrigin: 'center' }}
            onEnded={(e) => {
              const video = e.currentTarget;
              video.pause();
            }}
          >
            <source src="/Darker_Aesthetic_Plant_Animation.mp4" type="video/mp4" />
          </video>
        </div>
        
        {/* Lighter vignette for text contrast */}
        <div 
          className="absolute inset-0" 
          style={{
            background: 'radial-gradient(circle at center, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.45) 100%)'
          }}
        />
        {/* Reduced overall darkening */}
        <div className="absolute inset-0 bg-black/25" />
      </motion.div>

      {/* Content - appears after delay */}
      {showText && (
        <div className="relative z-40 text-left max-w-7xl mx-auto px-8 w-full">
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >

            {/* Main Title */}
            <motion.h1
              className="text-7xl md:text-9xl font-serif leading-none text-white mb-2"
              style={{ textShadow: '0 4px 16px rgba(0,0,0,0.8)' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              ORCHID
            </motion.h1>
            
            {/* Subtitle */}
            <motion.p
              className="text-3xl md:text-5xl font-serif text-white"
              style={{ textShadow: '0 4px 12px rgba(0,0,0,0.6)' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              Intelligent Botany
            </motion.p>
          </motion.div>

          {/* Description */}
          <motion.div
            className="max-w-lg mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
          >
            <p className="font-mono text-sm leading-relaxed text-white/90">
              A conversational plant care agent on Telegram.
              Send photos, receive diagnoses, and cultivate healthier plants through natural dialogue.
            </p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-start items-start"
          >
            <a
              href="/begin"
              className="rounded-sm px-8 py-4 border-2 border-white bg-white text-emerald-800 font-mono text-sm uppercase tracking-widest hover:bg-emerald-800 hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)] hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.4)] hover:-translate-y-0.5"
            >
              Get Started
            </a>
            <button
              onClick={onTryItClick}
              className="rounded-sm px-8 py-4 border-2 border-white bg-transparent text-white font-mono text-sm uppercase tracking-widest hover:bg-white hover:text-emerald-800 transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.3)] hover:-translate-y-0.5"
            >
              Try It
            </button>
          </motion.div>
        </div>
      )}

      {/* Scroll Indicator - Brutalist Arrow - appears with text */}
      {showText && (
        <div className="absolute bottom-12 left-0 right-0 z-40">
          <div className="max-w-7xl mx-auto px-8">
            <motion.div
              className="flex flex-col items-start gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.8 }}
            >
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-white">
                  <path d="M12 5L12 19M12 19L6 13M12 19L18 13" strokeWidth="2" strokeLinecap="square" />
                </svg>
              </motion.div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/70">Scroll</span>
            </motion.div>
          </div>
        </div>
      )}
    </section>
  );
}