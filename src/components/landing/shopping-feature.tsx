import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

const mono = "ui-monospace, monospace";

// Density steps for text decryption
const DENSITY_STEPS = ["█", "▓", "▒", "░"];

interface Store {
  name: string;
  distance: string;
  price: string;
  stock: "IN STOCK" | "LOW STOCK";
  x: number; // Position on pixel map
  y: number;
  decryptProgress?: number[]; // Per-character decryption state
}

function decryptChar(cycleCount: number, targetChar: string): string {
  if (targetChar === ' ') return ' ';
  if (cycleCount >= DENSITY_STEPS.length) return targetChar;
  return DENSITY_STEPS[Math.min(cycleCount, DENSITY_STEPS.length - 1)];
}

function PixelMap({ stores, visible }: { stores: Store[]; visible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const PIXEL_SIZE = 4;

    const render = () => {
      if (!visible) {
        animationId = requestAnimationFrame(render);
        return;
      }

      frameRef.current++;
      const frame = frameRef.current;

      // Clear
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lines (subtle)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += PIXEL_SIZE * 8) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += PIXEL_SIZE * 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Roads (horizontal and vertical)
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();

      // Your location (center, pulsing)
      const pulse = 0.8 + Math.sin(frame * 0.08) * 0.2;
      const youX = canvas.width / 2;
      const youY = canvas.height / 2;
      
      ctx.fillStyle = `rgba(255,255,255,${pulse})`;
      ctx.fillRect(youX - PIXEL_SIZE * 2, youY - PIXEL_SIZE * 2, PIXEL_SIZE * 4, PIXEL_SIZE * 4);
      ctx.fillStyle = '#000';
      ctx.fillRect(youX - PIXEL_SIZE, youY - PIXEL_SIZE, PIXEL_SIZE * 2, PIXEL_SIZE * 2);
      
      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('YOU', youX, youY + PIXEL_SIZE * 5);

      // Store locations
      stores.forEach((store, i) => {
        const storeX = youX + store.x;
        const storeY = youY + store.y;
        
        // Pin color based on stock
        const inStock = store.stock === 'IN STOCK';
        const pinColor = inStock ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)';
        
        // Pin shape
        ctx.fillStyle = pinColor;
        ctx.fillRect(storeX - PIXEL_SIZE * 1.5, storeY - PIXEL_SIZE * 3, PIXEL_SIZE * 3, PIXEL_SIZE * 4);
        ctx.fillRect(storeX - PIXEL_SIZE * 0.5, storeY + PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
        
        // Number
        ctx.fillStyle = '#000';
        ctx.font = 'bold 8px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText((i + 1).toString(), storeX, storeY - PIXEL_SIZE * 0.5);
        
        // Connection line to center (dashed)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(youX, youY);
        ctx.lineTo(storeX, storeY);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [stores, visible]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={180}
      className="w-full rendering-pixelated"
      style={{ imageRendering: 'pixelated', border: '1px solid rgba(255,255,255,0.1)' }}
    />
  );
}

function StoreCard({ store, index, visible }: { store: Store; index: number; visible: boolean }) {
  const [decryptProgress, setDecryptProgress] = useState<number[]>(
    new Array(store.name.length).fill(0)
  );
  const frameRef = useRef(0);
  const [displayName, setDisplayName] = useState(store.name);

  useEffect(() => {
    if (!visible) return;

    let animationId: number;
    const DECRYPT_SPEED = 3; // Frames per cycle step

    const animate = () => {
      frameRef.current++;
      const frame = frameRef.current;

      // Update decrypt progress
      const updated = decryptProgress.map((cycles, i) => {
        if (cycles >= DENSITY_STEPS.length) return cycles;
        const charDelay = i * 1.5 + index * 20; // Stagger by char and card
        const charFrames = frame - charDelay;
        const targetCycles = Math.floor(charFrames / DECRYPT_SPEED);
        return Math.min(DENSITY_STEPS.length, Math.max(0, targetCycles));
      });

      setDecryptProgress(updated);

      // Build display text
      const text = store.name
        .split('')
        .map((char, i) => decryptChar(updated[i], char))
        .join('');
      setDisplayName(text);

      const allDone = updated.every(c => c >= DENSITY_STEPS.length);
      if (!allDone) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [visible, store.name, index]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 10 }}
      transition={{ delay: index * 0.15 + 0.4 }}
      style={{
        border: '1px solid rgba(255,255,255,0.2)',
        padding: '12px',
        backgroundColor: 'rgba(255,255,255,0.05)'
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <p
          className="font-mono font-bold text-sm text-white"
          style={{ letterSpacing: '0.02em' }}
        >
          {displayName}
        </p>
        <span
          className="font-mono text-[10px] text-white/40"
          style={{
            backgroundColor: 'rgba(255,255,255,0.1)',
            padding: '2px 8px'
          }}
        >
          {index + 1}
        </span>
      </div>
      <p className="text-xs font-mono text-white/50 mb-2">
        {store.distance} • {store.price}
      </p>
      <span
        className="inline-block text-[9px] font-mono uppercase tracking-wide"
        style={{
          padding: '2px 8px',
          backgroundColor: store.stock === 'IN STOCK' ? 'white' : 'transparent',
          color: store.stock === 'IN STOCK' ? 'black' : 'rgba(255,255,255,0.6)',
          border: store.stock === 'IN STOCK' ? 'none' : '1px solid rgba(255,255,255,0.3)'
        }}
      >
        {store.stock}
      </span>
    </motion.div>
  );
}

export function ShoppingFeature({
  className = "",
  scrollRoot,
}: {
  className?: string;
  scrollRoot?: React.RefObject<HTMLElement | null>;
}) {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  const stores: Store[] = [
    { name: 'Green Thumb Nursery', distance: '0.8 mi', price: '$8.99', stock: 'IN STOCK', x: -80, y: -40 },
    { name: 'Urban Garden Center', distance: '1.2 mi', price: '$9.49', stock: 'IN STOCK', x: -30, y: 50 },
    { name: 'Plant Paradise', distance: '2.1 mi', price: '$7.99', stock: 'LOW STOCK', x: 70, y: -60 },
  ];

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
          <filter id="grain-shopping">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-shopping)" />
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
        FIG 2.5 — LOCAL COMMERCE
      </div>

      <div className="w-full px-4 md:px-16 lg:px-24 z-10 relative">
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Left: Description */}
          <div>
            <h2
              className="text-[22px] md:text-[32px] mt-8 md:mt-0"
              style={{
                ...revealStyle(0),
                fontFamily: '"Press Start 2P", cursive',
                lineHeight: 1.4,
                color: "white",
              }}
            >
              Local<br />
              Shopping
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
              Find what you need, nearby.
            </p>

            <p
              style={{
                ...revealStyle(300),
                fontFamily: mono,
                fontSize: "13px",
                color: "rgba(255,255,255,0.7)",
                lineHeight: 1.8,
                marginTop: 24,
                marginBottom: 32,
                maxWidth: 400,
              }}
            >
              Ask where to buy supplies. Orchid finds local nurseries with verified stock. Can't find it locally? We'll search online options too.
            </p>

            {/* Pixel Map — desktop only, mobile version is in right column */}
            <div className="hidden md:block" style={{ ...revealStyle(450) }}>
              <PixelMap stores={stores} visible={visible} />
            </div>
          </div>

          {/* Right: Store listings */}
          <div>
            {/* User message */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 10 }}
              transition={{ delay: 0.2 }}
              className="flex justify-end mb-4"
            >
              <div
                className="max-w-[80%]"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  padding: '8px 16px'
                }}
              >
                <p className="font-mono text-sm text-white">
                  Where can I get neem oil nearby?
                </p>
              </div>
            </motion.div>

            {/* Pixel Map — mobile only, after user message */}
            <div className="block md:hidden mb-4" style={{ ...revealStyle(450) }}>
              <PixelMap stores={stores} visible={visible} />
            </div>

            {/* Store results */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: visible ? 1 : 0 }}
              transition={{ delay: 0.35 }}
              className="space-y-3"
            >
              <p className="font-mono text-xs uppercase tracking-wider text-white/60 mb-3">
                Found 3 stores near you:
              </p>
              {stores.map((store, i) => (
                <StoreCard key={i} store={store} index={i} visible={visible} />
              ))}
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: visible ? 1 : 0 }}
                transition={{ delay: 1.2 }}
                className="font-mono text-xs text-white/40 pt-3 mt-4"
                style={{ fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.1)' }}
              >
                💡 Can't make it out? I can also find online retailers.
              </motion.p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
