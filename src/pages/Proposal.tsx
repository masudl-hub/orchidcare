import { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Play } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { MemoryOrb } from '@/components/landing/MemoryOrb';
import { QROrchid } from '@/components/landing/qr-orchid';
import { BackButton } from '@/components/ui/back-button';

// ─── Constants ──────────────────────────────────────────────────────────────

const mono = "ui-monospace, monospace";
const pressStart = '"Press Start 2P", cursive';
const DENSITY_STEPS = ["█", "▓", "▒", "░", ""];
const DECRYPT_SPEED = 3;

// ─── Reusable Hooks & Utilities ─────────────────────────────────────────────

function useInView(threshold = 0.2, root?: React.RefObject<HTMLElement | null>) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold, root: root?.current ?? null }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, root]);

  return { ref, visible };
}

function revealStyle(visible: boolean, delay: number): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(12px)",
    transition: "all 800ms ease-out",
    transitionDelay: visible ? `${delay}ms` : "0ms",
  };
}

// ─── Decrypt Title Hook ─────────────────────────────────────────────────────

function useDecryptText(text: string, visible: boolean, charDelay = 1.5, skip = false) {
  const [decrypted, setDecrypted] = useState(text);
  const frameRef = useRef(0);

  useEffect(() => {
    if (skip) { setDecrypted(text); return; }
    if (!visible) { setDecrypted(text); return; }

    const chars = text.split('');
    let animationId: number;

    const animate = () => {
      frameRef.current++;
      const frame = frameRef.current;
      let allDone = true;

      const newText = chars.map((char, i) => {
        if (char === ' ') return ' ';
        const charFrames = frame - i * charDelay;
        if (charFrames < 0) { allDone = false; return DENSITY_STEPS[0]; }
        const cycles = Math.floor(charFrames / DECRYPT_SPEED);
        if (cycles >= DENSITY_STEPS.length) return char;
        allDone = false;
        return DENSITY_STEPS[Math.min(cycles, DENSITY_STEPS.length - 1)];
      }).join('');

      setDecrypted(newText);
      if (!allDone) animationId = requestAnimationFrame(animate);
    };

    frameRef.current = 0;
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [visible, text, charDelay, skip]);

  return decrypted;
}

// ─── Animated Counter Hook ──────────────────────────────────────────────────

function useCountUp(target: number, visible: boolean, duration = 1500, decimals = 0) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const start = performance.now();
    let animationId: number;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Number((eased * target).toFixed(decimals)));
      if (progress < 1) animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [visible, target, duration, decimals]);

  return value;
}

// ─── Figure Annotation ──────────────────────────────────────────────────────

function FigureAnnotation({ label, visible }: { label: string; visible: boolean }) {
  return (
    <div
      className="absolute transition-all duration-600 ease-out z-10"
      style={{
        top: 40, right: 40,
        opacity: visible ? 0.35 : 0,
        transform: visible ? "translateY(0)" : "translateY(6px)",
        transitionDelay: visible ? "100ms" : "0ms",
        fontFamily: mono, fontSize: "11px", color: "white",
        letterSpacing: "0.12em",
      }}
    >
      {label}
    </div>
  );
}

// ─── Generative Pixel Art ───────────────────────────────────────────────────

// Procedural branching plant — grows a unique tree on every load
function PixelGrowth({ visible }: { visible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasDrawn = useRef(false);

  useEffect(() => {
    if (!visible || hasDrawn.current) return;
    hasDrawn.current = true;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cell = 3;
    const cols = 56;
    const rows = 64;
    canvas.width = cols * cell;
    canvas.height = rows * cell;

    const queue: [number, number][] = [];
    const placed = new Set<string>();

    const put = (x: number, y: number) => {
      const rx = Math.round(x), ry = Math.round(y);
      const k = `${rx},${ry}`;
      if (rx >= 0 && rx < cols && ry >= 0 && ry < rows && !placed.has(k)) {
        placed.add(k);
        queue.push([rx, ry]);
      }
    };

    const grow = (x: number, y: number, a: number, len: number, d: number) => {
      if (d <= 0 || len < 1) return;
      for (let i = 0; i <= Math.ceil(len); i++) {
        put(x + Math.cos(a) * i, y - Math.sin(a) * i);
      }
      const ex = x + Math.cos(a) * len;
      const ey = y - Math.sin(a) * len;
      const s = 0.28 + Math.random() * 0.32;
      const r = 0.58 + Math.random() * 0.17;
      grow(ex, ey, a + s, len * r, d - 1);
      grow(ex, ey, a - s, len * r, d - 1);
      // Terminal blooms
      if (d <= 2) {
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++)
            if (Math.abs(dx) + Math.abs(dy) <= 1) put(ex + dx, ey + dy);
      }
    };

    grow(cols / 2, rows - 1, Math.PI / 2 + 0.08, 15, 8);
    grow(cols / 2 + 1, rows - 2, Math.PI / 2 - 0.12, 12, 7);

    queue.sort((a, b) => b[1] - a[1]);

    let i = 0;
    const batch = Math.max(3, Math.floor(queue.length / 100));
    const tick = () => {
      if (i >= queue.length) return;
      const end = Math.min(i + batch, queue.length);
      for (let j = i; j < end; j++) {
        const [cx, cy] = queue[j];
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillRect(cx * cell, cy * cell, cell - 0.5, cell - 0.5);
      }
      i = end;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [visible]);

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />;
}

// Cellular entropy — 16×16 grid decays from 100% to ~35% alive
function DecayMatrix({ visible }: { visible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (!visible || hasRun.current) return;
    hasRun.current = true;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 16;
    const cell = 7;
    const gap = 2;
    const step = cell + gap;
    canvas.width = size * step - gap;
    canvas.height = size * step - gap;

    const alive = Array(size * size).fill(true);
    const targetDead = Math.floor(size * size * 0.65);

    for (let i = 0; i < alive.length; i++) {
      const x = (i % size) * step;
      const y = Math.floor(i / size) * step;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(x, y, cell, cell);
    }

    let killed = 0;
    const killTimer = setInterval(() => {
      const batch = 1 + Math.floor(Math.random() * 3);
      for (let b = 0; b < batch && killed < targetDead; b++) {
        let idx: number;
        do { idx = Math.floor(Math.random() * alive.length); } while (!alive[idx]);
        alive[idx] = false;
        killed++;
        const x = (idx % size) * step;
        const y = Math.floor(idx / size) * step;
        // Flash before dying
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x, y, cell, cell);
        setTimeout(() => ctx.clearRect(x, y, cell, cell), 120);
      }
      if (killed >= targetDead) clearInterval(killTimer);
    }, 45);

    return () => clearInterval(killTimer);
  }, [visible]);

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />;
}

