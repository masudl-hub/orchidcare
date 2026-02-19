import React, { useState, useEffect } from 'react';
import { QRMorphCanvas } from '@/components/landing/qr-morph-canvas';
import { generateQRMatrix } from '@/lib/qr-matrix';
import { sampleOrchidGrid } from '@/lib/orchid-grid';

const mono = 'ui-monospace, monospace';
const TELEGRAM_DEEP_LINK = 'https://t.me/orchidcare_bot?start=demo';
const QR_DATA = 't.me/orchidcare_bot?start=demo';
const MORPH_SIZE = 200;

interface DemoLimitScreenProps {
  voiceTurnsRemaining: number;
  onStartVoice?: () => void;
}

export function DemoLimitScreen({
  voiceTurnsRemaining,
  onStartVoice,
}: DemoLimitScreenProps) {
  const [orchidData, setOrchidData] = useState<{
    grid: boolean[][];
    cols: number;
    rows: number;
  } | null>(null);
  const [qrData, setQrData] = useState<{
    grid: boolean[][];
    moduleCount: number;
  } | null>(null);
  const [morphActive, setMorphActive] = useState(false);
  const [hoverCta, setHoverCta] = useState(false);
  const [hoverVoice, setHoverVoice] = useState(false);

  // Load orchid grid + QR grid on mount
  useEffect(() => {
    const qr = generateQRMatrix(QR_DATA);
    setQrData({ grid: qr.grid, moduleCount: qr.moduleCount });

    sampleOrchidGrid().then((result) => {
      setOrchidData({ grid: result.grid, cols: result.cols, rows: result.rows });
    });
  }, []);

  // Start morph animation once both grids are ready
  useEffect(() => {
    if (orchidData && qrData) {
      // Small delay so the orchid renders first, then morphs
      const timer = setTimeout(() => setMorphActive(true), 600);
      return () => clearTimeout(timer);
    }
  }, [orchidData, qrData]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      zIndex: 100,
      overflow: 'auto',
    }}>
      {/* QR Morph Canvas — orchid morphs into QR code */}
      <div style={{
        marginBottom: '32px',
        width: MORPH_SIZE,
        height: MORPH_SIZE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {orchidData && qrData ? (
          <QRMorphCanvas
            orchidGrid={orchidData.grid}
            orchidCols={orchidData.cols}
            orchidRows={orchidData.rows}
            qrGrid={qrData.grid}
            moduleCount={qrData.moduleCount}
            active={morphActive}
            size={MORPH_SIZE}
            theme="dark"
          />
        ) : (
          // Loading placeholder — dim pixel grid
          <div style={{
            width: MORPH_SIZE,
            height: MORPH_SIZE,
            backgroundColor: 'rgba(255,255,255,0.02)',
          }} />
        )}
      </div>

      {/* Message text */}
      <div style={{
        textAlign: 'center',
        maxWidth: '320px',
        marginBottom: '32px',
      }}>
        <p style={{
          fontFamily: mono,
          fontSize: '13px',
          color: 'rgba(255,255,255,0.7)',
          lineHeight: '1.7',
          margin: '0 0 16px 0',
        }}>
          you've used your free turns.
        </p>
        <p style={{
          fontFamily: mono,
          fontSize: '12px',
          color: 'rgba(255,255,255,0.5)',
          lineHeight: '1.7',
          margin: 0,
        }}>
          want to keep going?{'\n'}
          message me on telegram &mdash;{'\n'}
          i'll remember your plants,{'\n'}
          send care reminders, and{'\n'}
          we can chat anytime.
        </p>
      </div>

      {/* CTA button */}
      <a
        href={TELEGRAM_DEEP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setHoverCta(true)}
        onMouseLeave={() => setHoverCta(false)}
        style={{
          display: 'inline-block',
          fontFamily: mono,
          fontSize: '12px',
          color: '#fff',
          textDecoration: 'none',
          border: `1px solid ${hoverCta ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)'}`,
          padding: '12px 24px',
          letterSpacing: '0.05em',
          transition: 'border-color 150ms',
          cursor: 'pointer',
          marginBottom: '12px',
        }}
      >
        open @orchidcare_bot &rarr;
      </a>

      {/* "or scan" hint */}
      <p style={{
        fontFamily: mono,
        fontSize: '10px',
        color: 'rgba(255,255,255,0.3)',
        margin: '0 0 24px 0',
        letterSpacing: '0.03em',
      }}>
        or scan the QR code above
      </p>

      {/* Voice option — only if turns remain */}
      {voiceTurnsRemaining > 0 && onStartVoice && (
        <button
          onClick={onStartVoice}
          onMouseEnter={() => setHoverVoice(true)}
          onMouseLeave={() => setHoverVoice(false)}
          style={{
            background: 'transparent',
            border: `1px solid ${hoverVoice ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}`,
            padding: '10px 20px',
            fontFamily: mono,
            fontSize: '11px',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'border-color 150ms',
            letterSpacing: '0.03em',
          }}
        >
          {/* Mic icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="square">
            <rect x="9" y="1" width="6" height="11" rx="3" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          or try a voice call ({voiceTurnsRemaining} turn{voiceTurnsRemaining !== 1 ? 's' : ''} left)
        </button>
      )}
    </div>
  );
}
