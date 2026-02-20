import React from 'react';

interface CallControlsProps {
  isMuted: boolean;
  isVideoActive: boolean;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  disabled: boolean;
}

export function CallControls({ isMuted, isVideoActive, onToggleMic, onToggleVideo, onEndCall, disabled }: CallControlsProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
    }}>
      {/* Mic toggle */}
      <button
        onClick={onToggleMic}
        disabled={disabled}
        style={{
          width: '56px',
          height: '56px',
          backgroundColor: 'transparent',
          border: `2px solid ${isMuted ? 'rgba(255,255,255,0.3)' : '#fff'}`,
          borderRadius: '0',
          cursor: disabled ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.3 : 1,
          transition: 'all 150ms',
        }}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          // Mic off icon
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="square">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.12 1.5-.35 2.18" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        ) : (
          // Mic on icon
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="square">
            <rect x="9" y="1" width="6" height="11" rx="3" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>

      {/* End call */}
      <button
        onClick={onEndCall}
        style={{
          width: '64px',
          height: '56px',
          backgroundColor: '#d91e1e',
          border: '2px solid #d91e1e',
          borderRadius: '0',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 150ms',
        }}
        aria-label="End call"
      >
        {/* Phone down icon */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="square">
          <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
        </svg>
      </button>

      {/* Video toggle */}
      <button
        onClick={onToggleVideo}
        disabled={disabled}
        style={{
          width: '56px',
          height: '56px',
          backgroundColor: isVideoActive ? 'rgba(255,255,255,0.15)' : 'transparent',
          border: `2px solid ${isVideoActive ? '#fff' : 'rgba(255,255,255,0.3)'}`,
          borderRadius: '0',
          cursor: disabled ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.3 : 1,
          transition: 'all 150ms',
        }}
        aria-label={isVideoActive ? 'Stop camera' : 'Start camera'}
      >
        {isVideoActive ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="square">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="0" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="square">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M21 7l-5 3.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9" />
          </svg>
        )}
      </button>

    </div>
  );
}
