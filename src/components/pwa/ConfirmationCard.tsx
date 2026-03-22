import React from 'react';

const mono = 'ui-monospace, monospace';

interface ConfirmationCardProps {
  reason: string;
  toolName: string;
  onAllow: () => void;
  onReject: () => void;
  disabled?: boolean;
}

export function ConfirmationCard({ reason, toolName, onAllow, onReject, disabled }: ConfirmationCardProps) {
  return (
    <div style={{
      fontFamily: mono,
      fontSize: '14px',
      lineHeight: '1.6',
      color: 'rgba(255,255,255,0.85)',
    }}>
      <p style={{ margin: '0 0 12px' }}>{reason}</p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onAllow}
          disabled={disabled}
          style={{
            fontFamily: mono,
            fontSize: '12px',
            padding: '6px 16px',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.1)',
            color: '#fff',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          Allow
        </button>
        <button
          onClick={onReject}
          disabled={disabled}
          style={{
            fontFamily: mono,
            fontSize: '12px',
            padding: '6px 16px',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '6px',
            background: 'transparent',
            color: 'rgba(255,255,255,0.5)',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
