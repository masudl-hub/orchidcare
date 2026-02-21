import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed as standalone
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Chrome/Android: capture beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari detection
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent);
    if (isIos && isSafari) {
      setShowIosHint(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
    setDismissed(true);
  };

  if (dismissed) return null;
  if (!deferredPrompt && !showIosHint) return null;

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
        {deferredPrompt ? (
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
        ) : showIosHint ? (
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
