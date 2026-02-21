import { PlantCarousel, plants } from "./plant-carousel";
import { useState, useCallback, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useIsTouch, useIsMobile } from "@/hooks/use-mobile";
import { TelegramFallback } from "./telegram-fallback";
import { usePwaInstall } from "@/hooks/use-pwa-install";

const purpleOrchidSrc =
  "/plant_assets_art/T_phalaenopsis_orchid/phalaenopsis_orchid_transparent.png";

// The purple orchid is at index 0 in the plants array
const PURPLE_ORCHID_INDEX = 0;

// Desktop canvas dimensions
const CANVAS_WIDTH_LG = 180;
const CANVAS_HEIGHT_LG = 280;
// Mobile canvas dimensions
const CANVAS_WIDTH_SM = 90;
const CANVAS_HEIGHT_SM = 140;

// De-pixelation steps — pixel widths from super blocky to full res
const PIXEL_STEPS = [3, 4, 6, 8, 12, 16, 24, 32, 48, 72, 100, 140, CANVAS_WIDTH_LG];

const DEEP_LINK = "https://t.me/orchidcare_bot?start=web";

type Phase = "depixelating" | "revealing" | "ready";

interface OrchidHeroProps {
  onStartClick?: () => void;
  onLoginClick?: () => void;
  onDemoClick?: () => void;
}

