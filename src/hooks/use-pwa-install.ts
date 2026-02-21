import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type IosBrowser = 'safari' | 'chrome' | 'other' | null;

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [iosBrowser, setIosBrowser] = useState<IosBrowser>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsStandalone(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    if (ios) {
      setIsIos(true);
      if (/CriOS/i.test(ua)) {
        setIosBrowser('chrome');
      } else if (/FxiOS/i.test(ua)) {
        setIosBrowser('other');
      } else if (/Safari/i.test(ua)) {
        setIosBrowser('safari');
      } else {
        setIosBrowser('other');
      }
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const canInstall = !!deferredPrompt;

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
    return outcome === "accepted";
  }, [deferredPrompt]);

  return { canInstall, isIos, iosBrowser, isStandalone, triggerInstall };
}
