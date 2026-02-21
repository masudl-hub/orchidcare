import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelCanvas } from '@/lib/pixel-canvas/PixelCanvas';
import type { Formation } from '@/lib/pixel-canvas/types';

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
}

interface DemoArtifactStackProps {
  artifacts: ArtifactEntry[];
  isLoading: boolean;
  loadingLabel: string;
  pendingUserMessage: string | null;
  currentFormation: Formation | null;
}

function UserBubble({ text }: { text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
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

export function DemoArtifactStack({
  artifacts,
  isLoading,
  loadingLabel,
  pendingUserMessage,
  currentFormation,
}: DemoArtifactStackProps) {
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
                transition={{
                  duration: 0.4,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{
                  width: '100%',
                  maxWidth: 680,
                  position: 'relative',
                }}
              >
                {/* User message bubble */}
                {entry.userMessage && <UserBubble text={entry.userMessage} />}

                {/* Canvas in left gutter — outside the 680px column */}
                {showCanvas && (
                  <div style={{ position: 'absolute', left: -60, top: entry.userMessage ? 40 : 0 }}>
                    <SmallCanvas formation={currentFormation} isThinking={false} />
                  </div>
                )}

                {/* Artifact card — full column width */}
                {entry.element}
              </motion.div>
            );
          })}

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