export function OrchidHero({ onStartClick, onLoginClick, onDemoClick }: OrchidHeroProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const fromApp = location.key !== 'default';

  const [activeIndex, setActiveIndex] = useState(PURPLE_ORCHID_INDEX);
  const [phase, setPhase] = useState<Phase>(fromApp ? "ready" : "depixelating");
  const [canvasFading, setCanvasFading] = useState(fromApp);
  const [loadingProgress, setLoadingProgress] = useState(fromApp ? 100 : 0);
  const scrollAccum = useRef(0);
  const lastStepTime = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [canvasReady, setCanvasReady] = useState(fromApp);

  const isTouch = useIsTouch();
  const isMobile = useIsMobile();
  const [showFallback, setShowFallback] = useState(false);
  const { canInstall, isIos, isStandalone, triggerInstall } = usePwaInstall();
  const [showIosHint, setShowIosHint] = useState(false);

  // Responsive dimensions
  const canvasW = isMobile ? CANVAS_WIDTH_SM : CANVAS_WIDTH_LG;
  const canvasH = isMobile ? CANVAS_HEIGHT_SM : CANVAS_HEIGHT_LG;

  // --- De-pixelation logic ---
  const drawAtResolution = useCallback((pixelWidth: number) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const aspectRatio = img.naturalHeight / img.naturalWidth;
    const pixelHeight = Math.round(pixelWidth * aspectRatio);

    const offscreen = document.createElement("canvas");
    offscreen.width = pixelWidth;
    offscreen.height = pixelHeight;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;

    offCtx.drawImage(img, 0, 0, pixelWidth, pixelHeight);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = pixelWidth >= CANVAS_WIDTH_LG;
    ctx.drawImage(offscreen, 0, 0, pixelWidth, pixelHeight, 0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    if (fromApp) return;

    let cancelled = false;

    const totalDuration = 2500;
    const stepCount = PIXEL_STEPS.length;

    // Weighted timing — linger on blocky, speed through clear
    const stepDurations: number[] = [];
    let totalWeight = 0;
    for (let i = 0; i < stepCount; i++) {
      const weight = stepCount - i;
      stepDurations.push(weight);
      totalWeight += weight;
    }
    for (let i = 0; i < stepCount; i++) {
      stepDurations[i] = (stepDurations[i] / totalWeight) * totalDuration;
    }

    let currentStep = 0;

    const scheduleNext = () => {
      if (cancelled) return;

      const progress = (currentStep / (stepCount - 1)) * 100;
      setLoadingProgress(progress);

      if (currentStep >= stepCount - 1) {
        requestAnimationFrame(() => {
          setLoadingProgress(100);
          setCanvasFading(true);
          setPhase("revealing");
          setTimeout(() => setPhase("ready"), 1200);
        });
        return;
      }

      setTimeout(() => {
        if (cancelled) return;
        currentStep++;
        drawAtResolution(PIXEL_STEPS[currentStep]);
        scheduleNext();
      }, stepDurations[currentStep]);
    };

    // --- Load the real image, then start de-pixelation from step 0 ---
    const fullImg = new Image();
    fullImg.crossOrigin = "anonymous";
    fullImg.onload = () => {
      if (cancelled) return;
      imgRef.current = fullImg;
      drawAtResolution(PIXEL_STEPS[0]);
      setCanvasReady(true);
      scheduleNext();
    };
    fullImg.onerror = () => {
      // If image fails, skip animation and go straight to ready
      if (cancelled) return;
      setCanvasFading(true);
      setPhase("ready");
      setLoadingProgress(100);
    };
    fullImg.src = purpleOrchidSrc;

    return () => { cancelled = true; };
  }, [drawAtResolution, fromApp]);

  // --- Wheel handler (desktop only) ---
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      if (phase !== "ready") return;

      const raw = e.deltaMode === 1 ? e.deltaY * 20
                : e.deltaMode === 2 ? e.deltaY * 400
                : e.deltaY;

      scrollAccum.current += raw;

      const THRESHOLD = 140;
      const MIN_INTERVAL = 250;

      const now = Date.now();
      if (
        Math.abs(scrollAccum.current) >= THRESHOLD &&
        now - lastStepTime.current >= MIN_INTERVAL
      ) {
        const dir = scrollAccum.current > 0 ? 1 : -1;
        scrollAccum.current = 0;
        lastStepTime.current = now;
        setActiveIndex((i) => (i + dir + plants.length) % plants.length);
      }
    },
    [phase]
  );

  // Only attach wheel on non-touch devices
  useEffect(() => {
    const el = containerRef.current;
    if (!el || isTouch) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel, isTouch]);

  // --- Touch swipe handler (mobile) ---
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isTouch) return;

    const onTouchStart = (e: TouchEvent) => {
      if (phase !== "ready") return;
      touchStartY.current = e.touches[0].clientY;
      touchStartTime.current = Date.now();
    };

    const onTouchMove = (e: TouchEvent) => {
      // Block page scroll while on the hero
      e.preventDefault();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (phase !== "ready" || touchStartY.current === null) return;
      const deltaY = touchStartY.current - e.changedTouches[0].clientY;
      const elapsed = Date.now() - touchStartTime.current;
      touchStartY.current = null;

      // Require minimum 40px swipe within 500ms
      if (Math.abs(deltaY) > 40 && elapsed < 500) {
        const dir = deltaY > 0 ? 1 : -1;
        setActiveIndex((i) => (i + dir + plants.length) % plants.length);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [isTouch, phase]);

  // --- Carousel click handler ---
  const handleCarouselClick = useCallback(() => {
    if (phase !== "ready") return;

    const plant = plants[activeIndex] as any;

    if (plant.action === "start") {
      if (isTouch) {
        const start = Date.now();
        const handleVisibility = () => {
          if (document.hidden) {
            clearTimeout(timer);
            document.removeEventListener("visibilitychange", handleVisibility);
          }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        window.location.href = DEEP_LINK;
        const timer = setTimeout(() => {
          document.removeEventListener("visibilitychange", handleVisibility);
          if (!document.hidden && Date.now() - start >= 1800) setShowFallback(true);
        }, 2000);
      } else {
        onStartClick?.();
      }
      return;
    }

    navigate(plant.route);
  }, [phase, activeIndex, isTouch, navigate, onStartClick]);

  const isRevealing = phase === "revealing" || phase === "ready";

  const revealClass = (delayMs: number) =>
    isRevealing
      ? "translate-y-0 transition-all duration-700 ease-out"
      : "translate-y-2";

  const revealStyle = (delayMs: number) => ({
    opacity: isRevealing ? 1 : 0,
    transitionDelay: isRevealing ? `${delayMs}ms` : "0ms",
  });

  return (
    <div
      ref={containerRef}
      className="h-screen w-full bg-white flex items-center justify-center overflow-hidden"
    >
      {/* Top bar - starts as loading progress, becomes permanent black bar */}
      <div
        className="absolute top-0 left-0 h-2 bg-black transition-all duration-300 ease-out"
        style={{
          width: phase === "depixelating" ? `${loadingProgress}%` : "100%",
        }}
      />

      {/* Noise grain overlay */}
      <div
        className={`absolute inset-0 pointer-events-none ${
          isRevealing ? "transition-opacity duration-1000 ease-out" : ""
        }`}
        style={{
          opacity: isRevealing ? 0.04 : 0,
          transitionDelay: isRevealing ? "300ms" : "0ms",
        }}
      >
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </div>

      {/* Main content container */}
      <div className="relative px-8 md:px-16 pt-[24px]">
        {/* Spacer where tagline used to be — keeps ORCHID positioning */}

        {/* ORCHID text */}
        <div
          className="relative text-[48px] sm:text-[80px] md:text-[120px] lg:text-[160px] leading-none tracking-tight flex items-end"
          style={{ fontFamily: '"Press Start 2P", cursive' }}
        >
          {/* ORCH */}
          <span
            className={revealClass(100)}
            style={revealStyle(100)}
          >
            ORCH
          </span>

          {/* Carousel / Canvas slot */}
          <div
            className="inline-flex items-end mx-[-12px] sm:mx-[-20px] md:mx-[-30px] lg:mx-[-40px] mb-[-2px] md:mb-[-4px] relative z-10"
          >
            {/* Annotation callout — hidden on mobile */}
            <div
              className={`absolute z-30 pointer-events-none ${
                isRevealing ? "translate-y-0" : "translate-y-2"
              }`}
              style={{
                top: 8,
                right: "100%",
                marginRight: -6,
                opacity: isRevealing && (plants[activeIndex] as any)?.label ? 1 : 0,
                transition: isRevealing
                  ? "opacity 300ms ease-out 350ms, transform 700ms ease-out 350ms"
                  : "opacity 300ms ease-out, transform 700ms ease-out",
              }}
            >
              <div className="relative" style={{ width: 130, height: 36 }}>
                <svg
                  width="130"
                  height="36"
                  viewBox="0 0 130 36"
                  fill="none"
                  className="absolute top-0 left-0"
                >
                  <path
                    d="M 2,12 L 98,12 L 128,34"
                    stroke="black"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="absolute" style={{ left: 0, top: -6 }}>
                  {plants.map((plant, i) => {
                    const p = plant as any;
                    if (!p.label) return null;
                    const labelStyle = {
                      display: i === activeIndex ? "inline-block" : "none",
                      whiteSpace: "nowrap" as const,
                      fontFamily: "ui-monospace, monospace",
                      fontSize: "13px",
                      lineHeight: "1.2",
                      letterSpacing: "normal",
                    };
                    if (p.action === "start") {
                      return (
                        <button
                          key={i}
                          onClick={onStartClick}
                          className="absolute left-0 top-0 pointer-events-auto cursor-pointer hover:underline"
                          style={{ ...labelStyle, background: "none", border: "none", padding: 0, color: "inherit" }}
                        >
                          {p.label}
                        </button>
                      );
                    }
                    return (
                      <Link
                        to={p.route}
                        key={p.route}
                        className="absolute left-0 top-0 pointer-events-auto cursor-pointer hover:underline"
                        style={labelStyle}
                      >
                        {p.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Real carousel */}
            <div
              style={{
                opacity: canvasFading ? 1 : 0,
                transition: "opacity 500ms ease-out",
                cursor: phase === "ready" ? "pointer" : "default",
              }}
              onClick={handleCarouselClick}
            >
              <PlantCarousel activeIndex={activeIndex} width={canvasW} height={canvasH} />
            </div>

            {/* De-pixelating canvas */}
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH_LG}
              height={CANVAS_HEIGHT_LG}
              className={`absolute inset-0 z-20 transition-opacity duration-500 ease-out ${
                canvasFading ? "opacity-0 pointer-events-none" : ""
              }`}
              style={{
                ...{
                  width: canvasW,
                  height: canvasH,
                  imageRendering: "pixelated" as const,
                  cursor: phase === "ready" ? "pointer" : "default",
                },
                opacity: canvasFading ? 0 : canvasReady ? 1 : 0,
              }}
              onClick={handleCarouselClick}
            />

          </div>

          {/* D */}
          <span
            className={revealClass(100)}
            style={revealStyle(100)}
          >
            D
          </span>

        </div>

        {/* Navigation links */}
        <div
          className={`mt-5 font-mono text-[16px] sm:text-[18px] md:text-[22px] space-y-2 ${revealClass(250)}`}
          style={revealStyle(250)}
        >
          <div
            className="cursor-pointer hover:underline"
            onClick={onStartClick}
          >/start</div>
          <div
            className="cursor-pointer hover:underline"
            onClick={onDemoClick}
          >/get-demo</div>
          <div className="cursor-pointer hover:underline" onClick={onLoginClick}>/login</div>
          {!isStandalone && (
            <div
              className="cursor-pointer hover:underline md:hidden"
              onClick={() => {
                if (canInstall) {
                  triggerInstall();
                } else if (isIos) {
                  setShowIosHint(true);
                } else {
                  setShowIosHint(true); // fallback: show generic hint
                }
              }}
            >/add-to-home</div>
          )}
        </div>

      </div>

      {/* Tagline — bottom center of viewport */}
      <div
        className={`absolute bottom-6 left-0 right-0 text-center z-20 font-mono text-[13px] md:text-[16px] ${revealClass(0)}`}
        style={{ ...revealStyle(0), color: 'rgba(0,0,0,0.35)' }}
      >
        plant care made easy
      </div>

      {/* Telegram fallback overlay — mobile only */}
      <TelegramFallback
        visible={showFallback}
        onClose={() => setShowFallback(false)}
        onWebSignup={() => {
          setShowFallback(false);
          onStartClick?.();
        }}
      />

      {/* iOS / fallback install hint overlay — outside overflow-hidden container */}
      {showIosHint && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
          onClick={() => setShowIosHint(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mx-6 max-w-xs"
            style={{
              border: "1px solid rgba(255,255,255,0.15)",
              backgroundColor: "rgba(10,10,10,0.97)",
              padding: "24px 20px",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            <div style={{ fontSize: 13, color: "white", lineHeight: 1.6, letterSpacing: "0.03em" }}>
              {isIos ? (
                <>
                  <div style={{ marginBottom: 12, opacity: 0.5, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>install orchid</div>
                  <div>1. tap the <span style={{ display: "inline-block", border: "1px solid rgba(255,255,255,0.3)", padding: "1px 6px", margin: "0 2px" }}>⬆</span> share button</div>
                  <div style={{ marginTop: 8 }}>2. scroll down and tap</div>
                  <div style={{ marginTop: 4, padding: "6px 10px", border: "1px solid rgba(255,255,255,0.2)", display: "inline-block" }}>Add to Home Screen</div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 12, opacity: 0.5, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>install orchid</div>
                  <div>open your browser menu (⋮) and tap</div>
                  <div style={{ marginTop: 8, padding: "6px 10px", border: "1px solid rgba(255,255,255,0.2)", display: "inline-block" }}>Add to Home Screen</div>
                </>
              )}
            </div>
            <button
              onClick={() => setShowIosHint(false)}
              style={{
                marginTop: 20,
                width: "100%",
                padding: "10px",
                border: "1px solid rgba(255,255,255,0.2)",
                backgroundColor: "transparent",
                color: "rgba(255,255,255,0.5)",
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
              }}
            >
              got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
