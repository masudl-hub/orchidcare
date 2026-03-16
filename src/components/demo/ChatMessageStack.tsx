import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelCanvas } from '@/lib/pixel-canvas/PixelCanvas';
import type { Formation } from '@/lib/pixel-canvas/types';
import { Copy, RefreshCcw, ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react';

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
  userMessageId?: string;
  userImageUrls?: string[];
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
  onDelete?: (id: string) => void;
  onSuggestedAction?: (text: string) => void;
}

function getSuggestedChips(entry: ArtifactEntry): string[] {
  const type = entry.artifactType;
  const data = entry.artifactData || {};
  const msg = (entry.responseMessage || '').toLowerCase();

  // Contextual suggestions based on what just happened
  if (type === 'identification' || msg.includes('identified') || msg.includes('species')) {
    return ['Save this plant', 'Set care reminders', 'Show me care tips'];
  }
  if (type === 'diagnosis' || msg.includes('diagnos') || msg.includes('disease') || msg.includes('pest')) {
    return ['How do I treat this?', 'Find treatment products nearby', 'Set a follow-up reminder'];
  }
  if (type === 'care_guide' || msg.includes('care guide') || msg.includes('how to care')) {
    return ['Set reminders based on this', 'Save this plant', 'Show me a visual guide'];
  }
  if (type === 'store_list' || msg.includes('store') || msg.includes('shop')) {
    return ['Check another store', 'Find something else', 'Thanks!'];
  }
  if (msg.includes('sensor') || msg.includes('moisture') || msg.includes('humidity') || msg.includes('temperature')) {
    return ['Show sensor history', 'Set ideal ranges', 'Compare all plants'];
  }
  if (msg.includes('watered') || msg.includes('water')) {
    return ['Check soil moisture', 'When should I water next?', 'Show my care schedule'];
  }
  if (msg.includes('reminder') || msg.includes('schedule')) {
    return ['Show all reminders', 'How are my plants doing?', 'Any overdue care?'];
  }
  if (msg.includes('saved') || msg.includes('added to your collection')) {
    return ['Set ideal sensor ranges', 'Show my collection', 'Tell me more about this plant'];
  }
  if (msg.includes('range') || msg.includes('ideal')) {
    return ['Check sensor readings', 'Show sensor history', 'How are my plants doing?'];
  }

  // Default suggestions
  return ['How are my plants doing?', 'Check my sensors', 'Any care reminders due?'];
}

function SuggestedChips({ entry, onAction }: { entry: ArtifactEntry; onAction: (text: string) => void }) {
  const chips = getSuggestedChips(entry);
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '6px',
      marginTop: '4px', marginBottom: '0px',
    }}>
      {chips.map(chip => (
        <button
          key={chip}
          onClick={() => onAction(chip)}
          className="cursor-pointer"
          style={{
            fontFamily: mono, fontSize: '11px',
            padding: '5px 12px',
            color: 'rgba(255,255,255,0.6)',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '0px',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

function formatTime(isoStr?: string) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function UserBubble({
  text,
  id,
  timestamp,
  imageUrls,
  onCopy,
  onResend,
  onDelete,
}: {
  text: string;
  id?: string;
  timestamp?: string;
  imageUrls?: string[];
  onCopy?: (text: string) => void;
  onResend?: (text: string) => void;
  onDelete?: (id: string) => void;
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
      {imageUrls && imageUrls.length > 0 && (
        <div style={{ maxWidth: '80%', marginBottom: text && text !== '(photo)' ? '4px' : 0 }}>
          {imageUrls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt="Sent image"
              loading="lazy"
              style={{
                width: '100%',
                maxWidth: 240,
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'block',
              }}
            />
          ))}
        </div>
      )}
      {text && text !== '(photo)' && (
      <div
        style={{
          fontFamily: mono,
          fontSize: '15px',
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
      )}

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
          <span style={{ fontSize: '12px', fontFamily: mono, color: 'rgba(255,255,255,0.5)' }}>{formatTime(timestamp)}</span>
        )}
        {onCopy && (
          <button onClick={handleCopy} title="Copy message" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: copied ? '#4ade80' : 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}>
            <Copy size={13} />
          </button>
        )}
        {onResend && (
          <button onClick={() => onResend(text)} title="Resend message" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center' }}>
            <RefreshCcw size={13} />
          </button>
        )}
        {onDelete && id && (
          <button onClick={() => onDelete(id)} title="Delete message" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(239,68,68,0.5)', display: 'flex', alignItems: 'center' }}>
            <Trash2 size={13} />
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
  onDelete,
}: {
  entryId: string;
  timestamp?: string;
  responseMessage: string;
  rating?: number | null;
  onCopy?: (text: string) => void;
  onRate?: (id: string, rating: number) => void;
  onDelete?: (id: string) => void;
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
        <span style={{ fontSize: '12px', fontFamily: mono, color: 'rgba(255,255,255,0.5)' }}>
          {formatTime(timestamp)}
        </span>
      )}
      {onCopy && (
        <button onClick={handleCopy} title="Copy response" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: copied ? '#4ade80' : 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}>
          <Copy size={13} />
        </button>
      )}
      {onRate && (
        <>
          <button onClick={() => onRate(entryId, 1)} title="Helpful" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: rating === 1 ? '#4ade80' : 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}>
            <ThumbsUp size={13} />
          </button>
          <button onClick={() => onRate(entryId, -1)} title="Not helpful" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: rating === -1 ? '#ef4444' : 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}>
            <ThumbsDown size={13} />
          </button>
        </>
      )}
      {onDelete && (
        <button onClick={() => onDelete(entryId)} title="Delete message" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(239,68,68,0.5)', display: 'flex', alignItems: 'center' }}>
          <Trash2 size={13} />
        </button>
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
  onDelete,
  onSuggestedAction,
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
                {(entry.userMessage || (entry.userImageUrls && entry.userImageUrls.length > 0)) && (
                  <UserBubble
                    text={entry.userMessage || ''}
                    id={entry.userMessageId}
                    timestamp={entry.createdAt}
                    imageUrls={entry.userImageUrls}
                    onCopy={onCopy}
                    onResend={onResend}
                    onDelete={onDelete}
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
                  onDelete={onDelete}
                />

                {/* Suggested action chips — only on latest response, when not loading */}
                {isLatest && !isLoading && onSuggestedAction && (
                  <SuggestedChips entry={entry} onAction={onSuggestedAction} />
                )}
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
