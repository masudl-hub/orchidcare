import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { QROrchid } from './qr-orchid';

const mono = "ui-monospace, monospace";
const DECRYPT_SPEED = 3;
const DENSITY_STEPS = ["█", "▓", "▒", "░", ""];

export function CTAFeature({
  className = "",
  scrollRoot,
}: {
  className?: string;
  scrollRoot?: React.RefObject<HTMLElement | null>;
}) {
  const [visible, setVisible] = useState(false);
  const [decryptedTitle, setDecryptedTitle] = useState("");
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef(0);

  const titleText = "enter the jungle";


  // Title decryption effect
  useEffect(() => {
    if (!visible) {
      setDecryptedTitle(titleText);
      return;
    }

    const chars = titleText.split('');
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
      
      setDecryptedTitle(newText);
      
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

  return (
    <section
      ref={sectionRef}
      className={`snap-start w-full min-h-screen flex items-center justify-center bg-black relative overflow-hidden ${className}`}
    >
      {/* Grain overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04] mix-blend-screen z-40">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <filter id="grain-cta">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-cta)" />
        </svg>
      </div>

      {/* Figure annotation */}
      <div
        className="absolute transition-all duration-600 ease-out"
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
        FIG 2.8 — SUMMONING ORCHID
      </div>

      <div className="w-full px-10 md:px-16 lg:px-24 z-10 relative">
        <div style={{ maxWidth: 520, width: "100%", margin: "0 auto" }} className="flex flex-col gap-0">
          {/* Title with pixelated animation */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            style={{
              fontFamily: '"Press Start 2P", cursive',
              fontSize: '48px',
              lineHeight: 1.3,
              color: 'white',
              letterSpacing: '0.05em',
              marginBottom: '32px',
            }}
          >
            {decryptedTitle}
          </motion.h2>

          {/* Orchid QR Code — exact position as hero section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={visible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            style={{
              marginTop: '40px',
            }}
          >
            <QROrchid visible={visible} />
          </motion.div>

          {/* Footer text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={visible ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: 1.5, duration: 0.8 }}
            style={{
              fontFamily: mono,
              fontSize: '11px',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.05em',
              marginTop: '40px',
            }}
          >
            On Telegram. Grow healthier plants through conversation.
          </motion.p>
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