// Signal flow — animated data packets through a 4-layer architecture
function SignalFlow({ visible }: { visible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!visible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const px = 4;
    const layers = [
      { x: 4, nodes: [2, 4, 6] },      // INPUT
      { x: 16, nodes: [1, 3, 5, 7] },   // PROCESS
      { x: 28, nodes: [2, 4, 6] },      // MEMORY
      { x: 40, nodes: [3, 5] },         // OUTPUT
    ];
    const labels = ['INPUT', 'PROCESS', 'MEMORY', 'OUTPUT'];
    const w = 48;
    const h = 10;
    canvas.width = w * px;
    canvas.height = h * px;

    let frame = 0;
    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let l = 0; l < layers.length - 1; l++) {
        for (const fromY of layers[l].nodes) {
          for (const toY of layers[l + 1].nodes) {
            ctx.beginPath();
            ctx.moveTo(layers[l].x * px + px / 2, fromY * px + px / 2);
            ctx.lineTo(layers[l + 1].x * px + px / 2, toY * px + px / 2);
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (let l = 0; l < layers.length; l++) {
        for (const ny of layers[l].nodes) {
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(layers[l].x * px, ny * px, px, px);
        }
      }

      // Animate pulse: a bright "wave" moves through layers
      const cycleLen = 80;
      const progress = (frame % cycleLen) / cycleLen;
      const activeLayer = Math.floor(progress * layers.length);
      const layerProgress = (progress * layers.length) % 1;

      for (const ny of layers[activeLayer].nodes) {
        const brightness = Math.sin(layerProgress * Math.PI);
        ctx.fillStyle = `rgba(255,255,255,${0.25 + brightness * 0.65})`;
        ctx.fillRect(layers[activeLayer].x * px, ny * px, px, px);
      }

      // Signal packets traveling between layers
      if (activeLayer < layers.length - 1) {
        const fromLayer = layers[activeLayer];
        const toLayer = layers[activeLayer + 1];
        const fi = Math.floor(Math.random() * fromLayer.nodes.length);
        const ti = Math.floor(Math.random() * toLayer.nodes.length);
        const fx = fromLayer.x, fy = fromLayer.nodes[fi];
        const tx = toLayer.x, ty = toLayer.nodes[ti];
        const px2 = fx + (tx - fx) * layerProgress;
        const py2 = fy + (ty - fy) * layerProgress;
        ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(layerProgress * Math.PI) * 0.5})`;
        ctx.fillRect(Math.round(px2) * px, Math.round(py2) * px, px, px);
      }

      // Layer labels
      ctx.font = '7px ui-monospace, monospace';
      ctx.textAlign = 'center';
      for (let l = 0; l < layers.length; l++) {
        ctx.fillStyle = l === activeLayer ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)';
        ctx.fillText(labels[l], layers[l].x * px + px / 2, (h - 0.3) * px);
      }

      frame++;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [visible]);

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />;
}

// 1-bit pixel art for problem cards — each theme gets a unique canvas glyph
function ProblemGlyph({ theme, visible }: { theme: 'overload' | 'reactive' | 'fatigue' | 'personal'; visible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasDrawn = useRef(false);

  useEffect(() => {
    if (!visible || hasDrawn.current) return;
    hasDrawn.current = true;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cell = 3;
    const cols = 24;
    const rows = 28;
    canvas.width = cols * cell;
    canvas.height = rows * cell;

    const put = (x: number, y: number, a = 0.85) => {
      if (x >= 0 && x < cols && y >= 0 && y < rows) {
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(x * cell, y * cell, cell - 0.5, cell - 0.5);
      }
    };

    if (theme === 'overload') {
      // Dense noise/static — information chaos
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          // Gradient: denser at top, sparse at bottom (information cascading down)
          const density = 0.65 - (y / rows) * 0.45;
          if (Math.random() < density) {
            const a = 0.2 + Math.random() * 0.65;
            put(x, y, a);
          }
        }
      }
      // A few brighter "signal" lines cutting through the noise
      for (let s = 0; s < 3; s++) {
        const sy = 4 + Math.floor(Math.random() * (rows - 8));
        for (let x = 0; x < cols; x++) {
          if (Math.random() > 0.15) put(x, sy, 0.9);
        }
      }
    } else if (theme === 'reactive') {
      // Wilting plant silhouette — stem bending, leaves drooping
      const cx = Math.floor(cols / 2);
      // Pot base
      for (let x = cx - 3; x <= cx + 3; x++) { put(x, rows - 1); put(x, rows - 2); }
      for (let x = cx - 2; x <= cx + 2; x++) { put(x, rows - 3); }
      // Stem — starts straight, then curves/bends right (wilting)
      for (let y = rows - 4; y >= 8; y--) {
        const drift = y < 14 ? Math.floor((14 - y) * 0.7) : 0;
        put(cx + drift, y);
        if (y < 12) put(cx + drift + 1, y, 0.4); // thickening
      }
      // Drooping leaves
      const leaves = [
        { sy: 10, dir: 1, len: 6 },  // right leaf, drooping
        { sy: 12, dir: -1, len: 5 }, // left leaf
        { sy: 8, dir: 1, len: 4 },
        { sy: 14, dir: -1, len: 4 },
      ];
      for (const leaf of leaves) {
        const stemX = cx + (leaf.sy < 14 ? Math.floor((14 - leaf.sy) * 0.7) : 0);
        for (let i = 1; i <= leaf.len; i++) {
          // Leaves droop downward (positive y offset increases)
          const droop = Math.floor(i * i * 0.15);
          put(stemX + i * leaf.dir, leaf.sy + droop, 0.7);
          if (i > 2) put(stemX + i * leaf.dir, leaf.sy + droop + 1, 0.3);
        }
      }
      // Fallen pixels on ground
      for (let i = 0; i < 5; i++) {
        put(cx - 5 + Math.floor(Math.random() * 11), rows - 1 - Math.floor(Math.random() * 2), 0.2);
      }
    } else if (theme === 'fatigue') {
      // Grid of identical app icons — monotonous, oppressive repetition
      const iconSize = 3;
      const spacing = 2;
      const totalSlot = iconSize + spacing;
      const offsetX = 1;
      const offsetY = 2;
      let count = 0;
      for (let gy = 0; gy * totalSlot + offsetY + iconSize <= rows; gy++) {
        for (let gx = 0; gx * totalSlot + offsetX + iconSize <= cols; gx++) {
          const bx = offsetX + gx * totalSlot;
          const by = offsetY + gy * totalSlot;
          // Each "icon" is a small square, most are dim/same
          const isFaded = count > 3; // first few brighter, rest fade
          const alpha = isFaded ? 0.15 + Math.random() * 0.1 : 0.7;
          for (let dy = 0; dy < iconSize; dy++) {
            for (let dx = 0; dx < iconSize; dx++) {
              // Hollow square for app icon shape
              if (dy === 0 || dy === iconSize - 1 || dx === 0 || dx === iconSize - 1) {
                put(bx + dx, by + dy, alpha);
              }
            }
          }
          count++;
        }
      }
      // One "X" through the grid — frustration
      for (let d = 0; d < Math.min(cols, rows); d++) {
        put(d, d, 0.35);
        put(cols - 1 - d, d, 0.35);
      }
    } else if (theme === 'personal') {
      // Uniform rows of identical shapes — no individuality
      const rowH = 4;
      const gap = 2;
      for (let gy = 0; (gy + 1) * (rowH + gap) <= rows; gy++) {
        const by = gy * (rowH + gap) + 1;
        // Identical plant shapes in a row — cookie-cutter
        for (let gx = 0; gx < 4; gx++) {
          const bx = 1 + gx * 6;
          // Identical small triangle "tree"
          put(bx + 2, by, 0.5);
          put(bx + 1, by + 1, 0.5); put(bx + 2, by + 1, 0.5); put(bx + 3, by + 1, 0.5);
          put(bx, by + 2, 0.5); put(bx + 1, by + 2, 0.5); put(bx + 2, by + 2, 0.5); put(bx + 3, by + 2, 0.5); put(bx + 4, by + 2, 0.5);
          // Stem
          put(bx + 2, by + 3, 0.4);
        }
      }
      // "=" sign overlay — everything treated the same
      const my = Math.floor(rows / 2);
      for (let x = 3; x < cols - 3; x++) {
        put(x, my - 1, 0.65);
        put(x, my + 1, 0.65);
      }
    }
  }, [visible, theme]);

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />;
}

// 1-bit pixel art for tech bento cells
function TechGlyph({ theme, visible, size = 32 }: { theme: 'eye' | 'brain' | 'bell' | 'chat'; visible: boolean; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasDrawn = useRef(false);

  useEffect(() => {
    if (!visible || hasDrawn.current) return;
    hasDrawn.current = true;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cell = 3;
    const cols = size;
    const rows = size;
    canvas.width = cols * cell;
    canvas.height = rows * cell;

    const put = (x: number, y: number, a = 0.8) => {
      if (x >= 0 && x < cols && y >= 0 && y < rows) {
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(x * cell, y * cell, cell - 0.5, cell - 0.5);
      }
    };

    if (theme === 'eye') {
      // Camera/eye — seeing, identifying
      const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
      // Outer lens ring
      for (let a = 0; a < Math.PI * 2; a += 0.08) {
        const r = 10;
        put(cx + Math.round(Math.cos(a) * r), cy + Math.round(Math.sin(a) * r), 0.5);
        const r2 = 11;
        put(cx + Math.round(Math.cos(a) * r2), cy + Math.round(Math.sin(a) * r2), 0.3);
      }
      // Inner pupil
      for (let a = 0; a < Math.PI * 2; a += 0.1) {
        const r = 4;
        put(cx + Math.round(Math.cos(a) * r), cy + Math.round(Math.sin(a) * r), 0.9);
      }
      // Pupil fill
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (dx * dx + dy * dy <= 9) put(cx + dx, cy + dy, 0.6);
        }
      }
      // Center bright pixel
      put(cx, cy, 1); put(cx - 1, cy - 1, 0.9);
      // Scan lines radiating out
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 4) * (i * 2 + 0.5);
        for (let r = 12; r < 15; r++) {
          put(cx + Math.round(Math.cos(a) * r), cy + Math.round(Math.sin(a) * r), 0.2);
        }
      }
    } else if (theme === 'brain') {
      // Memory network — interconnected nodes
      const nodes: [number, number][] = [];
      // Place nodes in a rough brain shape
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = 7 + Math.random() * 4;
        const nx = Math.floor(cols / 2 + Math.cos(a) * r);
        const ny = Math.floor(rows / 2 + Math.sin(a) * r);
        nodes.push([nx, ny]);
      }
      // Add central nodes
      nodes.push([Math.floor(cols / 2), Math.floor(rows / 2)]);
      nodes.push([Math.floor(cols / 2) - 3, Math.floor(rows / 2) + 2]);
      nodes.push([Math.floor(cols / 2) + 3, Math.floor(rows / 2) - 1]);

      // Draw connections (Bresenham-like)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dist = Math.sqrt((nodes[i][0] - nodes[j][0]) ** 2 + (nodes[i][1] - nodes[j][1]) ** 2);
          if (dist < 12) {
            const steps = Math.ceil(dist);
            for (let s = 0; s <= steps; s++) {
              const t = s / steps;
              const x = Math.round(nodes[i][0] + (nodes[j][0] - nodes[i][0]) * t);
              const y = Math.round(nodes[i][1] + (nodes[j][1] - nodes[i][1]) * t);
              put(x, y, 0.15);
            }
          }
        }
      }
      // Draw nodes as bright dots
      for (const [nx, ny] of nodes) {
        put(nx, ny, 0.9);
        put(nx + 1, ny, 0.5); put(nx - 1, ny, 0.5);
        put(nx, ny + 1, 0.5); put(nx, ny - 1, 0.5);
      }
    } else if (theme === 'bell') {
      // Alert/proactive — bell with ripples
      const cx = Math.floor(cols / 2);
      // Bell dome
      for (let a = 0; a <= Math.PI; a += 0.08) {
        const r = 7;
        put(cx + Math.round(Math.cos(a) * r), Math.floor(rows / 2) - Math.round(Math.sin(a) * r), 0.7);
      }
      // Bell body
      for (let y = Math.floor(rows / 2); y <= Math.floor(rows / 2) + 6; y++) {
        const width = 7 + Math.floor((y - rows / 2) * 0.8);
        put(cx - width, y, 0.5);
        put(cx + width, y, 0.5);
      }
      // Bell bottom flare
      const by = Math.floor(rows / 2) + 7;
      for (let x = cx - 9; x <= cx + 9; x++) put(x, by, 0.6);
      for (let x = cx - 10; x <= cx + 10; x++) put(x, by + 1, 0.5);
      // Clapper
      put(cx, by + 3, 0.7); put(cx, by + 2, 0.5);
      // Ripple arcs
      for (let ring = 0; ring < 3; ring++) {
        const r = 12 + ring * 2;
        const alpha = 0.25 - ring * 0.07;
        for (let a = -0.6; a <= 0.6; a += 0.1) {
          put(cx + Math.round(Math.cos(a - Math.PI / 2) * r), Math.floor(rows / 2) - 4 + Math.round(Math.sin(a - Math.PI / 2) * r), alpha);
        }
      }
    } else if (theme === 'chat') {
      // Chat bubbles — conversational interface
      // Large bubble (bot)
      for (let y = 6; y <= 14; y++) {
        for (let x = 4; x <= 20; x++) {
          if (y === 6 || y === 14) put(x, y, 0.4);
          else if (x === 4 || x === 20) put(x, y, 0.4);
        }
      }
      // Tail
      put(6, 15, 0.3); put(5, 16, 0.3);
      // Text lines inside
      for (let x = 6; x <= 18; x++) { if (Math.random() > 0.2) put(x, 8, 0.25); }
      for (let x = 6; x <= 15; x++) { if (Math.random() > 0.2) put(x, 10, 0.25); }
      for (let x = 6; x <= 12; x++) { if (Math.random() > 0.25) put(x, 12, 0.25); }
      // Small bubble (user) — offset right and lower
      for (let y = 17; y <= 23; y++) {
        for (let x = 10; x <= 26; x++) {
          if (y === 17 || y === 23) put(x, y, 0.6);
          else if (x === 10 || x === 26) put(x, y, 0.6);
        }
      }
      // Tail
      put(24, 24, 0.5); put(25, 25, 0.5);
      // Text lines
      for (let x = 12; x <= 24; x++) { if (Math.random() > 0.15) put(x, 19, 0.35); }
      for (let x = 12; x <= 20; x++) { if (Math.random() > 0.2) put(x, 21, 0.35); }
    }
  }, [visible, theme, size]);

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />;
}

// 1-bit pixel art for implementation/architecture bento cells
function ArchGlyph({ theme, visible, size = 32 }: { theme: 'messaging' | 'dashboard' | 'stack' | 'launch'; visible: boolean; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasDrawn = useRef(false);

  useEffect(() => {
    if (!visible || hasDrawn.current) return;
    hasDrawn.current = true;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cell = 3;
    const cols = size;
    const rows = size;
    canvas.width = cols * cell;
    canvas.height = rows * cell;

    const put = (x: number, y: number, a = 1) => {
      if (x >= 0 && x < cols && y >= 0 && y < rows) {
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(x * cell, y * cell, cell - 0.5, cell - 0.5);
      }
    };

    if (theme === 'messaging') {
      // Phone outline with chat bubbles inside
      const px = 8, py = 3, pw = 16, ph = 26;
      // Phone frame
      for (let x = px; x <= px + pw; x++) { put(x, py); put(x, py + ph); }
      for (let y = py; y <= py + ph; y++) { put(px, y); put(px + pw, y); }
      // Screen inner area
      for (let x = px + 2; x <= px + pw - 2; x++) put(x, py + 3, 0.3);
      // Home button dot
      put(px + pw / 2, py + ph - 1, 0.5);
      // Chat bubbles inside
      for (let x = px + 3; x <= px + 10; x++) put(x, py + 7, 0.7);
      for (let x = px + 3; x <= px + 8; x++) put(x, py + 9, 0.7);
      // User reply (right-aligned)
      for (let x = px + 8; x <= px + pw - 3; x++) put(x, py + 13, 0.5);
      for (let x = px + 10; x <= px + pw - 3; x++) put(x, py + 15, 0.5);
      // Bot reply
      for (let x = px + 3; x <= px + 12; x++) put(x, py + 19, 0.7);
      // Typing indicator dots
      put(px + 3, py + 22, 0.4); put(px + 5, py + 22, 0.4); put(px + 7, py + 22, 0.4);
    } else if (theme === 'dashboard') {
      // Browser window with grid layout
      const bx = 3, by = 3, bw = 26, bh = 24;
      // Window frame
      for (let x = bx; x <= bx + bw; x++) { put(x, by); put(x, by + bh); }
      for (let y = by; y <= by + bh; y++) { put(bx, y); put(bx + bw, y); }
      // Title bar
      for (let x = bx; x <= bx + bw; x++) put(x, by + 2, 0.3);
      // Window dots
      put(bx + 2, by + 1, 0.6); put(bx + 4, by + 1, 0.4); put(bx + 6, by + 1, 0.4);
      // Sidebar
      for (let y = by + 3; y <= by + bh - 1; y++) put(bx + 7, y, 0.2);
      // Sidebar items
      for (let i = 0; i < 4; i++) {
        for (let x = bx + 2; x <= bx + 5; x++) put(x, by + 5 + i * 3, 0.35);
      }
      // Content area — chart-like bars
      for (let i = 0; i < 4; i++) {
        const h = 3 + Math.floor(Math.random() * 8);
        for (let dy = 0; dy < h; dy++) {
          put(bx + 11 + i * 4, by + bh - 2 - dy, 0.5);
          put(bx + 12 + i * 4, by + bh - 2 - dy, 0.5);
        }
      }
    } else if (theme === 'stack') {
      // Layered blocks — stacked architecture
      const layers = [
        { y: 4, w: 20, label: 4 },   // AI
        { y: 10, w: 22, label: 5 },  // API
        { y: 16, w: 24, label: 6 },  // DB
        { y: 22, w: 18, label: 3 },  // Infra
      ];
      for (const layer of layers) {
        const lx = Math.floor((cols - layer.w) / 2);
        // Block outline
        for (let x = lx; x <= lx + layer.w; x++) { put(x, layer.y); put(x, layer.y + 4); }
        for (let y = layer.y; y <= layer.y + 4; y++) { put(lx, y); put(lx + layer.w, y); }
        // Fill with dots
        for (let x = lx + 2; x < lx + layer.w - 1; x += 2) {
          put(x, layer.y + 2, 0.3);
        }
      }
      // Connecting lines between layers
      const cx = Math.floor(cols / 2);
      for (const layer of layers.slice(0, -1)) {
        for (let y = layer.y + 5; y < layer.y + 6 + 4; y++) {
          if (y < rows) put(cx, y, 0.2);
        }
      }
    } else if (theme === 'launch') {
      // Rocket / upward arrow — launch/progress
      const cx = Math.floor(cols / 2);
      // Arrow tip
      put(cx, 4); put(cx - 1, 5); put(cx + 1, 5);
      put(cx - 2, 6); put(cx + 2, 6);
      put(cx - 3, 7); put(cx + 3, 7);
      // Body
      for (let y = 7; y <= 20; y++) {
        put(cx - 1, y, 0.7); put(cx, y, 0.8); put(cx + 1, y, 0.7);
      }
      // Fins
      put(cx - 3, 18, 0.5); put(cx - 2, 19, 0.5); put(cx - 2, 20, 0.5);
      put(cx + 3, 18, 0.5); put(cx + 2, 19, 0.5); put(cx + 2, 20, 0.5);
      // Exhaust particles
      for (let i = 0; i < 8; i++) {
        const ex = cx - 2 + Math.floor(Math.random() * 5);
        const ey = 22 + Math.floor(Math.random() * 6);
        put(ex, ey, 0.15 + Math.random() * 0.25);
      }
      // Progress bar at bottom
      for (let x = 5; x < cols - 5; x++) put(x, rows - 3, 0.8);
      for (let x = 5; x < cols - 5; x++) put(x, rows - 2, 0.15);
    }
  }, [visible, theme, size]);

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />;
}

// Generative pixel glyph — increasing geometric complexity per tier
function ComplexityGlyph({ level }: { level: 0 | 1 | 2 }) {
  const patterns = [
    // Tier 0 — sparse diamond: a seed, simple
    [
      '........',
      '...##...',
      '..#..#..',
      '.#....#.',
      '.#....#.',
      '..#..#..',
      '...##...',
      '........',
    ],
    // Tier 1 — structured lattice: growing, organized
    [
      '.#....#.',
      '#.#..#.#',
      '.#.##.#.',
      '..####..',
      '..####..',
      '.#.##.#.',
      '#.#..#.#',
      '.#....#.',
    ],
    // Tier 2 — dense weave: mastery, intricate
    [
      '#.##.##.',
      '.##..##.',
      '##.##.##',
      '.##..##.',
      '##.##.##',
      '.##..##.',
      '#.##.##.',
      '.##..##.',
    ],
  ];

  const grid = patterns[level];
  const cell = 3;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(8, ${cell}px)`,
      gap: '1px',
    }}>
      {grid.flatMap((row, y) =>
        row.split('').map((c, x) => (
          <div
            key={`${y}-${x}`}
            style={{
              width: cell, height: cell,
              backgroundColor: c === '#' ? 'rgba(255,255,255,0.2)' : 'transparent',
            }}
          />
        ))
      )}
    </div>
  );
}

