import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const mono = "ui-monospace, monospace";
const DECRYPT_SPEED = 3;
const DENSITY_STEPS = ["█", "▓", "▒", "░", ""];

// Decryption helper
function decryptChar(cycleCount: number, targetChar: string): string {
  if (targetChar === ' ') return ' ';
  if (cycleCount >= DENSITY_STEPS.length) return targetChar;
  return DENSITY_STEPS[Math.min(cycleCount, DENSITY_STEPS.length - 1)];
}

export function LiveFeature({
  className = "",
  scrollRoot,
}: {
  className?: string;
  scrollRoot?: React.RefObject<HTMLElement | null>;
}) {
  const [visible, setVisible] = useState(false);
  const [seconds, setSeconds] = useState(222); // Start at 3:42
  const [decryptedMessage, setDecryptedMessage] = useState("");
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef(0);

  const messageText = "I can see the spider mites on the fronds. They're causing that stippled discoloration. Let me walk you through the treatment—we'll get your palm back to health.";

  // Timer effect
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      setSeconds(s => (s > 0 ? s - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [visible]);

  // Message decryption effect
  useEffect(() => {
    if (!visible) {
      setDecryptedMessage(messageText);
      return;
    }

    const chars = messageText.split('');
    
    let animationId: number;
    const animate = () => {
      frameRef.current++;
      const frame = frameRef.current;
      
      let allDone = true;
      const newText = chars.map((char, i) => {
        if (char === ' ') return ' ';
        
        const charDelay = i * 1.5;
        const charFrames = frame - charDelay;
        
        if (charFrames < 0) {
          allDone = false;
          return DENSITY_STEPS[0];
        }
        
        const cycles = Math.floor(charFrames / DECRYPT_SPEED);
        
        if (cycles >= DENSITY_STEPS.length) {
          return char;
        }
        
        allDone = false;
        return DENSITY_STEPS[Math.min(cycles, DENSITY_STEPS.length - 1)];
      }).join('');
      
      setDecryptedMessage(newText);
      
      if (!allDone) {
        animationId = requestAnimationFrame(animate);
      }
    };
    
    frameRef.current = 0;
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [visible]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
        }
      },
      { threshold: 0.3, root: scrollRoot?.current ?? null }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  // Play video only when section becomes visible
  useEffect(() => {
    if (visible && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [visible]);

  const revealStyle = (delay: number): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(12px)",
    transition: "all 600ms ease-out",
    transitionDelay: visible ? `${delay}ms` : "0ms",
  });

  return (
    <section
      ref={sectionRef}
      className={`snap-start w-full min-h-screen flex items-center justify-center bg-black relative overflow-hidden ${className}`}
    >
      {/* Grain overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04] mix-blend-screen z-40">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <filter id="grain-live">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-live)" />
        </svg>
      </div>

      {/* Figure annotation */}
      <div
        className="absolute transition-all duration-600 ease-out hidden md:block"
        style={{
          top: 40,
          right: 40,
          opacity: visible ? 0.35 : 0,
          transform: visible ? "translateY(0)" : "translateY(6px)",
          transitionDelay: visible ? "100ms" : "0ms",
          fontFamily: mono,
          fontSize: "11px",
          color: "white",
          letterSpacing: "0.12em",
          zIndex: 10,
        }}
      >
        FIG 2.7 — VIDEO DIAGNOSIS
      </div>

      <div className="w-full px-4 md:px-16 lg:px-24 z-10 relative">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Left: Description */}
          <motion.div
            initial={{ x: -40, opacity: 0 }}
            animate={visible ? { x: 0, opacity: 1 } : { x: -40, opacity: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <h2
              className="text-[22px] md:text-[32px]"
              style={{
                fontFamily: '"Press Start 2P", cursive',
                lineHeight: 1.4,
                color: "white",
                marginBottom: "24px",
              }}
            >
              Live<br />Calls
            </h2>

            <p
              style={{
                fontFamily: mono,
                fontSize: '15px',
                fontStyle: 'italic',
                color: 'rgba(255,255,255,0.6)',
                marginBottom: '16px',
              }}
            >
              Real-time conversations.
            </p>

            <p
              style={{
                fontFamily: mono,
                fontSize: '13px',
                color: 'rgba(255,255,255,0.7)',
                lineHeight: '1.8',
                marginBottom: '24px',
              }}
            >
              Jump on a voice or video call with Orchid for real-time conversations. Diagnose issues, get care tips, adjust watering schedules—do everything you'd do over text, but face-to-face.
            </p>
          </motion.div>

          {/* Right: Video player */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={visible ? { scale: 1, opacity: 1 } : { scale: 0.95, opacity: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            style={{
              backgroundColor: '#000',
              border: '1px solid rgba(255,255,255,0.3)',
              minHeight: '400px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Grain overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='6.5' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`,
                opacity: 0.12,
                pointerEvents: 'none',
                mixBlendMode: 'overlay',
              }}
            />

            {/* Video background */}
            <video
              ref={videoRef}
              muted
              playsInline
              preload="auto"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            >
              <source src="/palm_spidermites.mp4" type="video/mp4" />
            </video>

            {/* Live indicator */}
            <div
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                backgroundColor: '#fff',
                border: '1px solid rgba(255,255,255,0.6)',
                borderRadius: '2px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                zIndex: 20,
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#d91e1e',
                  borderRadius: '100%',
                  animation: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }}
              />
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: mono,
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#000',
                }}
              >
                Live
              </span>
            </div>

            {/* Timestamp */}
            <div
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                backgroundColor: '#000',
                border: '1px solid rgba(255,255,255,0.6)',
                borderRadius: '2px',
                padding: '8px 12px',
                zIndex: 20,
              }}
            >
              <span
                style={{
                  color: '#fff',
                  fontSize: '12px',
                  fontFamily: mono,
                }}
              >
                {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
              </span>
            </div>

            {/* Message bubble */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={visible ? { opacity: 1 } : { opacity: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              style={{
                position: 'absolute',
                bottom: 20,
                left: 16,
                right: 16,
                backgroundColor: 'rgba(0,0,0,0.9)',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: '2px',
                padding: '16px',
                zIndex: 20,
              }}
            >
              <p
                style={{
                  color: '#fff',
                  fontFamily: mono,
                  fontSize: '12px',
                  lineHeight: '1.6',
                }}
              >
                "{decryptedMessage}"
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </section>
  );
}
