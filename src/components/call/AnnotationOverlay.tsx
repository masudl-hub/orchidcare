import React, { useState, useEffect, useRef } from 'react';
import type { AnnotationSet, AnnotationMarker, GridRegion, ArrowDirection } from '@/hooks/call/types';

// ---------------------------------------------------------------------------
// Grid positions — center of each cell in a 10×10 grid (percentage)
// Rows A (top, y=5%) → J (bottom, y=95%), cols 1 (left, x=5%) → 10 (right, x=95%)
// ---------------------------------------------------------------------------
const GRID: Record<GridRegion, { x: number; y: number }> = {
  A1: { x:  5, y:  5 }, A2: { x: 15, y:  5 }, A3: { x: 25, y:  5 }, A4: { x: 35, y:  5 }, A5: { x: 45, y:  5 }, A6: { x: 55, y:  5 }, A7: { x: 65, y:  5 }, A8: { x: 75, y:  5 }, A9: { x: 85, y:  5 }, A10: { x: 95, y:  5 },
  B1: { x:  5, y: 15 }, B2: { x: 15, y: 15 }, B3: { x: 25, y: 15 }, B4: { x: 35, y: 15 }, B5: { x: 45, y: 15 }, B6: { x: 55, y: 15 }, B7: { x: 65, y: 15 }, B8: { x: 75, y: 15 }, B9: { x: 85, y: 15 }, B10: { x: 95, y: 15 },
  C1: { x:  5, y: 25 }, C2: { x: 15, y: 25 }, C3: { x: 25, y: 25 }, C4: { x: 35, y: 25 }, C5: { x: 45, y: 25 }, C6: { x: 55, y: 25 }, C7: { x: 65, y: 25 }, C8: { x: 75, y: 25 }, C9: { x: 85, y: 25 }, C10: { x: 95, y: 25 },
  D1: { x:  5, y: 35 }, D2: { x: 15, y: 35 }, D3: { x: 25, y: 35 }, D4: { x: 35, y: 35 }, D5: { x: 45, y: 35 }, D6: { x: 55, y: 35 }, D7: { x: 65, y: 35 }, D8: { x: 75, y: 35 }, D9: { x: 85, y: 35 }, D10: { x: 95, y: 35 },
  E1: { x:  5, y: 45 }, E2: { x: 15, y: 45 }, E3: { x: 25, y: 45 }, E4: { x: 35, y: 45 }, E5: { x: 45, y: 45 }, E6: { x: 55, y: 45 }, E7: { x: 65, y: 45 }, E8: { x: 75, y: 45 }, E9: { x: 85, y: 45 }, E10: { x: 95, y: 45 },
  F1: { x:  5, y: 55 }, F2: { x: 15, y: 55 }, F3: { x: 25, y: 55 }, F4: { x: 35, y: 55 }, F5: { x: 45, y: 55 }, F6: { x: 55, y: 55 }, F7: { x: 65, y: 55 }, F8: { x: 75, y: 55 }, F9: { x: 85, y: 55 }, F10: { x: 95, y: 55 },
  G1: { x:  5, y: 65 }, G2: { x: 15, y: 65 }, G3: { x: 25, y: 65 }, G4: { x: 35, y: 65 }, G5: { x: 45, y: 65 }, G6: { x: 55, y: 65 }, G7: { x: 65, y: 65 }, G8: { x: 75, y: 65 }, G9: { x: 85, y: 65 }, G10: { x: 95, y: 65 },
  H1: { x:  5, y: 75 }, H2: { x: 15, y: 75 }, H3: { x: 25, y: 75 }, H4: { x: 35, y: 75 }, H5: { x: 45, y: 75 }, H6: { x: 55, y: 75 }, H7: { x: 65, y: 75 }, H8: { x: 75, y: 75 }, H9: { x: 85, y: 75 }, H10: { x: 95, y: 75 },
  I1: { x:  5, y: 85 }, I2: { x: 15, y: 85 }, I3: { x: 25, y: 85 }, I4: { x: 35, y: 85 }, I5: { x: 45, y: 85 }, I6: { x: 55, y: 85 }, I7: { x: 65, y: 85 }, I8: { x: 75, y: 85 }, I9: { x: 85, y: 85 }, I10: { x: 95, y: 85 },
  J1: { x:  5, y: 95 }, J2: { x: 15, y: 95 }, J3: { x: 25, y: 95 }, J4: { x: 35, y: 95 }, J5: { x: 45, y: 95 }, J6: { x: 55, y: 95 }, J7: { x: 65, y: 95 }, J8: { x: 75, y: 95 }, J9: { x: 85, y: 95 }, J10: { x: 95, y: 95 },
};

const ROTATIONS: Record<ArrowDirection, number> = {
  up: 0, 'up-right': 45, right: 90, 'down-right': 135,
  down: 180, 'down-left': 225, left: 270, 'up-left': 315,
};

// ---------------------------------------------------------------------------
// Pixel-art marker SVGs (8x8 grid, rendered at 40px)
// ---------------------------------------------------------------------------