// ─── Grain Overlay ──────────────────────────────────────────────────────────

function GrainOverlay() {
  return (
    <div className="fixed inset-0 pointer-events-none opacity-[0.04] mix-blend-screen z-50">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <filter id="grain-proposal">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-proposal)" />
      </svg>
    </div>
  );
}

// ─── Plant Vision Component (restyled) ──────────────────────────────────────

const PlantVision = ({
  plantName, scientificName, folder, imgName, confidence, traits, delay
}: {
  plantName: string; scientificName: string; folder: string; imgName?: string;
  confidence: string; traits: string; delay: number;
}) => {
  const baseName = imgName || folder;
  return (
    <div
      className="overflow-hidden transition-all duration-300"
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        transitionDelay: `${delay * 1000}ms`,
      }}
    >
      <div className="aspect-square bg-black relative overflow-hidden flex items-center justify-center p-4">
        <img
          src={`/plant_assets_art/${folder}/${baseName}_transparent.png`}
          alt={plantName}
          className="w-full h-full object-contain"
        />
      </div>
      <div
        className="p-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <p style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Identified</p>
        <p style={{ fontFamily: mono, fontSize: "15px", color: "white", fontWeight: "bold", marginTop: 4 }}>{plantName}</p>
        <p style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.4)", fontStyle: "italic", marginTop: 2 }}>{scientificName}</p>
        <p style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.5)", marginTop: 8 }}>{confidence} · {traits}</p>
      </div>
    </div>
  );
};

// ─── Waffle Grid (Plant Death Causes) ───────────────────────────────────────

