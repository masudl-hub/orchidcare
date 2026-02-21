import { useState, useEffect, useRef, useCallback } from "react";
import { BackButton } from "@/components/ui/back-button";
import { QROrchid } from "./qr-orchid";
import { IdentifyFeature } from "./identify-feature";
import { DiagnosisFeature } from "./diagnosis-feature";
import { MemoryFeature } from "./memory-feature";
import { ProactiveFeature } from "./proactive-feature";
import { ShoppingFeature } from "./shopping-feature";
import { GuidesFeature } from "./guides-feature";
import { LiveFeature } from "./live-feature";
import { CTAFeature } from "./cta-feature";

// Block density steps: solid → coarse → fine → resolved letter
// Mirrors the hero's canvas de-pixelation (blocky → sharp)
const DENSITY_STEPS = ["█", "▓", "▒", "░"];

const TARGET_TEXT =
  "Orchid is a plant intelligence, accessible through Telegram. Identify species on sight. Diagnose from a photo. Go live when it gets serious. A living memory of your garden that nudges you before anything goes wrong.";

// Timing constants
const SLIDE_DURATION = 600;
const PAUSE_AFTER_SLIDE = 300;
const SCRAMBLE_DURATION = 600;
const PAUSE_BEFORE_DECRYPT = 200;
const CHARS_PER_SECOND = 80;
const CYCLE_INTERVAL = 35;

type Phase = "sliding" | "scrambling" | "decrypting" | "done";

function densityChar(cycleCount: number): string {
  // Map cycle count to density step: 0→█, 1→▓, 2→▒, 3→░, 4+→resolved
  const idx = Math.min(cycleCount, DENSITY_STEPS.length - 1);
  return DENSITY_STEPS[idx];
}

interface StartPageProps {
  visible: boolean;
  onClose?: () => void;
}

