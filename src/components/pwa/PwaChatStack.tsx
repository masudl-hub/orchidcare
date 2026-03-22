// PWA chat message stack — single source of truth.
// Renders directly from PwaMessage[], no separate artifacts array.
// Each message renders based on its role + metadata.

import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelCanvas } from '@/lib/pixel-canvas/PixelCanvas';
import type { Formation } from '@/lib/pixel-canvas/types';
import { ChatResponse } from '@/components/demo/artifacts/ChatResponse';
import { ShoppingResults } from '@/components/pwa/ShoppingResults';
import { ConfirmationCard } from './ConfirmationCard';
import { Copy, RefreshCcw, ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const mono = 'ui-monospace, monospace';

export interface PwaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  rating?: number | null;
  media?: { type: string; data: string }[];
  mediaUrls?: string[];
  metadata?: {
    images?: { url: string; caption?: string }[];
    shopping?: Record<string, any>;
    pendingAction?: { tool_name: string; args: Record<string, unknown>; reason: string; tier: string };
  };
}

interface PwaChatStackProps {
  messages: PwaMessage[];
  isLoading: boolean;
  loadingLabel: string;
  pendingUserMessage: string | null;
  currentFormation: Formation | null;
  onCopy?: (text: string) => void;
  onResend?: (text: string) => void;
  onRate?: (id: string, rating: number) => void;
  onDelete?: (id: string) => void;
  onSuggestedAction?: (text: string) => void;
  onConfirm?: (messageId: string, action: NonNullable<PwaMessage['metadata']>['pendingAction']) => void;
  onReject?: (messageId: string) => void;
}

// ─── Media URL resolution ───────────────────────────────────────────────────
// Storage paths (bucket:path or raw paths) need signed URLs for display.

function useResolvedUrl(rawUrl: string | undefined): string | null {
  const [resolved, setResolved] = useState<string | null>(null);
  const urlRef = useRef(rawUrl);

  useEffect(() => {
    if (!rawUrl) { setResolved(null); return; }
    if (rawUrl.startsWith('http')) { setResolved(rawUrl); return; }

    urlRef.current = rawUrl;
    const parts = rawUrl.includes(':') ? rawUrl.split(':') : ['plant-photos', rawUrl];
    const bucket = parts[0];
    const path = parts.slice(1).join(':');

    supabase.storage.from(bucket).createSignedUrl(path, 3600).then(({ data }) => {
      if (urlRef.current === rawUrl && data?.signedUrl) setResolved(data.signedUrl);
    });
  }, [rawUrl]);

  return resolved;
}

function ResolvedImage({ url, alt }: { url: string; alt?: string }) {
  const resolved = useResolvedUrl(url);
  if (!resolved) return null;
  return (
    <img
      src={resolved}
      alt={alt || 'Image'}
      loading="lazy"
      style={{
        width: '100%',
        maxWidth: 240,
        borderRadius: '4px',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'block',
      }}
    />
  );
}

// ─── Suggested Chips ────────────────────────────────────────────────────────

