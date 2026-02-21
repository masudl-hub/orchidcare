import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelCanvas } from '@/lib/pixel-canvas/PixelCanvas';
import type { Formation } from '@/lib/pixel-canvas/types';
import { Copy, RefreshCcw, ThumbsUp, ThumbsDown } from 'lucide-react';

const mono = 'ui-monospace, monospace';

/** Serializable data needed to re-hydrate an artifact on page reload. */
export interface ArtifactData {
  artifactType: string;
  artifactData: Record<string, unknown>;
  responseMessage: string;
  images?: { url: string; title: string }[];
}

export interface ArtifactEntry extends ArtifactData {
  id: string;
  element: React.ReactNode;
  userMessage?: string;
  createdAt?: string;
  rating?: number | null;
}

interface ChatMessageStackProps {
  artifacts: ArtifactEntry[];
  isLoading: boolean;
  loadingLabel: string;
  pendingUserMessage: string | null;
  currentFormation: Formation | null;
  onCopy?: (text: string) => void;
  onResend?: (text: string) => void;
  onRate?: (id: string, rating: number) => void;
}

function formatTime(isoStr?: string) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function UserBubble({
  text,
  timestamp,
  onCopy,
  onResend
}: {
  text: string;
  timestamp?: string;
  onCopy?: (text: string) => void;
  onResend?: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy?.(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        marginBottom: '8px',
      }}
    >
      <div
        style={{
          fontFamily: mono,
          fontSize: '12px',
          color: 'rgba(255,255,255,0.5)',
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '8px 12px',
          maxWidth: '80%',
          wordBreak: 'break-word',
          lineHeight: '1.5',
        }}
      >
        {text}
      </div>

      {/* Actions Row — right-aligned */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '12px',
        marginTop: '6px',
        opacity: 0,
        transition: 'opacity 0.25s ease',
        color: 'rgba(255,255,255,0.5)',
        width: '100%',
      }} className="user-action-row">
        {timestamp && (
          <span style={{ fontSize: '10px', fontFamily: mono, color: 'rgba(255,255,255,0.5)' }}>{formatTime(timestamp)}</span>
        )}
        {onCopy && (
          <button onClick={handleCopy} title="Copy message" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: copied ? '#4ade80' : 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}>
            <Copy size={11} />
          </button>
        )}
        {onResend && (
          <button onClick={() => onResend(text)} title="Resend message" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center' }}>
            <RefreshCcw size={11} />
          </button>
        )}
      </div>

      <style>{`
        .user-action-row:hover { opacity: 1 !important; }
        @media (hover: none) { .user-action-row { opacity: 0.5 !important; } }
      `}</style>
    </div>
  );
}

function AgentActionRow({
  entryId,
  timestamp,
  responseMessage,
  rating,
  onCopy,
  onRate,
}: {
  entryId: string;
  timestamp?: string;
  responseMessage: string;
  rating?: number | null;
  onCopy?: (text: string) => void;
  onRate?: (id: string, rating: number) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy?.(responseMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="agent-action-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '12px',
        marginTop: '8px',
        opacity: 0,
        transition: 'opacity 0.25s ease',
        color: 'rgba(255,255,255,0.5)',
        width: '100%',
      }}
    >
      {timestamp && (
        <span style={{ fontSize: '10px', fontFamily: mono, color: 'rgba(255,255,255,0.5)' }}>
          {formatTime(timestamp)}
        </span>
      )}
      {onCopy && (
        <button onClick={handleCopy} title="Copy response" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: copied ? '#4ade80' : 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}>
          <Copy size={11} />
        </button>
      )}
      {onRate && (
        <>
          <button onClick={() => onRate(entryId, 1)} title="Helpful" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: rating === 1 ? '#4ade80' : 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}>
            <ThumbsUp size={11} />
          </button>
          <button onClick={() => onRate(entryId, -1)} title="Not helpful" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: rating === -1 ? '#ef4444' : 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}>
            <ThumbsDown size={11} />
          </button>
        </>
      )}
    </div>
  );
}

function SmallCanvas({ formation, isThinking }: { formation: Formation | null; isThinking: boolean }) {
  return (
    <div style={{ width: 48, flexShrink: 0, alignSelf: 'flex-start' }}>
      <PixelCanvas
        isSpeaking={false}
        isListening={false}
        outputAudioLevel={0}
        isThinking={isThinking}
        formation={formation}
        onFormationComplete={() => { }}
        heightPx={48}
      />
    </div>
  );
}

export function ChatMessageStack({
  artifacts,
  isLoading,
  loadingLabel,
  pendingUserMessage,
  currentFormation,
  onCopy,
  onResend,
  onRate,
}: ChatMessageStackProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [artifacts.length, pendingUserMessage, isLoading]);

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'max(64px, env(safe-area-inset-top, 64px)) 16px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      <style>{`
        .demo-artifact-stack::-webkit-scrollbar { display: none; }
      `}</style>
      <div className="demo-artifact-stack" style={{ display: 'contents' }}>
        <AnimatePresence mode="popLayout">
          {artifacts.map((entry, index) => {
            const isLatest = index === artifacts.length - 1;
            const showCanvas = isLatest && !isLoading;

            return (
              <motion.div
                key={entry.id}
                initial={{ y: 40, opacity: 0 }}
                animate={{
                  y: 0,
                  opacity: isLatest ? 1 : 0.4,
                }}
                whileHover={{ opacity: 1 }}
                transition={{
                  duration: 0.4,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="artifact-block-hover"
                style={{
                  width: '100%',
                  maxWidth: 680,
                  position: 'relative',
                }}
              >
                {/* User message bubble */}
                {entry.userMessage && (
                  <UserBubble
                    text={entry.userMessage}
                    timestamp={entry.createdAt}
                    onCopy={onCopy}
                    onResend={onResend}
                  />
                )}

                {/* Canvas in left gutter — outside the 680px column */}
                {showCanvas && (
                  <div style={{ position: 'absolute', left: -60, top: entry.userMessage ? 40 : 0 }}>
                    <SmallCanvas formation={currentFormation} isThinking={false} />
                  </div>
                )}

                {/* Artifact card — full column width */}
                {entry.element}

                {/* Agent Action Row */}
                <AgentActionRow
                  entryId={entry.id}
                  timestamp={entry.createdAt}
                  responseMessage={entry.responseMessage}
                  rating={entry.rating}
                  onCopy={onCopy}
                  onRate={onRate}
                />
              </motion.div>
            );
          })}

          <style>{`
            .artifact-block-hover:hover .agent-action-row { opacity: 1 !important; }
            @media (hover: none) { .agent-action-row { opacity: 0.5 !important; } }
          `}</style>

          {/* Pending user message — appears instantly before API responds */}
          {pendingUserMessage && (
            <motion.div
              key="pending-user-msg"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{ width: '100%', maxWidth: 680 }}
            >
              <UserBubble text={pendingUserMessage} />
            </motion.div>
          )}

          {/* Thinking row: canvas in left gutter + "thinking..." in column */}
          {isLoading && (
            <motion.div
              key="thinking-row"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 680,
              }}
            >
              <div style={{ position: 'absolute', left: -60, top: 0 }}>
                <SmallCanvas formation={currentFormation} isThinking={true} />
              </div>
              <span
                style={{
                  fontFamily: mono,
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.35)',
                }}
              >
                {loadingLabel}...
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom spacer for scroll padding */}
        <div style={{ minHeight: '8px', flexShrink: 0 }} />
      </div>
    </div>
  );
}