function WaffleGrid({ visible }: { visible: boolean }) {
  const [filledCount, setFilledCount] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!visible || hasAnimated.current) return;
    hasAnimated.current = true;
    
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setFilledCount(count);
      if (count >= 100) clearInterval(interval);
    }, 25);
    return () => clearInterval(interval);
  }, [visible]);

  const getColor = (i: number) => {
    if (i < 57) return "rgba(255,255,255,0.9)"; // overwatering
    if (i < 75) return "rgba(255,255,255,0.5)"; // poor light
    if (i < 87) return "rgba(255,255,255,0.25)"; // underwatering
    return "rgba(255,255,255,0.1)"; // other
  };

  const categories = [
    { name: "OVERWATERING", value: "57%", threshold: 57 },
    { name: "POOR LIGHT", value: "18%", threshold: 75 },
    { name: "UNDERWATERING", value: "12%", threshold: 87 },
    { name: "OTHER", value: "13%", threshold: 100 },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-12 items-start">
      {/* Grid */}
      <div className="grid grid-cols-10 gap-[3px]" style={{ width: "fit-content" }}>
        {Array.from({ length: 100 }, (_, i) => (
          <div
            key={i}
            style={{
              width: 28, height: 28,
              border: "1px solid rgba(255,255,255,0.08)",
              backgroundColor: i < filledCount ? getColor(i) : "transparent",
              transition: "background-color 60ms ease-out",
            }}
          />
        ))}
      </div>

      {/* Labels */}
      <div className="flex flex-col gap-4 mt-2">
        {categories.map((cat) => (
          <div
            key={cat.name}
            className="flex items-center gap-3 transition-opacity duration-500"
            style={{ opacity: filledCount >= cat.threshold ? 1 : 0.2 }}
          >
            <div style={{
              width: 12, height: 12,
              backgroundColor: getColor(cat.threshold - 1),
              flexShrink: 0,
            }} />
            <span style={{ fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.7)", letterSpacing: "0.06em" }}>
              {cat.name}
            </span>
            <span style={{ fontFamily: mono, fontSize: "14px", color: "white", fontWeight: "bold" }}>
              {cat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Terminal Typewriter ────────────────────────────────────────────────────

function TerminalLines({ lines, visible }: { lines: string[]; visible: boolean }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const lineIdx = useRef(0);
  const charIdx = useRef(0);
  const hasAnimated = useRef(false);
  const linesRef = useRef(lines);
  linesRef.current = lines;

  useEffect(() => {
    if (!visible || hasAnimated.current) return;
    hasAnimated.current = true;
    
    lineIdx.current = 0;
    charIdx.current = 0;
    setVisibleLines(0);
    setCurrentText("");

    const interval = setInterval(() => {
      const allLines = linesRef.current;
      if (lineIdx.current >= allLines.length) { clearInterval(interval); return; }

      const line = allLines[lineIdx.current];
      charIdx.current++;

      if (charIdx.current >= line.length) {
        setVisibleLines(lineIdx.current + 1);
        setCurrentText("");
        lineIdx.current++;
        charIdx.current = 0;
      } else {
        setCurrentText(line.slice(0, charIdx.current));
      }
    }, 20);

    return () => clearInterval(interval);
  }, [visible]);

  return (
    <div className="flex flex-col gap-2">
      {lines.slice(0, visibleLines).map((line, i) => (
        <div key={i} style={{ fontFamily: mono, fontSize: "14px", color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>&gt; </span>{line}
        </div>
      ))}
      {visibleLines < lines.length && currentText && (
        <div style={{ fontFamily: mono, fontSize: "14px", color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>
          <span style={{ color: "rgba(255,255,255,0.3)" }}>&gt; </span>{currentText}
          <span className="animate-pulse">_</span>
        </div>
      )}
    </div>
  );
}

// ─── Density Progress Bar ───────────────────────────────────────────────────

function DensityBar({ value, maxValue, visible, delay = 0 }: {
  value: number; maxValue: number; visible: boolean; delay?: number;
}) {
  const [progress, setProgress] = useState(0);
  const barLength = 20;

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      let frame = 0;
      const totalFrames = 40;
      const interval = setInterval(() => {
        frame++;
        setProgress(Math.min(frame / totalFrames, 1));
        if (frame >= totalFrames) clearInterval(interval);
      }, 25);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timer);
  }, [visible, delay]);

  const filled = Math.round((value / maxValue) * barLength * progress);
  const bar = "█".repeat(filled) + "░".repeat(barLength - filled);

  return (
    <span style={{ fontFamily: mono, fontSize: "13px", color: "rgba(255,255,255,0.7)", letterSpacing: "0.02em" }}>
      {bar}
    </span>
  );
}

// ─── Side-by-Side Engagement Comparison ─────────────────────────────────────

function EngagementComparison({ visible }: { visible: boolean }) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const metrics = [
    { name: "DAILY OPEN RATE", standalone: 12, messaging: 95, unit: "%" },
    { name: "AVG SESSION TIME", standalone: 2.5, messaging: 8.3, unit: "min" },
    { name: "WEEKLY ENGAGEMENT", standalone: 18, messaging: 82, unit: "%" },
    { name: "30-DAY RETENTION", standalone: 7, messaging: 88, unit: "%" },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-6 w-full">
      {/* Standalone Apps */}
      <div className="flex-1" style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}>
            &gt; STANDALONE APPS
          </span>
        </div>
        <div className="px-5 py-4 flex flex-col gap-5">
          {metrics.map((m, i) => (
            <div
              key={i}
              className="transition-opacity duration-200 cursor-default"
              style={{ opacity: hoveredRow !== null && hoveredRow !== i ? 0.3 : 1 }}
              onMouseEnter={() => setHoveredRow(i)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <div style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", marginBottom: 4 }}>
                {m.name}
              </div>
              <div className="flex items-center gap-3">
                <DensityBar value={m.standalone} maxValue={100} visible={visible} delay={i * 150} />
                <span style={{ fontFamily: mono, fontSize: "13px", color: "rgba(255,255,255,0.5)", minWidth: 50 }}>
                  {m.standalone}{m.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Messaging Platforms */}
      <div className="flex-1" style={{ border: "1px solid rgba(255,255,255,0.25)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
          <span style={{ fontFamily: mono, fontSize: "12px", color: "white", letterSpacing: "0.08em" }}>
            &gt; MESSAGING PLATFORMS
          </span>
        </div>
        <div className="px-5 py-4 flex flex-col gap-5">
          {metrics.map((m, i) => (
            <div
              key={i}
              className="transition-opacity duration-200 cursor-default"
              style={{ opacity: hoveredRow !== null && hoveredRow !== i ? 0.3 : 1 }}
              onMouseEnter={() => setHoveredRow(i)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <div style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em", marginBottom: 4 }}>
                {m.name}
              </div>
              <div className="flex items-center gap-3">
                <DensityBar value={m.messaging} maxValue={100} visible={visible} delay={i * 150} />
                <span style={{ fontFamily: mono, fontSize: "13px", color: "white", fontWeight: "bold", minWidth: 50 }}>
                  {m.messaging}{m.unit}
                </span>
                {hoveredRow === i && (
                  <span style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                    +{(m.messaging - m.standalone).toFixed(m.unit === "min" ? 1 : 0)}{m.unit}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── AI Adoption Bars ───────────────────────────────────────────────────────

function AdoptionBars({ visible }: { visible: boolean }) {
  const generations = [
    { name: "GEN Z", value: 70 },
    { name: "MILLENNIALS", value: 62 },
    { name: "GEN X", value: 48 },
    { name: "BOOMERS", value: 35 },
  ];

  return (
    <div className="flex flex-col gap-5">
      {generations.map((gen, i) => (
        <div key={gen.name} className="flex items-center gap-4">
          <span style={{
            fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.06em", width: 100, flexShrink: 0, textAlign: "right",
          }}>
            {gen.name}
          </span>
          <DensityBar value={gen.value} maxValue={100} visible={visible} delay={i * 200} />
          <span style={{ fontFamily: mono, fontSize: "14px", color: "white", fontWeight: "bold" }}>
            {gen.value}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Competitive Quadrant ───────────────────────────────────────────────────

function CompetitiveQuadrant({ visible }: { visible: boolean }) {
  const [showDots, setShowDots] = useState(0);
  const [hoveredDot, setHoveredDot] = useState<number | null>(null);

  const competitors = [
    { name: "Websites", x: 10, y: 20, desc: "Static guides, no personalization" },
    { name: "Plant Apps", x: 20, y: 50, desc: "High friction, moderate AI" },
    { name: "Google", x: 40, y: 10, desc: "Requires manual research" },
    { name: "Chatbots", x: 70, y: 30, desc: "Easy access, limited intelligence" },
    { name: "ORCHID", x: 90, y: 90, desc: "Messaging + Gemini 3 + Memory", isOrchid: true },
  ];

  useEffect(() => {
    if (!visible) return;
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setShowDots(count);
      if (count >= competitors.length) clearInterval(interval);
    }, 400);
    return () => clearInterval(interval);
  }, [visible]);

  return (
    <div className="relative w-full" style={{ aspectRatio: "4/3", maxHeight: 500 }}>
      {/* Axes */}
      <div
        className="absolute transition-all duration-1000"
        style={{
          bottom: "10%", left: "10%", right: "10%",
          height: 1, backgroundColor: "rgba(255,255,255,0.2)",
          transform: visible ? "scaleX(1)" : "scaleX(0)",
          transformOrigin: "left",
        }}
      />
      <div
        className="absolute transition-all duration-1000"
        style={{
          bottom: "10%", left: "10%", top: "5%",
          width: 1, backgroundColor: "rgba(255,255,255,0.2)",
          transform: visible ? "scaleY(1)" : "scaleY(0)",
          transformOrigin: "bottom",
          transitionDelay: "200ms",
        }}
      />

      {/* Axis labels */}
      <div style={{
        position: "absolute", bottom: "3%", left: "50%", transform: "translateX(-50%)",
        fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em",
        ...revealStyle(visible, 600),
      }}>
        PLATFORM FRICTION (HIGH → LOW)
      </div>
      <div style={{
        position: "absolute", top: "45%", left: "2%",
        fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em",
        writingMode: "vertical-rl", transform: "rotate(180deg)",
        ...revealStyle(visible, 600),
      }}>
        AI INTELLIGENCE (LOW → HIGH)
      </div>

      {/* Grid lines */}
      {[25, 50, 75].map(pct => (
        <div key={`h-${pct}`} className="absolute" style={{
          left: "10%", right: "10%", bottom: `${10 + pct * 0.85}%`,
          height: 1, borderTop: "1px dashed rgba(255,255,255,0.04)",
        }} />
      ))}
      {[25, 50, 75].map(pct => (
        <div key={`v-${pct}`} className="absolute" style={{
          bottom: "10%", top: "5%", left: `${10 + pct * 0.8}%`,
          width: 1, borderLeft: "1px dashed rgba(255,255,255,0.04)",
        }} />
      ))}

      {/* Dots */}
      {competitors.map((comp, i) => {
        const show = i < showDots;
        return (
          <div
            key={comp.name}
            className="absolute transition-all duration-500 cursor-default"
            style={{
              left: `${10 + comp.x * 0.8}%`,
              bottom: `${10 + comp.y * 0.85}%`,
              transform: "translate(-50%, 50%)",
              opacity: show ? 1 : 0,
            }}
            onMouseEnter={() => setHoveredDot(i)}
            onMouseLeave={() => setHoveredDot(null)}
          >
            {/* Dot */}
            <div style={{
              width: comp.isOrchid ? 20 : 12,
              height: comp.isOrchid ? 20 : 12,
              backgroundColor: comp.isOrchid ? "white" : "rgba(255,255,255,0.4)",
              transition: "all 300ms",
              boxShadow: comp.isOrchid ? "0 0 20px rgba(255,255,255,0.3), 0 0 40px rgba(255,255,255,0.1)" : "none",
            }} />

            {/* Orchid pixel icon overlay */}
            {comp.isOrchid && (
              <img
                src="/plant_assets_art/T_phalaenopsis_orchid/phalaenopsis_orchid_pixel_bw_light.png"
                alt=""
                style={{
                  position: "absolute", top: -14, left: -14,
                  width: 48, height: 48,
                  imageRendering: "pixelated", opacity: 1,
                  pointerEvents: "none",
                }}
              />
            )}

            {/* Label */}
            <div style={{
              position: "absolute",
              top: comp.isOrchid ? -28 : -20,
              left: "50%", transform: "translateX(-50%)",
              fontFamily: mono,
              fontSize: comp.isOrchid ? "12px" : "10px",
              color: comp.isOrchid ? "white" : "rgba(255,255,255,0.6)",
              fontWeight: comp.isOrchid ? "bold" : "normal",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}>
              {comp.name}
            </div>

            {/* Tooltip on hover */}
            {hoveredDot === i && (
              <div style={{
                position: "absolute", top: "120%", left: "50%",
                transform: "translateX(-50%)",
                border: "1px solid rgba(255,255,255,0.15)",
                backgroundColor: "rgba(0,0,0,0.95)",
                padding: "8px 12px",
                fontFamily: mono, fontSize: "11px",
                color: "rgba(255,255,255,0.7)",
                whiteSpace: "nowrap",
                zIndex: 20,
              }}>
                {comp.desc}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Pixel Column Chart (Market Growth) ─────────────────────────────────────

function PixelColumnChart({ visible }: { visible: boolean }) {
  const [animProgress, setAnimProgress] = useState(0);

  const data = [
    { year: '2024', global: 18.5, us: 5.9 },
    { year: '2025', global: 19.4, us: 6.2 },
    { year: '2026', global: 20.4, us: 6.5 },
    { year: '2027', global: 21.5, us: 6.8 },
    { year: '2028', global: 22.6, us: 7.2 },
  ];

  const maxVal = 23;
  const maxBlocks = 20;

  useEffect(() => {
    if (!visible) return;
    let frame = 0;
    const totalFrames = 60;
    const interval = setInterval(() => {
      frame++;
      setAnimProgress(frame / totalFrames);
      if (frame >= totalFrames) clearInterval(interval);
    }, 25);
    return () => clearInterval(interval);
  }, [visible]);

  return (
    <div className="w-full">
      {/* Chart */}
      <div className="flex items-end justify-center gap-3 md:gap-6" style={{ height: 280 }}>
        {data.map((d, colIdx) => {
          const globalBlocks = Math.round((d.global / maxVal) * maxBlocks);
          const usBlocks = Math.round((d.us / maxVal) * maxBlocks);
          const delayFactor = colIdx * 0.15;
          const colProgress = Math.max(0, Math.min((animProgress - delayFactor) / (1 - delayFactor * 0.8), 1));
          const visibleGlobal = Math.round(globalBlocks * colProgress);
          const visibleUs = Math.round(usBlocks * colProgress);

          return (
            <div key={d.year} className="flex flex-col items-center gap-2">
              {/* Value label */}
              <div style={{
                fontFamily: mono, fontSize: "12px", color: "white", fontWeight: "bold",
                opacity: colProgress > 0.8 ? 1 : 0,
                transition: "opacity 300ms",
              }}>
                ${(d.global * colProgress).toFixed(1)}B
              </div>

              {/* Column pair */}
              <div className="flex gap-1">
                {/* Global */}
                <div className="flex flex-col-reverse gap-[2px]">
                  {Array.from({ length: globalBlocks }, (_, i) => (
                    <div key={i} style={{
                      width: 10, height: 10,
                      backgroundColor: i < visibleGlobal ? "rgba(255,255,255,0.85)" : "transparent",
                      border: "1px solid rgba(255,255,255,0.06)",
                      transition: "background-color 50ms",
                    }} />
                  ))}
                </div>
                {/* US */}
                <div className="flex flex-col-reverse gap-[2px]">
                  {Array.from({ length: usBlocks }, (_, i) => (
                    <div key={i} style={{
                      width: 10, height: 10,
                      backgroundColor: i < visibleUs ? "rgba(255,255,255,0.35)" : "transparent",
                      border: "1px solid rgba(255,255,255,0.04)",
                      transition: "background-color 50ms",
                    }} />
                  ))}
                </div>
              </div>

              {/* Year */}
              <div style={{
                fontFamily: mono, fontSize: "11px",
                color: "rgba(255,255,255,0.5)",
                letterSpacing: "0.04em",
              }}>
                {d.year}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-6 mt-6 justify-center">
        <div className="flex items-center gap-2">
          <div style={{ width: 10, height: 10, backgroundColor: "rgba(255,255,255,0.85)" }} />
          <span style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>Global</span>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ width: 10, height: 10, backgroundColor: "rgba(255,255,255,0.35)" }} />
          <span style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>US</span>
        </div>
      </div>
    </div>
  );
}

// ─── Phase Progress Bar ─────────────────────────────────────────────────────

function PhaseProgressBar({ visible }: { visible: boolean }) {
  const phases = [
    { label: "Phase 1", status: "done", desc: "Core agent with plant identification, diagnosis, and conversational memory" },
    { label: "Phase 2", status: "done", desc: "Web dashboard with onboarding flow, plant collection management, and settings" },
    { label: "Phase 3", status: "done", desc: "Proactive messaging system with seasonal tips and health check-ins" },
    { label: "Phase 4", status: "done", desc: "Visual guide generation, shopping integration, and demo polish" },
  ];

  const barLength = 24;
  const doneBlocks = barLength; // All phases complete
  const bar = "█".repeat(doneBlocks) + "░".repeat(barLength - doneBlocks);

  return (
    <div className="flex flex-col gap-6">
      {/* Visual bar */}
      <div style={revealStyle(visible, 200)}>
        <div style={{ fontFamily: mono, fontSize: "16px", color: "rgba(255,255,255,0.7)", letterSpacing: "0.03em" }}>
          {bar}
        </div>
        <div className="flex justify-between mt-2">
          <span style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>START</span>
          <span style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>LAUNCH</span>
        </div>
      </div>

      {/* Phase list */}
      <div className="flex flex-col gap-4">
        {phases.map((p, i) => (
          <div
            key={p.label}
            className="flex items-start gap-4"
            style={{
              ...revealStyle(visible, 400 + i * 150),
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              paddingBottom: 16,
            }}
          >
            <div style={{
              fontFamily: mono, fontSize: "10px",
              letterSpacing: "0.08em",
              padding: "3px 8px",
              border: "1px solid rgba(255,255,255,0.2)",
              color: p.status === "done" ? "black" : p.status === "current" ? "white" : "rgba(255,255,255,0.35)",
              backgroundColor: p.status === "done" ? "white" : "transparent",
              flexShrink: 0,
            }}>
              {p.status === "done" ? "DONE" : p.status === "current" ? "NOW" : "NEXT"}
            </div>
            <div className="flex-1">
              <p style={{ fontFamily: mono, fontSize: "13px", color: "white", fontWeight: "bold", marginBottom: 2 }}>{p.label}</p>
              <p style={{ fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PDF Generation (unchanged) ─────────────────────────────────────────────

const generateAndDownloadPDF = async () => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  let y = 20;

  const addText = (text: string, fontSize: number = 10, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]) => {
    doc.setFontSize(fontSize); doc.setFont('helvetica', isBold ? 'bold' : 'normal'); doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line: string) => { if (y > 270) { doc.addPage(); y = 20; } doc.text(line, margin, y); y += fontSize * 0.5; }); y += 3;
  };
  const addSectionHeader = (text: string) => {
    if (y > 260) { doc.addPage(); y = 20; } doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0); doc.text(text, margin, y); y += 2;
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5); doc.line(margin, y, pageWidth - margin, y); y += 8;
  };
  const addBox = (text: string, bgGray: number = 250) => {
    if (y > 250) { doc.addPage(); y = 20; } const boxPadding = 5; const lines = doc.splitTextToSize(text, maxWidth - (boxPadding * 2)); const boxHeight = (lines.length * 5) + (boxPadding * 2);
    doc.setFillColor(bgGray, bgGray, bgGray); doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5); doc.rect(margin, y, maxWidth, boxHeight, 'FD');
    y += boxPadding + 4; doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0); lines.forEach((line: string) => { doc.text(line, margin + boxPadding, y); y += 5; }); y += boxPadding + 3;
  };

  // Title
  doc.setFillColor(0, 0, 0); doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.text('MSIS 549 Individual Project Proposal', margin, 18);
  doc.setFontSize(16); doc.text('ORCHID: AI-Powered Plant Care Agent', margin, 28);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text('via iMessage & WhatsApp', margin, 35); y = 50;

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
  addText('Global Houseplant Market:', 10, true);
  addText('• 2024 Market Size: $18.5B (US: $5.9B)', 9); addText('• 2028 Projection: $22.6B (US: $7.2B)', 9);
  addText('• CAGR 2024-2028: 5.2%', 9); addText('• 86M US households own plants', 9);
  y += 3;
  addText('User Demographics:', 10, true);
  addText('• 70% of millennials own houseplants', 9); addText('• 60% report plant care anxiety', 9);
  addText('• 57% of plant deaths: overwatering (solvable problem)', 9);
  y += 3;
  addText('Channel Advantage:', 10, true);
  addText('• WhatsApp: 3.14B monthly users, 98% open rate, 45-60% CTR', 9);
  addText('• iMessage: 1.2B users, 60% of US mobile messaging, 8.4B daily messages', 9);
  addText('• 90% of standalone apps abandoned within 30 days', 9);
  addText('• WhatsApp Business maintains 88%+ 30-day retention', 9);

  addSectionHeader('FIG 5.0 — TECHNOLOGY STACK');
  addText('AI Layer:', 10, true); addText('• Google Gemini 3 Flash (real-time) & Pro (complex reasoning)', 9);
  addText('• Perplexity Sonar (live web research)', 9); addText('• OpenRouter (API gateway)', 9); y += 2;
  addText('Backend:', 10, true); addText('• Supabase PostgreSQL', 9); addText('• Edge Functions', 9);
  addText('• Real-time subscriptions', 9); addText('• Row-level security', 9); y += 2;
  addText('Frontend:', 10, true); addText('• React + TypeScript', 9); addText('• Tailwind CSS', 9); addText('• Framer Motion', 9); y += 2;
  addText('Messaging:', 10, true); addText('• Twilio API: WhatsApp Business + SMS', 9);
  addText('• Multi-modal support', 9); addText('• Webhook architecture', 9);

  addSectionHeader('FIG 6.0 — IMPLEMENTATION ROADMAP');
  addText('Phase 1: Core AI Chat (4 weeks)', 10, true); addText('• Basic plant identification via Gemini 3 Vision', 9);
  addText('• Text-based Q&A with Perplexity integration', 9); addText('• Simple memory: Store basic plant profiles', 9); y += 2;
  addText('Phase 2: Memory & Personalization (3 weeks)', 10, true); addText('• Hierarchical memory system', 9);
  addText('• Context compression', 9); addText('• User preference learning', 9); y += 2;
  addText('Phase 3: Proactive Features (3 weeks)', 10, true); addText('• Scheduled reminders', 9);
  addText('• Seasonal care adjustments', 9); addText('• Predictive health monitoring', 9); y += 2;
  addText('Phase 4: Polish & Scale (2 weeks)', 10, true); addText('• Performance optimization', 9);
  addText('• Multi-language support', 9); addText('• User testing and iteration', 9);

  addSectionHeader('FIG 7.0 — COMPETITIVE POSITIONING');
  addText('Orchid occupies the ideal quadrant: Maximum accessibility (messaging platforms) + Maximum intelligence (Gemini 3 + memory).', 10);
  y += 3; addText('Competitors:', 10, true);
  addText('• Plant Apps (Planta, etc): High friction, moderate AI', 9);
  addText('• Websites: High friction, static guides with no personalization', 9);
  addText('• Basic Chatbots: Easy access but limited intelligence', 9);
  addText('• Google Search: Manual research required, no learning', 9);
  y += 3; addBox('Orchid Advantage: Only solution combining conversational memory, multi-modal AI, proactive intelligence, and zero-friction messaging interface.');

  addSectionHeader('FIG 8.0 — SUCCESS METRICS');
  addText('User Engagement:', 10, true); addText('• 80%+ 7-day retention', 9); addText('• 3+ interactions/week', 9); addText('• 60%+ users add 3+ plants in first month', 9); y += 2;
  addText('AI Performance:', 10, true); addText('• 95%+ identification accuracy', 9); addText('• <3s response time', 9); addText('• 85%+ satisfaction', 9); y += 2;
  addText('Social Impact:', 10, true); addText('• Reduce plant mortality 40%', 9); addText('• Improve confidence 60%', 9); addText('• Create educational content', 9);
  y += 3; addBox('This app is entirely free. No monetization. Mission: Democratize plant ownership.');

  addSectionHeader('FIG 9.0 — DEMO PLAN');
  addText('Fair Demonstration:', 10, true);
  addText('• Live plant identification demo', 9); addText('• Real-time Q&A showing memory persistence', 9);
  addText('• Health diagnosis of sample sick plant', 9); addText('• Proactive reminder scheduling', 9); y += 2;
  addText('Backup Plans:', 10, true);
  addText('• Pre-recorded video walkthrough', 9); addText('• Static slides', 9);
  addText('• Local demo mode (no internet)', 9); y += 5;

  doc.setFillColor(0, 0, 0); doc.rect(margin, y, maxWidth, 20, 'F');
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
  doc.text('I want everyone to share my obsession with plants.', margin + 5, y + 8);
  doc.text('Orchid makes that possible.', margin + 5, y + 15); y += 25;
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
  doc.text('Contact: masudl@uw.edu  |  Website: orchid.masudlewis.com', margin, y);
  doc.save('MSIS549_Proposal_MasudLewis_Orchid.pdf');
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PROPOSAL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function OrchidProposal() {
  const location = useLocation();
  // 'default' key means direct URL entry (fresh app load); any other key = in-app navigation
  const fromApp = location.key !== 'default';
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentSection, setCurrentSection] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalSections = 12;

  // Hero decrypt state — skip animation when navigating from within the app
  const [heroReady, setHeroReady] = useState(fromApp);
  useEffect(() => {
    if (!fromApp) setTimeout(() => setHeroReady(true), 300);
  }, [fromApp]);
  const heroTitle = useDecryptText("ORCHID", heroReady, 2, fromApp);
  const heroSub = useDecryptText("Intelligent Botany", heroReady, 1.2, fromApp);

  // Scroll tracking
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const progress = scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0;
      setScrollProgress(Math.min(progress, 1));
      const section = Math.floor(progress * totalSections) + 1;
      setCurrentSection(Math.min(section, totalSections));
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Section visibility hooks
  const elevator = useInView(0.2);
  const problem = useInView(0.15);
  const aiTech = useInView(0.15);
  const aiVision = useInView(0.15);
  const memory = useInView(0.2);
  const users = useInView(0.15);
  const market = useInView(0.1);
  const marketDeaths = useInView(0.15);
  const marketEngagement = useInView(0.15);
  const marketRetention = useInView(0.15);
  const marketAdoption = useInView(0.15);
  const implementation = useInView(0.15);
  const demo = useInView(0.15);
  const success = useInView(0.15);
  const conclusion = useInView(0.2);

  // Animated counters
  const accuracy = useCountUp(98, aiVision.visible, 1200);
  const responseTime = useCountUp(2, aiVision.visible, 800, 0);
  const speciesDb = useCountUp(5000, aiVision.visible, 1500);
  const retention7 = useCountUp(7, marketRetention.visible, 2000);
  const retention88 = useCountUp(88, marketRetention.visible, 2000);
  const marketSize = useCountUp(18.5, market.visible, 1500, 1);
  const cagr = useCountUp(5.2, market.visible, 1200, 1);
  const households = useCountUp(86, market.visible, 1200);

  return (
    <div className="fixed inset-0 bg-black">
      <GrainOverlay />

      {/* Back button */}
      <BackButton />

      {/* Scroll progress bar — matches start-page top bar */}
      <div className="fixed top-0 left-0 h-2 bg-white z-40 transition-all duration-150"
        style={{ width: `${scrollProgress * 100}%` }} />

      {/* Section counter */}
      <div className="fixed bottom-8 right-8 z-40" style={{
        fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em",
      }}>
        {String(currentSection).padStart(2, '0')} / {totalSections}
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="size-full overflow-y-auto" style={{
        scrollSnapType: "y mandatory", scrollBehavior: "smooth", scrollbarWidth: "none",
      }}>

        {/* ─── 1. Hero ─── */}
        <section className="min-h-screen w-full flex items-center justify-center px-8 md:px-16 relative" style={{ scrollSnapAlign: "start" }}>
          <div style={{ maxWidth: 880, width: "100%" }}>
            {/* Course label */}
            <div style={{
              ...revealStyle(heroReady, 0),
              fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.35)",
              letterSpacing: "0.12em", marginBottom: 32,
            }}>
              MSIS 549 / INDIVIDUAL PROJECT PROPOSAL
            </div>

            {/* Title */}
            <h1 style={{
              fontFamily: pressStart, fontSize: "clamp(40px, 8vw, 72px)",
              color: "white", lineHeight: 1.1, marginBottom: 16,
            }}>
              {heroTitle}
            </h1>

            {/* Subtitle */}
            <p style={{
              fontFamily: mono, fontSize: "18px", color: "rgba(255,255,255,0.6)",
              lineHeight: 1.5, marginBottom: 8, letterSpacing: "0.02em",
              ...revealStyle(heroReady, 800),
            }}>
              {heroSub}
            </p>

            {/* Tagline */}
            <p style={{
              fontFamily: mono, fontSize: "14px", color: "rgba(255,255,255,0.35)",
              marginBottom: 40, letterSpacing: "0.02em",
              ...revealStyle(heroReady, 1200),
            }}>
              AI-Powered Plant Care Agent via iMessage & WhatsApp
            </p>

            {/* Buttons */}
            <div className="flex gap-4" style={revealStyle(heroReady, 1600)}>
              <button
                onClick={generateAndDownloadPDF}
                className="flex items-center gap-2 transition-colors duration-200 hover:bg-white hover:text-black cursor-pointer"
                style={{
                  fontFamily: mono, fontSize: "12px", color: "white",
                  letterSpacing: "0.06em", padding: "12px 20px",
                  border: "1px solid rgba(255,255,255,0.3)", background: "transparent",
                }}
              >
                <Download className="w-4 h-4" /> DOWNLOAD PROPOSAL
              </button>
              <button
                onClick={() => window.location.href = '/demo'}
                className="flex items-center gap-2 transition-colors duration-200 hover:bg-white hover:text-black cursor-pointer"
                style={{
                  fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.6)",
                  letterSpacing: "0.06em", padding: "12px 20px",
                  border: "1px solid rgba(255,255,255,0.12)", background: "transparent",
                }}
              >
                <Play className="w-4 h-4" /> TRY LIVE DEMO
              </button>
            </div>

            {/* Pixel orchid — tap to start / QR morph */}
            <div style={{ marginTop: 48, ...revealStyle(heroReady, 2000) }}>
              <QROrchid visible={heroReady} />
            </div>
          </div>
        </section>

        {/* ─── 2. Elevator Pitch ─── */}
        <section ref={elevator.ref as React.RefObject<HTMLElement>} className="min-h-screen w-full flex items-center justify-center px-8 md:px-16 relative" style={{ scrollSnapAlign: "start" }}>
          <FigureAnnotation label="FIG 0.1 — ELEVATOR PITCH" visible={elevator.visible} />
          <div style={{ maxWidth: 880, width: "100%" }}>
            <h2 style={{ ...revealStyle(elevator.visible, 200), fontFamily: pressStart, fontSize: "clamp(20px, 4vw, 32px)", color: "white", lineHeight: 1.4, marginBottom: 32 }}>
              {useDecryptText("The Problem We Solve", elevator.visible)}
            </h2>

            <div style={{ ...revealStyle(elevator.visible, 400) }}>
              <p style={{ fontFamily: mono, fontSize: "15px", color: "rgba(255,255,255,0.7)", lineHeight: 1.8, marginBottom: 28 }}>
                A lot of plant enthusiasts and beginners struggle with the <em>daily anxiety of plant care</em>—not knowing when to water, how to diagnose problems, or whether their plants are thriving—which costs them money on dead plants, missed opportunities for growth, and the heartbreak of failure.
              </p>
              <p style={{ fontFamily: mono, fontSize: "15px", color: "rgba(255,255,255,0.7)", lineHeight: 1.8, marginBottom: 28 }}>
                So I built <strong style={{ color: "white" }}>Orchid</strong>, an AI-powered plant care agent that helps them confidently care for their plants by proactively managing their collection, diagnosing issues in real-time, and learning their unique habits and environment.
              </p>
              <p style={{ fontFamily: mono, fontSize: "15px", color: "rgba(255,255,255,0.7)", lineHeight: 1.8 }}>
                Unlike Planta and other plant care apps, Orchid runs through <em>WhatsApp and iMessage</em>, eliminating "yet another app," and uses conversational AI with hierarchical memory to understand that no two plants—or plant parents—are the same.
              </p>
            </div>
          </div>
        </section>

        {/* ─── 3. Problem Statement ─── */}
        <section ref={problem.ref as React.RefObject<HTMLElement>} className="min-h-screen w-full flex items-center justify-center px-8 md:px-16 relative" style={{ scrollSnapAlign: "start" }}>
          <FigureAnnotation label="FIG 1.0 — PROBLEM STATEMENT" visible={problem.visible} />
          <div style={{ maxWidth: 880, width: "100%" }}>
            <h2 style={{ ...revealStyle(problem.visible, 200), fontFamily: pressStart, fontSize: "clamp(20px, 4vw, 32px)", color: "white", lineHeight: 1.4, marginBottom: 24 }}>
              {useDecryptText("Why This Matters", problem.visible)}
            </h2>

            <p style={{ ...revealStyle(problem.visible, 400), fontFamily: mono, fontSize: "14px", color: "rgba(255,255,255,0.55)", lineHeight: 1.8, marginBottom: 32, maxWidth: 640 }}>
              I am obsessed with plants. Collecting them, growing them, taking care of them when they're unwell, and seeing my friends' glee when they observe my collection. At the same time, the unknown of caring for plants creates daily stress. My friends feel the same way. "I've killed x plant y times" is a common line. That conviction that they're unable to maintain plants, driven by the cost of not knowing how and when to care for them, creates a barrier to entry.
            </p>

            {/* DecayMatrix hidden — keep component for potential reuse */}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3" style={{ maxWidth: 800 }}>
              {([
                { title: 'Information Overload', theme: 'overload' as const, desc: "Generic care guides don't account for individual environments, watering habits, or the specific needs of each plant" },
                { title: 'Reactive Care', theme: 'reactive' as const, desc: 'Users only seek help when problems arise, rather than receiving proactive guidance' },
                { title: 'App Fatigue', theme: 'fatigue' as const, desc: 'Existing solutions require downloading yet another standalone app, creating friction' },
                { title: 'Lack of Personalization', theme: 'personal' as const, desc: "Current tools don't learn from user behavior or remember plant-specific history" },
              ]).map((issue, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center text-center transition-all duration-300 hover:border-white/25"
                  style={{
                    ...revealStyle(problem.visible, 600 + i * 150),
                    border: "1px solid rgba(255,255,255,0.08)",
                    padding: "24px 16px",
                  }}
                >
                  <div style={{ marginBottom: 16 }}>
                    <ProblemGlyph theme={issue.theme} visible={problem.visible} />
                  </div>
                  <h3 style={{ fontFamily: mono, fontSize: "11px", color: "white", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10, fontWeight: "bold", lineHeight: 1.4 }}>
                    {issue.title}
                  </h3>
                  <p style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                    {issue.desc}
                  </p>
                </div>
              ))}
            </div>

            <p style={{ ...revealStyle(problem.visible, 1200), fontFamily: mono, fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.8, marginTop: 32 }}>
              This matters because plants improve mental health, air quality, and living spaces. The barrier to plant ownership shouldn't be information access—it should be joy and connection.
            </p>
          </div>
        </section>

        {/* ─── 4. AI Technologies ─── */}
        <section ref={aiTech.ref as React.RefObject<HTMLElement>} className="min-h-screen w-full flex items-center justify-center px-8 md:px-16 relative" style={{ scrollSnapAlign: "start" }}>
          <FigureAnnotation label="FIG 2.0 — TECHNICAL APPROACH" visible={aiTech.visible} />
          <div style={{ maxWidth: 880, width: "100%" }}>
            <h2 style={{ ...revealStyle(aiTech.visible, 200), fontFamily: pressStart, fontSize: "clamp(18px, 3.5vw, 28px)", color: "white", lineHeight: 1.4, marginBottom: 32 }}>
              {useDecryptText("How AI Addresses This", aiTech.visible)}
            </h2>

            {/* Bento grid — mixed sizes */}
            <div
              className="grid grid-cols-1 md:grid-cols-4 gap-3"
              style={{
                gridTemplateColumns: undefined,
                gridTemplateRows: 'auto auto',
                ...revealStyle(aiTech.visible, 350),
              }}
            >
              {/* Cell 1 — Multi-Modal AI (wide, spans 2 cols) */}
              <div
                className="col-span-1 md:col-span-2 transition-all duration-300 hover:border-white/20"
                style={{
                  ...revealStyle(aiTech.visible, 400),
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "28px 24px",
                  display: "flex",
                  gap: 24,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <TechGlyph theme="eye" visible={aiTech.visible} />
                </div>
                <div>
                  <h3 style={{ fontFamily: mono, fontSize: "12px", color: "white", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: "bold", marginBottom: 10 }}>
                    Multi-Modal AI
                  </h3>
                  <p style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 8 }}>
                    Gemini 3 &amp; Perplexity Sonar process photos, text, and voice. 98%+ species identification accuracy. Real-time health diagnosis from a single image sent via iMessage or WhatsApp.
                  </p>
                  <span style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>FIG 2.1 · FIG 2.2</span>
                </div>
              </div>

              {/* Cell 2 — Conversational Interface (spans 2 cols) */}
              <div
                className="col-span-1 md:col-span-2 transition-all duration-300 hover:border-white/20"
                style={{
                  ...revealStyle(aiTech.visible, 550),
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "28px 24px",
                  display: "flex",
                  gap: 24,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <TechGlyph theme="chat" visible={aiTech.visible} />
                </div>
                <div>
                  <h3 style={{ fontFamily: mono, fontSize: "12px", color: "white", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: "bold", marginBottom: 10 }}>
                    Conversational Interface
                  </h3>
                  <p style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 8 }}>
                    No app to download, no learning curve. Natural language via iMessage &amp; WhatsApp. Send a photo, ask a question, get expert advice. Supports text, images, voice, and video.
                  </p>
                  <span style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>FIG 2.6 · FIG 2.7</span>
                </div>
              </div>

              {/* Cell 3 — Hierarchical Memory (tall, spans 2 rows on left) */}
              <div
                className="col-span-1 md:col-span-2 row-span-1 transition-all duration-300 hover:border-white/20"
                style={{
                  ...revealStyle(aiTech.visible, 700),
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "28px 24px",
                  display: "flex",
                  gap: 24,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <TechGlyph theme="brain" visible={aiTech.visible} />
                </div>
                <div>
                  <h3 style={{ fontFamily: mono, fontSize: "12px", color: "white", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: "bold", marginBottom: 10 }}>
                    Hierarchical Memory
                  </h3>
                  <p style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 8 }}>
                    Every conversation compresses into persistent context. Learns your habits, environment, light conditions, and pet safety concerns. Advice evolves with each interaction — no two users are treated the same.
                  </p>
                  <span style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>FIG 2.3</span>
                </div>
              </div>

              {/* Cell 4 — Proactive Intelligence */}
              <div
                className="col-span-1 md:col-span-2 row-span-1 transition-all duration-300 hover:border-white/20"
                style={{
                  ...revealStyle(aiTech.visible, 850),
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "28px 24px",
                  display: "flex",
                  gap: 24,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <TechGlyph theme="bell" visible={aiTech.visible} />
                </div>
                <div>
                  <h3 style={{ fontFamily: mono, fontSize: "12px", color: "white", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: "bold", marginBottom: 10 }}>
                    Proactive Intelligence
                  </h3>
                  <p style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 8 }}>
                    Frost warnings, seasonal tips, fertilization reminders — before you even think to ask. Weather-aware notifications with granular permission controls prevent problems before they start.
                  </p>
                  <span style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>FIG 2.4 · FIG 2.5</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 5. AI Visual Identification ─── */}
        <section ref={aiVision.ref as React.RefObject<HTMLElement>} className="min-h-screen w-full flex items-center justify-center px-8 md:px-16 relative" style={{ scrollSnapAlign: "start" }}>
          <FigureAnnotation label="FIG 2.1 — AI VISUAL IDENTIFICATION" visible={aiVision.visible} />
          <div style={{ maxWidth: 880, width: "100%" }}>
            <h2 style={{ ...revealStyle(aiVision.visible, 200), fontFamily: pressStart, fontSize: "clamp(20px, 4vw, 32px)", color: "white", lineHeight: 1.4, marginBottom: 12 }}>
              {useDecryptText("See It. Know It.", aiVision.visible)}
            </h2>
            <p style={{ ...revealStyle(aiVision.visible, 400), fontFamily: mono, fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 40, maxWidth: 500 }}>
              Multi-modal AI processes plant images in real-time, identifying species, health issues, and care requirements.
            </p>

            <div className="grid md:grid-cols-3 gap-4" style={revealStyle(aiVision.visible, 600)}>
              <PlantVision plantName="Chinese Money Plant" scientificName="Pilea peperomioides" folder="Chinese_Money_Plant_2" imgName="Chinese_Money_Plant" confidence="99.1%" traits="Low light · Pet safe" delay={0} />
              <PlantVision plantName="Cattleya Orchid" scientificName="Cattleya labiata" folder="cattleya_orchid_on_cork_bark" imgName="cattleya_orchid_on_cork_bark" confidence="98.4%" traits="Bright light · Epiphyte" delay={0.1} />
              <PlantVision plantName="Peace Lily" scientificName="Spathiphyllum wallisii" folder="Peace_Lily_2" imgName="Peace_Lily" confidence="97.8%" traits="Low light · Air purifying" delay={0.2} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-8" style={{ ...revealStyle(aiVision.visible, 1000), border: "1px solid rgba(255,255,255,0.1)", padding: "16px md:24px" }}>
              <div className="text-center">
                <p style={{ fontFamily: mono, fontSize: "28px", color: "white", fontWeight: "bold" }}>{accuracy}%+</p>
                <p style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em", marginTop: 4 }}>ACCURACY</p>
              </div>
              <div className="text-center">
                <p style={{ fontFamily: mono, fontSize: "28px", color: "white", fontWeight: "bold" }}>&lt;{responseTime}s</p>
                <p style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em", marginTop: 4 }}>RESPONSE TIME</p>
              </div>
              <div className="text-center">
                <p style={{ fontFamily: mono, fontSize: "28px", color: "white", fontWeight: "bold" }}>{speciesDb.toLocaleString()}+</p>
                <p style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em", marginTop: 4 }}>SPECIES</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 6. Memory Network ─── */}
        <section ref={memory.ref as React.RefObject<HTMLElement>} className="min-h-screen w-full flex items-center justify-center px-8 md:px-16 relative" style={{ scrollSnapAlign: "start" }}>
          <FigureAnnotation label="FIG 2.5 — MEMORY NETWORK" visible={memory.visible} />
          <div style={{ maxWidth: 880, width: "100%" }}>
            <h2 style={{ ...revealStyle(memory.visible, 200), fontFamily: pressStart, fontSize: "clamp(20px, 4vw, 36px)", color: "white", lineHeight: 1.3, marginBottom: 24 }}>
              {useDecryptText("Memory That Learns", memory.visible)}
            </h2>
            <p style={{ ...revealStyle(memory.visible, 400), fontFamily: mono, fontSize: "14px", color: "rgba(255,255,255,0.5)", maxWidth: 600, lineHeight: 1.6, marginBottom: 40 }}>
              The more you chat, the smarter Orchid gets. Every conversation builds a richer understanding of you and your plants.
            </p>
            <div className="w-full relative" style={{ ...revealStyle(memory.visible, 600), height: 500, marginTop: -20 }}>
              <div className="w-full h-full relative">
                <MemoryOrb />
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none" />
              </div>
            </div>
          </div>
        </section>

        {/* ─── 7. Target Users ─── */}
        <section ref={users.ref as React.RefObject<HTMLElement>} className="min-h-screen w-full flex items-center justify-center px-8 md:px-16 relative" style={{ scrollSnapAlign: "start" }}>
          <FigureAnnotation label="FIG 3.0 — USER DEMOGRAPHICS" visible={users.visible} />
          <div style={{ maxWidth: 880, width: "100%" }}>
            <h2 style={{ ...revealStyle(users.visible, 200), fontFamily: pressStart, fontSize: "clamp(20px, 4vw, 32px)", color: "white", lineHeight: 1.4, marginBottom: 32 }}>
              {useDecryptText("Target Users", users.visible)}
            </h2>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                { tier: 'PRIMARY', desc: 'Plant beginners who want plants but fear killing them', level: 0 as const },
                { tier: 'SECONDARY', desc: 'Intermediate enthusiasts managing multiple plants who want optimization', level: 1 as const },
                { tier: 'TERTIARY', desc: 'Plant collectors seeking rare species identification and advanced diagnostics', level: 2 as const },
              ].map((user, i) => (
                <div
                  key={i}
                  className="p-5 transition-all duration-300 hover:border-white/25"
                  style={{
                    ...revealStyle(users.visible, 400 + i * 200),
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <p style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em" }}>{user.tier}</p>
                    <ComplexityGlyph level={user.level} />
                  </div>
                  <p style={{ fontFamily: mono, fontSize: "13px", color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>{user.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 8. Market Validation (tall scrolling section) ─── */}
        <section ref={market.ref as React.RefObject<HTMLElement>} className="w-full py-32 px-8 md:px-16 relative" style={{ scrollSnapAlign: "start" }}>
          <FigureAnnotation label="FIG 4.0 — MARKET VALIDATION" visible={market.visible} />

          <div style={{ maxWidth: 880, width: "100%", margin: "0 auto" }}>
            <h2 style={{ ...revealStyle(market.visible, 200), fontFamily: pressStart, fontSize: "clamp(20px, 4vw, 32px)", color: "white", lineHeight: 1.4, marginBottom: 12 }}>
              {useDecryptText("The $20B Opportunity", market.visible)}
            </h2>
            <p style={{ ...revealStyle(market.visible, 400), fontFamily: mono, fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 48, maxWidth: 600 }}>
              Comprehensive market analysis validates Orchid's positioning at the intersection of a massive, growing market and systematic product failure.
            </p>

            {/* Market Growth Chart */}
            <div style={{ ...revealStyle(market.visible, 600), border: "1px solid rgba(255,255,255,0.1)", padding: 32, marginBottom: 48 }}>
              <h3 style={{ fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" }}>
                GLOBAL HOUSEPLANT MARKET GROWTH
              </h3>
              <p style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: 24 }}>
                Robust expansion at 4.5-5.5% CAGR, driven by wellness trends and urbanization
              </p>
              <PixelColumnChart visible={market.visible} />

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4 mt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
                <div>
                  <p style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", marginBottom: 4 }}>2024 MARKET SIZE</p>
                  <p style={{ fontFamily: mono, fontSize: "24px", color: "white", fontWeight: "bold" }}>${marketSize}B</p>
                </div>
                <div>
                  <p style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", marginBottom: 4 }}>CAGR 2024-2028</p>
                  <p style={{ fontFamily: mono, fontSize: "24px", color: "white", fontWeight: "bold" }}>{cagr}%</p>
                </div>
                <div>
                  <p style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", marginBottom: 4 }}>US HOUSEHOLDS</p>
                  <p style={{ fontFamily: mono, fontSize: "24px", color: "white", fontWeight: "bold" }}>{households}M</p>
                </div>
              </div>
            </div>

            {/* Plant Death Causes — Waffle Grid */}
            <div ref={marketDeaths.ref as React.RefObject<HTMLDivElement>} style={{ ...revealStyle(marketDeaths.visible, 200), border: "1px solid rgba(255,255,255,0.1)", padding: 32, marginBottom: 48 }}>
              <h3 style={{ fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" }}>
                WHY PLANTS DIE
              </h3>
              <p style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: 24 }}>
                57% of plant deaths are from overwatering — a solvable problem
              </p>
              <WaffleGrid visible={marketDeaths.visible} />

              {/* Mortality crisis */}
              <div style={{ marginTop: 32, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
                <TerminalLines
                  visible={marketDeaths.visible}
                  lines={[
                    "35% of houseplants die at home",
                    '67% of millennials call themselves "plant murderers"',
                    "48% worry about keeping plants alive",
                    "avg: 7 plants killed per millennial",
                  ]}
                />
              </div>
            </div>

            {/* App Engagement Comparison */}
            <div ref={marketEngagement.ref as React.RefObject<HTMLDivElement>} style={{ ...revealStyle(marketEngagement.visible, 200), marginBottom: 48 }}>
              <h3 style={{ fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" }}>
                APP ENGAGEMENT: STANDALONE VS. MESSAGING
              </h3>
              <p style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: 24 }}>
                Messaging platforms dramatically outperform standalone apps across all metrics
              </p>
              <EngagementComparison visible={marketEngagement.visible} />
            </div>

            {/* Retention — The Cliff vs Plateau */}
            <div ref={marketRetention.ref as React.RefObject<HTMLDivElement>} style={{ ...revealStyle(marketRetention.visible, 200), border: "1px solid rgba(255,255,255,0.1)", padding: 32, marginBottom: 48 }}>
              <h3 style={{ fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", marginBottom: 32, textTransform: "uppercase" }}>
                30-DAY RETENTION: THE CLIFF VS THE PLATEAU
              </h3>

              <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 mb-12">
                <div className="text-center">
                  <p style={{ fontFamily: pressStart, fontSize: "clamp(48px, 10vw, 100px)", color: "rgba(255,255,255,0.12)", lineHeight: 1 }}>
                    {retention7}%
                  </p>
                  <p style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em", marginTop: 8 }}>
                    STANDALONE APPS
                  </p>
                </div>
                <div className="text-center">
                  <p style={{ fontFamily: pressStart, fontSize: "clamp(48px, 10vw, 100px)", color: "white", lineHeight: 1 }}>
                    {retention88}%
                  </p>
                  <p style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em", marginTop: 8 }}>
                    WHATSAPP BUSINESS
                  </p>
                </div>
              </div>

              {/* Timeline */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { day: "DAY 1", apps: "100%", msg: "100%" },
                  { day: "DAY 3", apps: "23%", msg: "95%" },
                  { day: "DAY 7", apps: "15%", msg: "92%" },
                  { day: "DAY 30", apps: "7%", msg: "88%" },
                ].map((col, i) => (
                  <div key={col.day} style={{ ...revealStyle(marketRetention.visible, 400 + i * 200), textAlign: "center" }}>
                    <p style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", marginBottom: 8 }}>{col.day}</p>
                    <p style={{ fontFamily: mono, fontSize: "13px", color: "rgba(255,255,255,0.25)", marginBottom: 4 }}>{col.apps}</p>
                    <p style={{ fontFamily: mono, fontSize: "13px", color: "white", fontWeight: "bold" }}>{col.msg}</p>
                  </div>
                ))}
              </div>

              {/* Channel metrics */}
              <div className="grid grid-cols-2 gap-6 mt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
                <div>
                  <p style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", marginBottom: 8 }}>WHATSAPP</p>
                  <p style={{ fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.6)" }}><strong style={{ color: "white" }}>3.14B</strong> monthly active users</p>
                  <p style={{ fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.6)" }}><strong style={{ color: "white" }}>98%</strong> message open rate</p>
                  <p style={{ fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.6)" }}><strong style={{ color: "white" }}>45-60%</strong> click-through rate</p>
                </div>
                <div>
                  <p style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", marginBottom: 8 }}>IMESSAGE</p>
                  <p style={{ fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.6)" }}><strong style={{ color: "white" }}>1.2B</strong> active users</p>
                  <p style={{ fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.6)" }}><strong style={{ color: "white" }}>60%</strong> of US mobile messaging</p>
                  <p style={{ fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.6)" }}><strong style={{ color: "white" }}>8.4B</strong> daily messages</p>
                </div>
              </div>
            </div>

            {/* AI Adoption */}
            <div ref={marketAdoption.ref as React.RefObject<HTMLDivElement>} style={{ ...revealStyle(marketAdoption.visible, 200), border: "1px solid rgba(255,255,255,0.1)", padding: 32 }}>
              <h3 style={{ fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" }}>
                AI ADOPTION BY GENERATION
              </h3>
              <p style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: 24 }}>
                70%+ of Gen Z and 62% of Millennials have adopted AI — the barrier has fallen
              </p>
              <AdoptionBars visible={marketAdoption.visible} />

              <div className="grid grid-cols-2 gap-6 mt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
                <div>
                  <p style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", marginBottom: 4 }}>CONVERSATIONAL AI MARKET</p>
                  <p style={{ fontFamily: mono, fontSize: "24px", color: "white", fontWeight: "bold" }}>$16B</p>
                  <p style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>Growing 20-29% annually</p>
                </div>
                <div>
                  <p style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", marginBottom: 4 }}>AI ADOPTION RATE</p>
                  <p style={{ fontFamily: mono, fontSize: "24px", color: "white", fontWeight: "bold" }}>66%</p>
                  <p style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>Of millennials use AI regularly</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 9. Implementation Plan ─── */}
        <section ref={implementation.ref as React.RefObject<HTMLElement>} className="min-h-screen w-full flex items-center justify-center px-8 md:px-16 relative" style={{ scrollSnapAlign: "start" }}>
          <FigureAnnotation label="FIG 5.0 — IMPLEMENTATION" visible={implementation.visible} />
          <div style={{ maxWidth: 880, width: "100%" }}>
            <h2 style={{ ...revealStyle(implementation.visible, 200), fontFamily: pressStart, fontSize: "clamp(18px, 3.5vw, 28px)", color: "white", lineHeight: 1.4, marginBottom: 32 }}>
              {useDecryptText("Technical Architecture", implementation.visible)}
            </h2>

            {/* Bento grid */}
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: 'repeat(4, 1fr)',
                gridTemplateRows: 'auto auto auto',
                ...revealStyle(implementation.visible, 350),
              }}
            >
              {/* Cell 1 — Primary Interface (spans 2 cols) */}
              <div
                className="col-span-2 transition-all duration-300 hover:border-white/20"
                style={{
                  ...revealStyle(implementation.visible, 400),
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "28px 24px",
                  display: "flex",
                  gap: 24,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <ArchGlyph theme="messaging" visible={implementation.visible} />
                </div>
                <div>
                  <h3 style={{ fontFamily: mono, fontSize: "12px", color: "white", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: "bold", marginBottom: 10 }}>
                    Primary Interface
                  </h3>
                  <p style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 8 }}>
                    Conversational AI via Telegram. Natural language understanding with multi-modal input: photos, video, and voice. Real-time diagnosis and proactive notifications.
                  </p>
                </div>
              </div>

              {/* Cell 2 — Secondary Interface (spans 2 cols) */}
              <div
                className="col-span-2 transition-all duration-300 hover:border-white/20"
                style={{
                  ...revealStyle(implementation.visible, 550),
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "28px 24px",
                  display: "flex",
                  gap: 24,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <ArchGlyph theme="dashboard" visible={implementation.visible} />
                </div>
                <div>
                  <h3 style={{ fontFamily: mono, fontSize: "12px", color: "white", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: "bold", marginBottom: 10 }}>
                    Web Dashboard
                  </h3>
                  <p style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.45)", lineHeight: 1.7, marginBottom: 8 }}>
                    React web dashboard for advanced management. Plant collection overview, activity logs &amp; analytics, agent settings &amp; permissions, and memory visualization.
                  </p>
                </div>
              </div>

              {/* Cell 3 — Technology Stack (spans 2 cols) */}
              <div
                className="col-span-2 transition-all duration-300 hover:border-white/20"
                style={{
                  ...revealStyle(implementation.visible, 700),
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "28px 24px",
                  display: "flex",
                  gap: 24,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <ArchGlyph theme="stack" visible={implementation.visible} />
                </div>
                <div>
                  <h3 style={{ fontFamily: mono, fontSize: "12px", color: "white", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: "bold", marginBottom: 10 }}>
                    Technology Stack
                  </h3>
                  <div className="grid grid-cols-3 gap-4" style={{ marginTop: 4 }}>
                    {[
                      { cat: 'AI', items: ['Gemini 3 Flash & Pro', 'Perplexity Sonar', 'OpenRouter Gateway'] },
                      { cat: 'BACKEND', items: ['Supabase PostgreSQL', 'Edge Functions', 'Auth & Storage'] },
                      { cat: 'FRONTEND', items: ['React + TypeScript', 'Tailwind CSS', 'Framer Motion'] },
                    ].map((stack, i) => (
                      <div key={i}>
                        <p style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em", marginBottom: 6 }}>{stack.cat}</p>
                        {stack.items.map((item, j) => (
                          <p key={j} style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.5)", marginBottom: 3, lineHeight: 1.5 }}>{item}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cell 4 — Development Progress (spans 2 cols) */}
              <div
                className="col-span-2 transition-all duration-300 hover:border-white/20"
                style={{
                  ...revealStyle(implementation.visible, 850),
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "28px 24px",
                  display: "flex",
                  gap: 24,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flexShrink: 0 }}>
                  <ArchGlyph theme="launch" visible={implementation.visible} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontFamily: mono, fontSize: "12px", color: "white", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: "bold", marginBottom: 10 }}>
                    All Phases Complete
                  </h3>
                  <div className="flex flex-col gap-2">
                    {[
                      'Core agent: identification, diagnosis, memory',
                      'Web dashboard: onboarding, collection, settings',
                      'Proactive messaging: seasonal tips, health checks',
                      'Visual guides, shopping, demo polish',
                    ].map((phase, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.25)" }}>✓</span>
                        <p style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{phase}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 10. Fair Demonstration ─── */}
        <section ref={demo.ref as React.RefObject<HTMLElement>} className="min-h-screen w-full flex items-center justify-center px-8 md:px-16 relative" style={{ scrollSnapAlign: "start" }}>
          <FigureAnnotation label="FIG 6.0 — FAIR DEMONSTRATION" visible={demo.visible} />
          <div style={{ maxWidth: 880, width: "100%" }}>
            <h2 style={{ ...revealStyle(demo.visible, 200), fontFamily: pressStart, fontSize: "clamp(18px, 3.5vw, 28px)", color: "white", lineHeight: 1.4, marginBottom: 32 }}>
              {useDecryptText("GenAI Fair Demo", demo.visible)}
            </h2>

            <div style={{ ...revealStyle(demo.visible, 400), border: "1px solid rgba(255,255,255,0.12)", padding: 24, marginBottom: 24 }}>
              <h3 style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8, marginBottom: 16, fontWeight: "bold" }}>
                DEMO SETUP (3-5 MINUTES PER VISITOR)
              </h3>

              {[
                { label: 'HOOK (30s)', desc: 'Show sick plant photo → send to Orchid via WhatsApp → instant diagnosis appears on phone. "This is Orchid. It\'s your personal plant care expert that lives in your messages."' },
                { label: 'FEATURE SHOWCASE (2min)', desc: 'Identification from photos, Memory Orb visualization, personalized advice based on history, proactive notification examples' },
                { label: 'PHYSICAL PROPS', desc: 'Printed botanical illustrations, small potted plant, "Before/After" photos of plant recovery, QR code for demo WhatsApp number' },
              ].map((item, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <p style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", marginBottom: 4 }}>{item.label}</p>
                  <p style={{ fontFamily: mono, fontSize: "13px", color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                { title: 'KEY STRENGTHS', items: ['No app download required', 'Hierarchical memory system', 'Real-world impact on plant survival', 'Serverless scalability'] },
                { title: 'BACKUP PLAN', items: ['Pre-recorded video walkthrough (2 min)', 'Screenshot deck of key interactions', 'Offline web dashboard with sample data', 'Printed conversation examples'] },
              ].map((card, i) => (
                <div key={i} style={{ ...revealStyle(demo.visible, 600 + i * 200), border: "1px solid rgba(255,255,255,0.15)", padding: 20 }}>
                  <h3 style={{ fontFamily: mono, fontSize: "11px", color: "white", letterSpacing: "0.08em", marginBottom: 12, fontWeight: "bold", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8 }}>
                    {card.title}
                  </h3>
                  {card.items.map((item, j) => (
                    <div key={j} className="flex items-start gap-2 mb-2">
                      <div style={{ width: 3, height: 3, backgroundColor: "rgba(255,255,255,0.3)", marginTop: 6, flexShrink: 0 }} />
                      <p style={{ fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.55)" }}>{item}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 11. Success Metrics / Competitive Positioning ─── */}
        <section ref={success.ref as React.RefObject<HTMLElement>} className="min-h-screen w-full flex items-center justify-center px-8 md:px-16 relative" style={{ scrollSnapAlign: "start" }}>
          <FigureAnnotation label="FIG 7.0 — SUCCESS MATRIX" visible={success.visible} />
          <div style={{ maxWidth: 880, width: "100%" }}>
            <h2 style={{ ...revealStyle(success.visible, 200), fontFamily: pressStart, fontSize: "clamp(18px, 3.5vw, 28px)", color: "white", lineHeight: 1.4, marginBottom: 12 }}>
              {useDecryptText("Why Orchid Will Succeed", success.visible)}
            </h2>
            <p style={{ ...revealStyle(success.visible, 400), fontFamily: mono, fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 40, maxWidth: 600 }}>
              Orchid occupies the only position that matters: maximum accessibility combined with maximum intelligence.
            </p>

            {/* Competitive Quadrant */}
            <div style={{ ...revealStyle(success.visible, 600), border: "1px solid rgba(255,255,255,0.1)", padding: 24, marginBottom: 32 }}>
              <CompetitiveQuadrant visible={success.visible} />
            </div>

            {/* Legend */}
            <div className="grid md:grid-cols-3 gap-6" style={revealStyle(success.visible, 1200)}>
              {[
                { title: 'MARKET OPPORTUNITY', items: ['$20B+ global market', '70% millennials own plants', '60% report anxiety'] },
                { title: 'TECHNICAL EDGE', items: ['Conversational memory', 'Multi-modal AI (Gemini 3)', 'Proactive intelligence'] },
                { title: 'SOCIAL IMPACT', items: ['Reduces plant waste', 'Mental health benefits', 'Free for everyone'] },
              ].map((col, i) => (
                <div key={i}>
                  <p style={{ fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", marginBottom: 8 }}>{col.title}</p>
                  {col.items.map((item, j) => (
                    <p key={j} style={{ fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>{item}</p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 12. Conclusion ─── */}
        <section ref={conclusion.ref as React.RefObject<HTMLElement>} className="min-h-screen w-full flex items-center justify-center px-8 md:px-16 relative" style={{ scrollSnapAlign: "start" }}>
          <div style={{ maxWidth: 880, width: "100%" }}>
            <h2 style={{ ...revealStyle(conclusion.visible, 200), fontFamily: pressStart, fontSize: "clamp(16px, 3vw, 24px)", color: "white", lineHeight: 1.5, marginBottom: 16 }}>
              {useDecryptText("I want everyone to share my obsession with plants.", conclusion.visible)}
            </h2>
            <p style={{ ...revealStyle(conclusion.visible, 600), fontFamily: mono, fontSize: "18px", color: "rgba(255,255,255,0.6)", marginBottom: 48 }}>
              Orchid makes that possible.
            </p>

            <div className="flex flex-col sm:flex-row gap-4" style={revealStyle(conclusion.visible, 1000)}>
              <button
                onClick={generateAndDownloadPDF}
                className="transition-colors duration-200 hover:bg-white hover:text-black cursor-pointer"
                style={{
                  fontFamily: mono, fontSize: "12px", color: "white",
                  letterSpacing: "0.06em", padding: "14px 24px",
                  border: "1px solid rgba(255,255,255,0.3)", background: "transparent",
                }}
              >
                DOWNLOAD PROPOSAL
              </button>
              <button
                onClick={() => window.location.href = '/demo'}
                className="transition-colors duration-200 hover:bg-white hover:text-black cursor-pointer"
                style={{
                  fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.6)",
                  letterSpacing: "0.06em", padding: "14px 24px",
                  border: "1px solid rgba(255,255,255,0.12)", background: "transparent",
                }}
              >
                TRY ORCHID NOW
              </button>
            </div>

            {/* Orchid — tap to start / QR morph */}
            <div style={{ ...revealStyle(conclusion.visible, 1400), marginTop: 48 }}>
              <QROrchid visible={conclusion.visible} />
            </div>

            {/* Contact */}
            <p style={{ ...revealStyle(conclusion.visible, 1600), fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.2)", marginTop: 32, letterSpacing: "0.04em" }}>
              masudl@uw.edu · orchid.masudlewis.com
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}

export default OrchidProposal;
