import { useRef, useEffect, useCallback } from "react";

const DEFAULT_SIZE = 250;
const MORPH_DURATION = 1200;

function ease(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface Particle {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startDelay: number;
  cpX: number;
  cpY: number;
}

interface QRMorphCanvasProps {
  /** Orchid grid: true = content (light) pixel. Rows × cols, any dimensions. */
  orchidGrid: boolean[][];
  orchidCols: number;
  orchidRows: number;
  /** QR grid: true = dark module. moduleCount × moduleCount, square. */
  qrGrid: boolean[][];
  moduleCount: number;
  active: boolean;
  size?: number;
  /** "dark" = white content on black bg (start page). "light" = black content on white bg (hero). */
  theme?: "dark" | "light";
  onComplete?: () => void;
}

export function QRMorphCanvas({
  orchidGrid,
  orchidCols,
  orchidRows,
  qrGrid,
  moduleCount,
  active,
  size = DEFAULT_SIZE,
  theme = "dark",
  onComplete,
}: QRMorphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Colors based on theme
  const contentColor = theme === "dark" ? "#ffffff" : "#000000";
  const bgColor = theme === "dark" ? "#000000" : "#ffffff";

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // --- Compute orchid cell positions (centered in canvas) ---
    // The orchid is portrait (~20×30), canvas is square. Center it.
    const orchidCellW = size / Math.max(orchidCols, orchidRows * (orchidCols / orchidRows));
    const orchidAspect = orchidCols / orchidRows;
    let orchidW: number, orchidH: number;
    if (orchidAspect < 1) {
      // Portrait: height fills canvas, width is proportionally smaller
      orchidH = size;
      orchidW = size * orchidAspect;
    } else {
      orchidW = size;
      orchidH = size / orchidAspect;
    }
    const orchidOffsetX = (size - orchidW) / 2;
    const orchidOffsetY = (size - orchidH) / 2;
    const oCellW = orchidW / orchidCols;
    const oCellH = orchidH / orchidRows;

    // --- Compute QR cell positions (fills full canvas) ---
    const qCellSize = size / moduleCount;

    // --- Collect content pixels from orchid ---
    // In the orchid, true = content (the flower/pot, light pixels)
    const orchidContent: { r: number; c: number; x: number; y: number }[] = [];
    for (let r = 0; r < orchidRows; r++) {
      for (let c = 0; c < orchidCols; c++) {
        if (orchidGrid[r]?.[c]) {
          orchidContent.push({
            r, c,
            x: orchidOffsetX + (c + 0.5) * oCellW,
            y: orchidOffsetY + (r + 0.5) * oCellH,
          });
        }
      }
    }

    // --- Collect content pixels from QR ---
    // In QR, dark modules (true) are the "content" on a light theme,
    // but on dark theme the QR should be inverted (white modules = content).
    // For scannability, QR dark modules must be the darker color.
    // On dark theme: dark modules = black (bg), light modules = white (content).
    // Wait — QR codes need high contrast. On dark bg, we render:
    //   dark module → bgColor (black), light module → contentColor (white)
    // That means QR "content pixels" to morph TO are the LIGHT modules (where isDark = false).
    // Actually no — standard QR scanners expect dark-on-light. Let's keep it standard:
    //   On dark theme: invert the QR (content = white = where isDark is FALSE)
    //   On light theme: content = black = where isDark is TRUE
    const qrContent: { r: number; c: number; x: number; y: number }[] = [];
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        const isQRContent = theme === "dark" ? !qrGrid[r]?.[c] : qrGrid[r]?.[c];
        if (isQRContent) {
          qrContent.push({
            r, c,
            x: (c + 0.5) * qCellSize,
            y: (r + 0.5) * qCellSize,
          });
        }
      }
    }

    // --- Pair orchid content → QR content via nearest-neighbor ---
    const shuffled = [...orchidContent].sort(() => Math.random() - 0.5);
    const usedQR = new Set<number>();
    const particles: Particle[] = [];

    for (const src of shuffled) {
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < qrContent.length; i++) {
        if (usedQR.has(i)) continue;
        const dx = src.x - qrContent[i].x;
        const dy = src.y - qrContent[i].y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) break;
      usedQR.add(bestIdx);

      const dst = qrContent[bestIdx];
      const midX = (src.x + dst.x) / 2;
      const midY = (src.y + dst.y) / 2;
      const dx = dst.x - src.x;
      const dy = dst.y - src.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const perpScale = (Math.random() - 0.5) * qCellSize * 4;

      particles.push({
        fromX: src.x,
        fromY: src.y,
        toX: dst.x,
        toY: dst.y,
        startDelay: Math.random() * 0.25,
        cpX: midX + (-dy / len) * perpScale,
        cpY: midY + (dx / len) * perpScale,
      });
    }

    // Unpaired orchid pixels (excess source): fade out
    const unpairedOrchid = shuffled.slice(usedQR.size);
    // Unpaired QR pixels (excess target): fade in
    const unpairedQR: typeof qrContent = [];
    for (let i = 0; i < qrContent.length; i++) {
      if (!usedQR.has(i)) unpairedQR.push(qrContent[i]);
    }

    // Cell sizes for drawing
    const srcCellW = oCellW;
    const srcCellH = oCellH;
    const dstCellSize = qCellSize;

    // --- Animation loop ---
    const startTime = performance.now();
    completedRef.current = false;

    const frame = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / MORPH_DURATION, 1);

      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);

      // Draw traveling particles
      for (const p of particles) {
        const localT = Math.max(0, (progress - p.startDelay) / (1 - p.startDelay));
        const clamped = Math.min(localT, 1);
        const eased = ease(clamped);

        // Interpolate position along quadratic bezier
        const u = 1 - eased;
        const x = u * u * p.fromX + 2 * u * eased * p.cpX + eased * eased * p.toX;
        const y = u * u * p.fromY + 2 * u * eased * p.cpY + eased * eased * p.toY;

        // Interpolate cell size from orchid cell to QR cell
        const w = srcCellW + (dstCellSize - srcCellW) * eased;
        const h = srcCellH + (dstCellSize - srcCellH) * eased;

        ctx.fillStyle = contentColor;
        ctx.fillRect(x - w / 2, y - h / 2, w, h);
      }

      // Unpaired orchid pixels: fade out in place
      for (const src of unpairedOrchid) {
        const alpha = 1 - ease(progress);
        if (alpha > 0.01) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = contentColor;
          ctx.fillRect(
            src.x - srcCellW / 2,
            src.y - srcCellH / 2,
            srcCellW,
            srcCellH
          );
          ctx.globalAlpha = 1;
        }
      }

      // Unpaired QR pixels: fade in at target
      for (const dst of unpairedQR) {
        const alpha = ease(progress);
        if (alpha > 0.01) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = contentColor;
          ctx.fillRect(
            dst.x - dstCellSize / 2,
            dst.y - dstCellSize / 2,
            dstCellSize,
            dstCellSize
          );
          ctx.globalAlpha = 1;
        }
      }

      if (progress < 1) {
        animRef.current = requestAnimationFrame(frame);
      } else {
        // Final clean render for scannability
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, size, size);

        // QR background
        ctx.fillStyle = theme === "dark" ? "#000000" : "#ffffff";
        ctx.fillRect(0, 0, size, size);

        // QR modules
        ctx.fillStyle = theme === "dark" ? "#ffffff" : "#000000";
        for (let r = 0; r < moduleCount; r++) {
          for (let c = 0; c < moduleCount; c++) {
            const draw = theme === "dark" ? !qrGrid[r]?.[c] : qrGrid[r]?.[c];
            if (draw) {
              ctx.fillRect(
                Math.floor(c * qCellSize),
                Math.floor(r * qCellSize),
                Math.ceil(qCellSize),
                Math.ceil(qCellSize)
              );
            }
          }
        }

        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current?.();
        }
      }
    };

    animRef.current = requestAnimationFrame(frame);
  }, [orchidGrid, orchidCols, orchidRows, qrGrid, moduleCount, size, theme, contentColor, bgColor]);

  useEffect(() => {
    if (active) {
      animate();
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [active, animate]);

  // Draw orchid grid when not animating
  useEffect(() => {
    if (active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const orchidAspect = orchidCols / orchidRows;
    let orchidW: number, orchidH: number;
    if (orchidAspect < 1) {
      orchidH = size;
      orchidW = size * orchidAspect;
    } else {
      orchidW = size;
      orchidH = size / orchidAspect;
    }
    const offX = (size - orchidW) / 2;
    const offY = (size - orchidH) / 2;
    const cellW = orchidW / orchidCols;
    const cellH = orchidH / orchidRows;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = contentColor;

    for (let r = 0; r < orchidRows; r++) {
      for (let c = 0; c < orchidCols; c++) {
        if (orchidGrid[r]?.[c]) {
          ctx.fillRect(
            Math.floor(offX + c * cellW),
            Math.floor(offY + r * cellH),
            Math.ceil(cellW),
            Math.ceil(cellH)
          );
        }
      }
    }
  }, [active, orchidGrid, orchidCols, orchidRows, size, contentColor, bgColor]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
      }}
    />
  );
}
