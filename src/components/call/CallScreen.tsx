import React, { useRef, useEffect } from 'react';
import { PixelCanvas } from '@/lib/pixel-canvas/PixelCanvas';
import type { Formation } from '@/lib/pixel-canvas/types';
import { AnnotationOverlay } from './AnnotationOverlay';
import type { AnnotationSet } from '@/hooks/call/types';
import { CallControls } from './CallControls';

const mono = 'ui-monospace, monospace';

interface CallScreenProps {
  status: string;
  isSpeaking: boolean;
  isListening: boolean;
  isMuted: boolean;
  isVideoActive: boolean;
  videoStream: MediaStream | null;
  isToolExecuting: boolean;
  executingToolName: string;
  outputAudioLevel: number;
  callDuration: number;
  formation: Formation | null;
  onFormationComplete?: () => void;
  annotations?: AnnotationSet | null;
  onAnnotationsComplete?: () => void;
  facingMode: 'environment' | 'user';
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onToggleFacingMode: () => void;
  onEndCall: () => void;
  onCaptureSnapshot?: () => void;
}

export function CallScreen({
  status,
  isSpeaking,
  isListening,
  isMuted,
  isVideoActive,
  videoStream,
  isToolExecuting,
  executingToolName,
  outputAudioLevel,
  callDuration,
  formation,
  onFormationComplete,
  annotations,
  onAnnotationsComplete,
  facingMode,
  onToggleMic,
  onToggleVideo,
  onToggleFacingMode,
  onEndCall,
  onCaptureSnapshot,
}: CallScreenProps) {
  // Attach video stream to the preview element.
  // Depend on isVideoActive too so the effect re-runs when the <video> mounts.
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream, isVideoActive]);

  const minutes = String(Math.floor(callDuration / 60)).padStart(2, '0');
  const seconds = String(callDuration % 60).padStart(2, '0');

  const statusText = (() => {
    switch (status) {
      case 'idle': return 'starting...';
      case 'connecting': return 'connecting...';
      case 'reconnecting': return 'reconnecting...';
      case 'error': return 'connection failed';
      case 'ended': return 'call ended';
      case 'connected':
        if (isToolExecuting) {
          const toolLabels: Record<string, string> = {
            deep_think: 'thinking deeply...',
            research: 'researching...',
            find_stores: 'finding stores...',
            verify_store_inventory: 'checking inventory...',
            save_plant: 'saving plant...',
            modify_plant: 'updating plant...',
            delete_plant: 'removing plant...',
            create_reminder: 'setting reminder...',
            log_care_event: 'logging care...',
            save_user_insight: 'remembering...',
            update_profile: 'updating profile...',
            capture_plant_snapshot: 'capturing snapshot...',
            compare_plant_snapshots: 'comparing snapshots...',
          };
          return toolLabels[executingToolName] || 'orchid is thinking...';
        }
        if (isSpeaking) return 'orchid is speaking...';
        if (isListening) return 'listening...';
        return 'listening...';
      default: return '';
    }
  })();

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflow: 'hidden',
    }}>
      {/* Grain overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: 0.04,
        mixBlendMode: 'screen' as const,
        zIndex: 40,
      }}>
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <filter id="grain-call">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-call)" />
        </svg>
      </div>

      {/* Camera feed (full background when video active) */}
      {isVideoActive && videoStream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 5,
          }}
        />
      )}

      {/* Annotation overlay (between video and PixelCanvas) */}
      {isVideoActive && annotations && annotations.markers.length > 0 && (
        <AnnotationOverlay annotations={annotations} onComplete={onAnnotationsComplete} />
      )}

      {/* Canvas area — 80% of viewport height */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        width: '100%',
        ...(isVideoActive ? {
          position: 'absolute',
          top: '16px',
          right: '16px',
          width: 'auto',
          flex: 'none',
        } : {}),
      }}>
        <div style={{
          transform: isVideoActive ? 'scale(0.3)' : 'scale(1)',
          transformOrigin: 'top right',
          transition: 'transform 300ms ease',
        }}>
          <PixelCanvas
            isSpeaking={isSpeaking}
            isListening={isListening}
            outputAudioLevel={outputAudioLevel}
            isThinking={isToolExecuting}
            formation={formation}
            onFormationComplete={onFormationComplete}
          />
        </div>
      </div>

      {/* Status text */}
      <div style={{
        zIndex: 15,
        textAlign: 'center',
        padding: '8px 16px',
        ...(isVideoActive ? {
          position: 'absolute',
          bottom: '100px',
          left: 0,
          right: 0,
        } : {}),
      }}>
        <p style={{
          fontFamily: mono,
          fontSize: '11px',
          color: isVideoActive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.5)',
          letterSpacing: '0.05em',
          textShadow: isVideoActive ? '0 1px 3px rgba(0,0,0,0.8)' : 'none',
          margin: 0,
        }}>
          {statusText}
        </p>
      </div>

      {/* Bottom bar: controls + timer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '16px 16px 32px',
        zIndex: 10,
        width: '100%',
      }}>
        <CallControls
          isMuted={isMuted}
          isVideoActive={isVideoActive}
          facingMode={facingMode}
          onToggleMic={onToggleMic}
          onToggleVideo={onToggleVideo}
          onToggleFacingMode={onToggleFacingMode}
          onEndCall={onEndCall}
          onCaptureSnapshot={isVideoActive ? onCaptureSnapshot : undefined}
          disabled={status !== 'connected'}
        />
        <span style={{
          fontFamily: mono,
          fontSize: '12px',
          color: 'rgba(255,255,255,0.6)',
          minWidth: '48px',
          textAlign: 'center',
        }}>
          {minutes}:{seconds}
        </span>
      </div>
    </div>
  );
}