function ArrowMarker({ direction }: { direction?: ArrowDirection }) {
  const angle = ROTATIONS[direction || 'down'];
  return (
    <svg width="40" height="40" viewBox="0 0 8 8" style={{ imageRendering: 'pixelated' as any }}>
      <g transform={`rotate(${angle} 4 4)`} fill="#fff">
        {/* Arrowhead */}
        <rect x="3" y="0" width="2" height="1" />
        <rect x="2" y="1" width="4" height="1" />
        <rect x="1" y="2" width="6" height="1" />
        {/* Shaft */}
        <rect x="3" y="3" width="2" height="1" />
        <rect x="3" y="4" width="2" height="1" />
        <rect x="3" y="5" width="2" height="1" />
        <rect x="3" y="6" width="2" height="1" />
        <rect x="3" y="7" width="2" height="1" />
      </g>
    </svg>
  );
}

function CircleMarker() {
  // Pixel-art ring
  return (
    <svg width="40" height="40" viewBox="0 0 8 8" style={{ imageRendering: 'pixelated' as any }}>
      <g fill="#fff">
        <rect x="2" y="0" width="4" height="1" />
        <rect x="1" y="1" width="1" height="1" />
        <rect x="6" y="1" width="1" height="1" />
        <rect x="0" y="2" width="1" height="4" />
        <rect x="7" y="2" width="1" height="4" />
        <rect x="1" y="6" width="1" height="1" />
        <rect x="6" y="6" width="1" height="1" />
        <rect x="2" y="7" width="4" height="1" />
      </g>
    </svg>
  );
}

function XMarker() {
  // Diagonal cross — red-tinted for problems
  return (
    <svg width="40" height="40" viewBox="0 0 8 8" style={{ imageRendering: 'pixelated' as any }}>
      <g fill="#ff4444">
        <rect x="0" y="0" width="2" height="1" /><rect x="6" y="0" width="2" height="1" />
        <rect x="1" y="1" width="2" height="1" /><rect x="5" y="1" width="2" height="1" />
        <rect x="2" y="2" width="2" height="1" /><rect x="4" y="2" width="2" height="1" />
        <rect x="3" y="3" width="2" height="1" />
        <rect x="3" y="4" width="2" height="1" />
        <rect x="2" y="5" width="2" height="1" /><rect x="4" y="5" width="2" height="1" />
        <rect x="1" y="6" width="2" height="1" /><rect x="5" y="6" width="2" height="1" />
        <rect x="0" y="7" width="2" height="1" /><rect x="6" y="7" width="2" height="1" />
      </g>
    </svg>
  );
}

function LabelBox({ text }: { text: string }) {
  return (
    <div style={{
      padding: '4px 8px',
      border: '1px solid rgba(255,255,255,0.8)',
      backgroundColor: 'rgba(0,0,0,0.7)',
      fontFamily: "'Press Start 2P', ui-monospace, monospace",
      fontSize: '8px',
      color: '#fff',
      letterSpacing: '0.05em',
      whiteSpace: 'nowrap',
      lineHeight: 1.4,
    }}>
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main overlay component
// ---------------------------------------------------------------------------

interface AnnotationOverlayProps {
  annotations: AnnotationSet;
  onComplete?: () => void;
}

export function AnnotationOverlay({ annotations, onComplete }: AnnotationOverlayProps) {
  const [clearing, setClearing] = useState(false);

  // Keep onComplete in a ref so the timer effect never re-runs just because
  // the parent re-renders and produces a new inline arrow function reference.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // Auto-clear after hold duration — only re-runs when annotations actually change.
  useEffect(() => {
    setClearing(false);
    const holdMs = (annotations.hold ?? 8) * 1000;
    if (holdMs === 0) return; // indefinite

    let fadeTimer: ReturnType<typeof setTimeout>;
    const holdTimer = setTimeout(() => {
      setClearing(true);
      fadeTimer = setTimeout(() => onCompleteRef.current?.(), 300);
    }, holdMs);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(fadeTimer);
    };
  }, [annotations]);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 7,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {annotations.markers.map((marker, i) => {
        const pos = GRID[marker.region] || GRID.E5;
        return (
          <div
            key={`${marker.region}-${marker.type}-${i}`}
            style={{
              position: 'absolute',
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))',
              opacity: clearing ? 0 : 1,
              transition: clearing ? 'opacity 300ms ease-out' : undefined,
              animation: clearing ? undefined : `annotate-in 300ms ease-out ${i * 120}ms both`,
            }}
          >
            {marker.type === 'label' ? (
              <LabelBox text={marker.label || ''} />
            ) : (
              <>
                {marker.type === 'arrow' && <ArrowMarker direction={marker.direction} />}
                {marker.type === 'circle' && <CircleMarker />}
                {marker.type === 'x' && <XMarker />}
                {marker.label && (
                  <span style={{
                    fontFamily: "'Press Start 2P', ui-monospace, monospace",
                    fontSize: '7px',
                    color: marker.type === 'x' ? '#ff4444' : '#fff',
                    letterSpacing: '0.05em',
                    textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                    whiteSpace: 'nowrap',
                  }}>
                    {marker.label}
                  </span>
                )}
              </>
            )}
          </div>
        );
      })}

      {/* Keyframe animation — injected inline */}
      <style>{`
        @keyframes annotate-in {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
}