export function StartPage({ visible, onClose }: StartPageProps) {
  const [phase, setPhase] = useState<Phase>("sliding");
  const [startText, setStartText] = useState("/start");
  const [startOpacity, setStartOpacity] = useState(1);
  const [displayText, setDisplayText] = useState("");
  const [showArrow, setShowArrow] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const resolvedRef = useRef(0);
  const cycleCountRef = useRef<number[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const identifySectionRef = useRef<HTMLDivElement>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  // Phase machine
  useEffect(() => {
    if (!visible) return;
    cleanup();

    if (phase === "sliding") {
      timerRef.current = setTimeout(() => {
        setPhase("scrambling");
      }, SLIDE_DURATION + PAUSE_AFTER_SLIDE);
    }

    if (phase === "scrambling") {
      // "/start" characters dissolve through density steps
      let elapsed = 0;
      const step = 50;
      intervalRef.current = setInterval(() => {
        elapsed += step;
        if (elapsed >= SCRAMBLE_DURATION) {
          clearInterval(intervalRef.current!);
          setStartOpacity(0);
          timerRef.current = setTimeout(() => {
            setPhase("decrypting");
          }, PAUSE_BEFORE_DECRYPT + 300);
          return;
        }
        // Each char progresses through density steps based on time + position offset
        const progress = elapsed / SCRAMBLE_DURATION;
        const src = "/start";
        let result = "";
        for (let i = 0; i < src.length; i++) {
          const charProgress = progress + (i / src.length) * 0.3;
          if (charProgress > 1) {
            result += "░";
          } else if (charProgress > 0.75) {
            result += "░";
          } else if (charProgress > 0.5) {
            result += "▒";
          } else if (charProgress > 0.25) {
            result += "▓";
          } else {
            result += src[i];
          }
        }
        setStartText(result);
      }, step);
    }

    if (phase === "decrypting") {
      cycleCountRef.current = new Array(TARGET_TEXT.length).fill(0);
      resolvedRef.current = 0;

      const msPerChar = 1000 / CHARS_PER_SECOND;
      let lastAdvance = Date.now();

      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const resolved = resolvedRef.current;

        // Advance cursor
        if (now - lastAdvance >= msPerChar && resolved < TARGET_TEXT.length) {
          resolvedRef.current++;
          lastAdvance = now;
        }

        let result = "";
        const currentResolved = resolvedRef.current;

        for (let i = 0; i < TARGET_TEXT.length; i++) {
          if (TARGET_TEXT[i] === " ") {
            // Spaces always pass through
            result += " ";
            if (i < currentResolved)
              cycleCountRef.current[i] = DENSITY_STEPS.length + 1;
            continue;
          }

          if (i < currentResolved) {
            // Past the cursor — step through density levels then resolve
            cycleCountRef.current[i]++;
            if (cycleCountRef.current[i] > DENSITY_STEPS.length) {
              result += TARGET_TEXT[i];
            } else {
              result += densityChar(cycleCountRef.current[i] - 1);
            }
          } else if (i < currentResolved + 3) {
            // Active leading edge — solid blocks
            result += "█";
          } else {
            // Not yet reached
            result += "\u00A0";
          }
        }

        setDisplayText(result);

        // Check completion
        if (currentResolved >= TARGET_TEXT.length) {
          const allDone = cycleCountRef.current.every(
            (c) => c > DENSITY_STEPS.length
          );
          if (allDone) {
            clearInterval(intervalRef.current!);
            setDisplayText(TARGET_TEXT);
            setPhase("done");
            setTimeout(() => setShowQR(true), 600);
            setTimeout(() => setShowArrow(true), 800);
          }
        }
      }, CYCLE_INTERVAL);
    }

    return cleanup;
  }, [phase, visible, cleanup]);

  // Reset when becoming visible
  useEffect(() => {
    if (visible) {
      setPhase("sliding");
      setStartText("/start");
      setStartOpacity(1);
      setDisplayText("");
      setShowArrow(false);
      setShowQR(false);
      setScrollProgress(0);
      // Reset scroll position
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [visible]);

  // Track scroll progress for the progress bar
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const scrollTop = scrollContainer.scrollTop;
      const scrollHeight = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
      setScrollProgress(Math.min(progress, 1)); // Clamp between 0 and 1
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  const handleContinue = () => {
    identifySectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      style={{
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition: `transform ${SLIDE_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      }}
    >
      {/* Grain overlay — light noise on dark, stays fixed over scroll */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04] mix-blend-screen z-40">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <filter id="grain-dark">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-dark)" />
        </svg>
      </div>

      {/* Top white bar — progress based on scroll position */}
      <div
        className="absolute top-0 left-0 h-2 bg-white z-30 transition-all duration-150"
        style={{
          width: `${scrollProgress * 100}%`,
        }}
      />

      {/* Back button — stays fixed */}
      <BackButton onClick={onClose} />

      {/* Scrollable content with snap */}
      <div
        ref={scrollContainerRef}
        className="size-full overflow-y-auto"
        style={{
          scrollSnapType: "y mandatory",
          scrollBehavior: "smooth",
          scrollbarWidth: "none",
        }}
      >
        {/* ─── Section 1: Decrypt intro ─── */}
        <section
          className="relative min-h-screen w-full flex items-center justify-center px-8 md:px-16"
          style={{ scrollSnapAlign: "start" }}
        >
          <div style={{ maxWidth: 520, width: "100%" }}>
            {/* /start text — dissolves through density steps then fades */}
            <div
              className="transition-opacity duration-300 ease-out"
              style={{
                opacity:
                  phase === "sliding" || phase === "scrambling"
                    ? startOpacity
                    : 0,
                position:
                  phase === "decrypting" || phase === "done"
                    ? "absolute"
                    : "relative",
                pointerEvents: "none",
                fontFamily: '"Press Start 2P", cursive',
                fontSize: "clamp(14px, 4vw, 22px)",
                color: "white",
                height:
                  phase === "decrypting" || phase === "done" ? 0 : "auto",
              }}
            >
              {startText}
            </div>

            {/* Decrypted paragraph */}
            <div
              className="transition-opacity duration-500 ease-out"
              style={{
                opacity: phase === "decrypting" || phase === "done" ? 1 : 0,
                fontFamily: "ui-monospace, monospace",
                fontSize: "clamp(14px, 3.5vw, 18px)",
                lineHeight: "1.7",
                color: "white",
                letterSpacing: "0.01em",
              }}
            >
              {displayText || "\u00A0"}
            </div>

            {/* Orchid pixel art — appears after text resolves */}
            <div className="mt-10">
              <QROrchid visible={showQR} />
            </div>

            {/* Developer platform link — appears with QR */}
            <div
              className="mt-4 cursor-pointer hover:underline transition-opacity duration-700 ease-out"
              onClick={() => window.location.href = "/developer"}
              style={{
                opacity: showQR ? 0.4 : 0,
                fontFamily: "ui-monospace, monospace",
                fontSize: "12px",
                color: "white",
                pointerEvents: showQR ? "auto" : "none",
              }}
            >
              or continue on developer platform
            </div>
          </div>

          {/* Down arrow / continue prompt — pinned to bottom of this section */}
          <button
            onClick={handleContinue}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 transition-opacity duration-700 ease-out cursor-pointer"
            style={{
              opacity: showArrow ? 0.4 : 0,
              fontFamily: "ui-monospace, monospace",
              fontSize: "14px",
              color: "white",
              background: "none",
              border: "none",
              pointerEvents: showArrow ? "auto" : "none",
            }}
          >
            <div className="flex flex-col items-center gap-2 hover:opacity-100 transition-opacity duration-200">
              <span>continue</span>
              <span className="text-[20px]">&darr;</span>
            </div>
          </button>
        </section>

        {/* ─── Section 2: Instant Identification feature ─── */}
        <div ref={identifySectionRef} style={{ scrollSnapAlign: "start" }}>
          <IdentifyFeature scrollRoot={scrollContainerRef} />
        </div>

        {/* ─── Section 3: Diagnosis feature ─── */}
        <div style={{ scrollSnapAlign: "start" }}>
          <DiagnosisFeature scrollRoot={scrollContainerRef} />
        </div>

        {/* ─── Section 4: Memory feature ─── */}
        <div style={{ scrollSnapAlign: "start" }}>
          <MemoryFeature scrollRoot={scrollContainerRef} />
        </div>

        {/* ─── Section 5: Proactive Intelligence ─── */}
        <div style={{ scrollSnapAlign: "start" }}>
          <ProactiveFeature scrollRoot={scrollContainerRef} />
        </div>

        {/* ─── Section 6: Local Shopping ─── */}
        <div style={{ scrollSnapAlign: "start" }}>
          <ShoppingFeature scrollRoot={scrollContainerRef} />
        </div>

        {/* ─── Section 7: Visual Guides ─── */}
        <div style={{ scrollSnapAlign: "start" }}>
          <GuidesFeature scrollRoot={scrollContainerRef} />
        </div>

        {/* ─── Section 7b: Live Calls ─── */}
        <div style={{ scrollSnapAlign: "start" }}>
          <LiveFeature scrollRoot={scrollContainerRef} />
        </div>

        {/* ─── Section 8: Call to Action ─── */}
        <div style={{ scrollSnapAlign: "start" }}>
          <CTAFeature scrollRoot={scrollContainerRef} />
        </div>
      </div>
    </div>
  );
}
