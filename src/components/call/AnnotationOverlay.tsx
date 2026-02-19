import React, { useState, useEffect } from 'react';
import type { AnnotationSet, AnnotationMarker, GridRegion, ArrowDirection } from '@/hooks/call/types';

// ---------------------------------------------------------------------------
// Grid positions — center of each cell in a 3x3 grid (percentage)
// ---------------------------------------------------------------------------
const GRID: Record<GridRegion, { x: number; y: number }> = {
  TL: { x: 16.67, y: 16.67 }, TC: { x: 50, y: 16.67 }, TR: { x: 83.33, y: 16.67 },
  ML: { x: 16.67, y: 50 },    MC: { x: 50, y: 50 },    MR: { x: 83.33, y: 50 },
  BL: { x: 16.67, y: 83.33 }, BC: { x: 50, y: 83.33 }, BR: { x: 83.33, y: 83.33 },
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

  // Auto-clear after hold duration
  useEffect(() => {
    setClearing(false);
    const holdMs = (annotations.hold ?? 8) * 1000;
    if (holdMs === 0) return; // indefinite

    const holdTimer = setTimeout(() => {
      setClearing(true);
      const fadeTimer = setTimeout(() => onComplete?.(), 300);
      return () => clearTimeout(fadeTimer);
    }, holdMs);

    return () => clearTimeout(holdTimer);
  }, [annotations, onComplete]);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 7,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {annotations.markers.map((marker, i) => {
        const pos = GRID[marker.region] || GRID.MC;
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
