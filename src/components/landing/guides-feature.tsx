import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ImageWithFallback } from '../figma/ImageWithFallback';

const mono = "ui-monospace, monospace";

const DECRYPT_SPEED = 3;
const DENSITY_STEPS = ["█", "▓", "▒", "░", ""];

// Guide steps data with illustrated images
const GUIDE_STEPS = [
  { 
    step: '1', 
    title: 'Cut stem', 
    desc: 'Below leaf node', 
    img: '/prop_pothos/poth_i_1.jpeg' 
  },
  { 
    step: '2', 
    title: 'Remove leaves', 
    desc: 'Bottom 2 inches', 
    img: '/prop_pothos/poth_i_2.jpeg' 
  },
  { 
    step: '3', 
    title: 'Place in water', 
    desc: 'Change weekly', 
    img: '/prop_pothos/poth_i_3.jpeg' 
  },
  { 
    step: '4', 
    title: 'Wait for roots', 
    desc: '2-3 weeks', 
    img: '/prop_pothos/poth_i_4.jpeg' 
  }
];

// Decryption helper
function decryptChar(cycleCount: number, targetChar: string): string {
  if (targetChar === ' ') return ' ';
  if (cycleCount >= DENSITY_STEPS.length) return targetChar;
  return DENSITY_STEPS[Math.min(cycleCount, DENSITY_STEPS.length - 1)];
}

// Decrypting text component
const DecryptText: React.FC<{ text: string; visible: boolean; delay?: number }> = ({ 
  text, 
  visible,
  delay = 0 
}) => {
  const [displayText, setDisplayText] = useState(text);
  const frameRef = React.useRef(0);

  useEffect(() => {
    if (!visible) {
      setDisplayText(text);
      return;
    }

    const chars = text.split('');
    const progress: number[] = new Array(chars.length).fill(0);
    
    let animationId: number;
    const animate = () => {
      frameRef.current++;
      const frame = frameRef.current;
      
      let allDone = true;
      const newText = chars.map((char, i) => {
        if (char === ' ') return ' ';
        
        const charDelay = i * 1.5 + delay;
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
      
      setDisplayText(newText);
      
      if (!allDone) {
        animationId = requestAnimationFrame(animate);
      }
    };
    
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [visible, text, delay]);

  return <span>{displayText}</span>;
};

// Guide step card with image
const GuideStepCard: React.FC<{ 
  step: typeof GUIDE_STEPS[0];
  index: number;
  visible: boolean;
}> = ({ step, index, visible }) => {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={visible ? { scale: 1, opacity: 1 } : { scale: 0.9, opacity: 0 }}
      transition={{ delay: 0.2 + index * 0.1, duration: 0.5 }}
      style={{
        backgroundColor: '#000',
        border: '1px solid rgba(255,255,255,0.3)',
        padding: '16px',
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
          opacity: 0.08,
          pointerEvents: 'none',
          mixBlendMode: 'overlay',
        }}
      />

      {/* Image with pixelated style */}
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <ImageWithFallback 
          src={step.img}
          alt={step.title}
          style={{
            width: '100%',
            aspectRatio: '1',
            objectFit: 'cover',
            border: '1px solid rgba(255,255,255,0.4)',
            imageRendering: 'pixelated',
            filter: 'contrast(1.1) brightness(1.0) saturate(0.75)',
          }}
        />
      </div>

      {/* Step info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <div
          style={{
            width: '20px',
            height: '20px',
            backgroundColor: '#fff',
            color: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 'bold',
            border: '1px solid #fff',
          }}
        >
          {step.step}
        </div>
        <p
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 'bold',
            fontSize: '11px',
            textTransform: 'uppercase',
            color: '#fff',
            letterSpacing: '0.05em',
          }}
        >
          <DecryptText text={step.title} visible={visible} delay={index * 5} />
        </p>
      </div>

      <p
        style={{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.6)',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        {step.desc}
      </p>
    </motion.div>
  );
};

export function GuidesFeature({
  className = "",
  scrollRoot,
}: {
  className?: string;
  scrollRoot?: React.RefObject<HTMLElement | null>;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = React.useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3, root: scrollRoot?.current ?? null }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  const revealStyle = (delay: number): React.CSSProperties => ({
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? "translateY(0)" : "translateY(12px)",
    transition: "all 600ms ease-out",
    transitionDelay: isVisible ? `${delay}ms` : "0ms",
  });

  return (
    <section
      ref={sectionRef}
      className={`snap-start w-full min-h-screen flex items-center justify-center bg-black relative overflow-hidden ${className}`}
    >
      {/* Grain overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04] mix-blend-screen z-40">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <filter id="grain-guides">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-guides)" />
        </svg>
      </div>
      {/* Figure annotation */}
      <div
        className="absolute transition-all duration-600 ease-out hidden md:block"
        style={{
          top: 40,
          right: 40,
          opacity: isVisible ? 0.35 : 0,
          transform: isVisible ? "translateY(0)" : "translateY(6px)",
          transitionDelay: isVisible ? "100ms" : "0ms",
          fontFamily: mono,
          fontSize: "11px",
          color: "white",
          letterSpacing: "0.12em",
          zIndex: 10,
        }}
      >
        FIG 2.6 — VISUAL PROTOCOL
      </div>

      <div className="w-full px-4 md:px-16 lg:px-24 z-10 relative">
        <div className="max-w-[1400px] mx-auto">
          {/* Top: Description */}
          <div className="text-center mb-12">
            <h2
              className="text-[22px] md:text-[32px]"
              style={{
                ...revealStyle(0),
                fontFamily: '"Press Start 2P", cursive',
                lineHeight: 1.4,
                color: "white",
              }}
            >
              Visual Guides
            </h2>

            <p
              style={{
                ...revealStyle(150),
                fontFamily: mono,
                fontSize: "15px",
                color: "rgba(255,255,255,0.5)",
                marginTop: 20,
                fontStyle: "italic",
              }}
            >
              Learn by seeing, not just reading.
            </p>

            <p
              style={{
                ...revealStyle(300),
                fontFamily: mono,
                fontSize: "13px",
                color: "rgba(255,255,255,0.7)",
                lineHeight: 1.8,
                marginTop: 16,
                maxWidth: 600,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              Orchid sends illustrated step-by-step guides for propagation, repotting, and pruning—tailored to your plant.
            </p>
          </div>

          {/* Bottom: Horizontal steps */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {GUIDE_STEPS.map((step, i) => (
              <GuideStepCard key={i} step={step} index={i} visible={isVisible} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
