import { motion, AnimatePresence } from 'framer-motion';
import { usePwaInstall } from '@/hooks/use-pwa-install';
import { useState } from 'react';

export function InstallPrompt() {
  const { canInstall, isIos, isStandalone, triggerInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || isStandalone) return null;
  if (!canInstall && !isIos) return null;

  const handleInstall = async () => {
    await triggerInstall();
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{
          padding: '12px 16px',
          border: '1px solid rgba(255,255,255,0.15)',
          backgroundColor: 'rgba(255,255,255,0.03)',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        {canInstall ? (
          <>
            <span>Install Orchid for quick access</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleInstall}
                style={{
                  padding: '4px 12px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  backgroundColor: 'white',
                  color: 'black',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '10px',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                Install
              </button>
              <button
                onClick={() => setDismissed(true)}
                style={{
                  padding: '4px 8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'rgba(255,255,255,0.4)',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          </>
        ) : isIos ? (
          <>
            <span>
              Tap{' '}
              <span style={{ fontSize: '14px', verticalAlign: 'middle' }}>⬆</span>{' '}
              Share then "Add to Home Screen"
            </span>
            <button
              onClick={() => setDismissed(true)}
              style={{
                padding: '4px 8px',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'rgba(255,255,255,0.4)',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}