function getSuggestedChips(msg: PwaMessage): string[] {
  const text = (msg.content || '').toLowerCase();
  const meta = msg.metadata;

  if (meta?.shopping) return ['Check another store', 'Find something else'];
  if (text.includes('identified') || text.includes('species')) return ['Save this plant', 'Set care reminders', 'Show me care tips'];
  if (text.includes('diagnos') || text.includes('disease') || text.includes('pest')) return ['How do I treat this?', 'Find treatment products nearby'];
  if (text.includes('sensor') || text.includes('moisture')) return ['Show sensor history', 'Set ideal ranges'];
  if (text.includes('watered') || text.includes('water')) return ['Check soil moisture', 'When should I water next?'];
  if (text.includes('reminder') || text.includes('schedule')) return ['Show all reminders', 'Any overdue care?'];
  if (text.includes('saved') || text.includes('added to your collection')) return ['Set ideal sensor ranges', 'Show my collection'];
  return ['How are my plants doing?', 'Check my sensors', 'Any care reminders due?'];
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function formatTime(isoStr?: string) {
  if (!isoStr) return '';
  return new Date(isoStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function UserBubble({ msg, onCopy, onResend, onDelete }: {
  msg: PwaMessage;
  onCopy?: (text: string) => void;
  onResend?: (text: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const text = msg.content;

  // Resolve media — local uploads (pre-send) or DB media_urls
  const localImages = msg.media?.map(m => `data:${m.type};base64,${m.data}`) || [];
  const dbImages = msg.mediaUrls || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginBottom: '8px' }}>
      {/* Images */}
      {localImages.length > 0 && localImages.map((url, i) => (
        <div key={`local-${i}`} style={{ maxWidth: '80%', marginBottom: '4px' }}>
          <img src={url} alt="Sent" loading="lazy" style={{ width: '100%', maxWidth: 240, borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', display: 'block' }} />
        </div>
      ))}
      {dbImages.length > 0 && dbImages.map((url, i) => (
        <div key={`db-${i}`} style={{ maxWidth: '80%', marginBottom: '4px' }}>
          <ResolvedImage url={url} alt="Sent" />
        </div>
      ))}

      {/* Text */}
      {text && text !== '(photo)' && (
        <div style={{
          fontFamily: mono, fontSize: '15px', color: 'rgba(255,255,255,0.5)',
          backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          padding: '8px 12px', maxWidth: '80%', wordBreak: 'break-word', lineHeight: '1.5',
        }}>
          {text}
        </div>
      )}

      {/* Actions */}
      <div className="user-action-row" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        gap: '12px', marginTop: '6px', opacity: 0, transition: 'opacity 0.25s ease',
      }}>
        {msg.createdAt && <span style={{ fontSize: '12px', fontFamily: mono, color: 'rgba(255,255,255,0.5)' }}>{formatTime(msg.createdAt)}</span>}
        {onCopy && <button onClick={() => { onCopy(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: copied ? '#4ade80' : 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center' }}><Copy size={13} /></button>}
        {onResend && <button onClick={() => onResend(text)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center' }}><RefreshCcw size={13} /></button>}
        {onDelete && <button onClick={() => onDelete(msg.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(239,68,68,0.5)', display: 'flex', alignItems: 'center' }}><Trash2 size={13} /></button>}
      </div>
      <style>{`.user-action-row:hover { opacity: 1 !important; } @media (hover: none) { .user-action-row { opacity: 0.5 !important; } }`}</style>
    </div>
  );
}

function AssistantBubble({ msg, isLatest, isLoading, currentFormation, onCopy, onRate, onDelete, onSuggestedAction, onConfirm, onReject }: {
  msg: PwaMessage;
  isLatest: boolean;
  isLoading: boolean;
  currentFormation: Formation | null;
  onCopy?: (text: string) => void;
  onRate?: (id: string, rating: number) => void;
  onDelete?: (id: string) => void;
  onSuggestedAction?: (text: string) => void;
  onConfirm?: (messageId: string, action: NonNullable<PwaMessage['metadata']>['pendingAction']) => void;
  onReject?: (messageId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const meta = msg.metadata;
  const showCanvas = isLatest && !isLoading;

  // Resolve images from metadata or mediaUrls
  const images = meta?.images?.map(img => {
    if (img.url.startsWith('http')) return img;
    return img; // will be resolved by ChatResponse or ResolvedImage
  });

  return (
    <div style={{ position: 'relative' }}>
      {/* Canvas in left gutter */}
      {showCanvas && (
        <div style={{ position: 'absolute', left: -60, top: 0 }}>
          <div style={{ width: 48, flexShrink: 0 }}>
            <PixelCanvas isSpeaking={false} isListening={false} outputAudioLevel={0} isThinking={false} formation={currentFormation} onFormationComplete={() => {}} heightPx={48} />
          </div>
        </div>
      )}

      {/* Content */}
      {meta?.pendingAction ? (
        <ConfirmationCard
          reason={meta.pendingAction.reason}
          toolName={meta.pendingAction.tool_name}
          onAllow={() => onConfirm?.(msg.id, meta.pendingAction!)}
          onReject={() => onReject?.(msg.id)}
        />
      ) : (
        <>
          <ChatResponse text={msg.content} images={images as any} />
          {meta?.shopping && (
            <ShoppingResults
              products={meta.shopping.products}
              productSearchQuery={meta.shopping.productSearchQuery}
              stores={meta.shopping.stores}
              storeSearchQuery={meta.shopping.storeSearchQuery}
              storeLocation={meta.shopping.storeLocation}
            />
          )}
        </>
      )}

      {/* Action row */}
      <div className="agent-action-row" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        gap: '12px', marginTop: '8px', opacity: 0, transition: 'opacity 0.25s ease',
      }}>
        {msg.createdAt && <span style={{ fontSize: '12px', fontFamily: mono, color: 'rgba(255,255,255,0.5)' }}>{formatTime(msg.createdAt)}</span>}
        {onCopy && <button onClick={() => { onCopy(msg.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: copied ? '#4ade80' : 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center' }}><Copy size={13} /></button>}
        {onRate && (
          <>
            <button onClick={() => onRate(msg.id, 1)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: msg.rating === 1 ? '#4ade80' : 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center' }}><ThumbsUp size={13} /></button>
            <button onClick={() => onRate(msg.id, -1)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: msg.rating === -1 ? '#ef4444' : 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center' }}><ThumbsDown size={13} /></button>
          </>
        )}
        {onDelete && <button onClick={() => onDelete(msg.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(239,68,68,0.5)', display: 'flex', alignItems: 'center' }}><Trash2 size={13} /></button>}
      </div>

      {/* Suggested chips */}
      {isLatest && !isLoading && onSuggestedAction && !meta?.pendingAction && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
          {getSuggestedChips(msg).map(chip => (
            <button
              key={chip}
              onClick={() => onSuggestedAction(chip)}
              className="cursor-pointer"
              style={{
                fontFamily: mono, fontSize: '11px', padding: '5px 12px',
                color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.03)', borderRadius: '0px', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Stack ─────────────────────────────────────────────────────────────

export function PwaChatStack({
  messages,
  isLoading,
  loadingLabel,
  pendingUserMessage,
  currentFormation,
  onCopy,
  onResend,
  onRate,
  onDelete,
  onSuggestedAction,
  onConfirm,
  onReject,
}: PwaChatStackProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [messages.length, pendingUserMessage, isLoading]);

  // Find the last assistant message index for "isLatest" logic
  const lastAssistantIndex = messages.reduce((acc, m, i) => m.role === 'assistant' ? i : acc, -1);

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1, overflowY: 'auto',
        padding: 'max(64px, env(safe-area-inset-top, 64px)) 16px 0',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '12px', scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}
    >
      <style>{`.pwa-chat-stack::-webkit-scrollbar { display: none; } .artifact-block-hover:hover .agent-action-row { opacity: 1 !important; } @media (hover: none) { .agent-action-row { opacity: 0.5 !important; } }`}</style>
      <div className="pwa-chat-stack" style={{ display: 'contents' }}>
        <AnimatePresence mode="popLayout">
          {messages.map((msg, index) => (
            <motion.div
              key={msg.id}
              initial={{ y: 40, opacity: 0 }}
              animate={{
                y: 0,
                opacity: msg.role === 'assistant' && index !== lastAssistantIndex ? 0.4 : 1,
              }}
              whileHover={{ opacity: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={msg.role === 'assistant' ? 'artifact-block-hover' : ''}
              style={{ width: '100%', maxWidth: 680 }}
            >
              {msg.role === 'user' ? (
                <UserBubble msg={msg} onCopy={onCopy} onResend={onResend} onDelete={onDelete} />
              ) : (
                <AssistantBubble
                  msg={msg}
                  isLatest={index === lastAssistantIndex}
                  isLoading={isLoading}
                  currentFormation={currentFormation}
                  onCopy={onCopy}
                  onRate={onRate}
                  onDelete={onDelete}
                  onSuggestedAction={onSuggestedAction}
                  onConfirm={onConfirm}
                  onReject={onReject}
                />
              )}
            </motion.div>
          ))}

          {/* Pending user message */}
          {pendingUserMessage && (
            <motion.div
              key="pending-user-msg"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{ width: '100%', maxWidth: 680 }}
            >
              <UserBubble msg={{ id: 'pending', role: 'user', content: pendingUserMessage, createdAt: new Date().toISOString() }} />
            </motion.div>
          )}

          {/* Thinking indicator */}
          {isLoading && (
            <motion.div
              key="thinking-row"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: 'relative', width: '100%', maxWidth: 680 }}
            >
              <div style={{ position: 'absolute', left: -60, top: 0 }}>
                <div style={{ width: 48 }}>
                  <PixelCanvas isSpeaking={false} isListening={false} outputAudioLevel={0} isThinking={true} formation={currentFormation} onFormationComplete={() => {}} heightPx={48} />
                </div>
              </div>
              <span style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                {loadingLabel}...
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ minHeight: '8px', flexShrink: 0 }} />
      </div>
    </div>
  );
}
