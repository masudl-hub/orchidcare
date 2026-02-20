import { PlantCarousel, plants } from "./plant-carousel";
import { useState, useCallback, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useIsTouch, useIsMobile } from "@/hooks/use-mobile";
import { TelegramFallback } from "./telegram-fallback";

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

    // Skip straight to revealed state if image fails
    const skipToReady = () => {
      setLoadingProgress(100);
      setCanvasFading(true);
      setPhase("revealing");
      setTimeout(() => setPhase("ready"), 400);
    };

    // Load image and run de-pixelation
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onerror = skipToReady;
    img.onload = () => {
      imgRef.current = img;

      // Draw first frame
      drawAtResolution(PIXEL_STEPS[0]);
      setCanvasReady(true);

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
        // Update loading progress
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
          currentStep++;
          drawAtResolution(PIXEL_STEPS[currentStep]);
          scheduleNext();
        }, stepDurations[currentStep]);
      };

      scheduleNext();
    };
    img.src = purpleOrchidSrc;
  }, [drawAtResolution, fromApp]);

  // --- Wheel handler ---
  // Must be attached via ref with { passive: false } so preventDefault() works.
  // React's onWheel is passive and cannot prevent default scrolling.
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      if (phase !== "ready") return;

      // Normalise across pixel / line / page delta modes
      const raw = e.deltaMode === 1 ? e.deltaY * 20
                : e.deltaMode === 2 ? e.deltaY * 400
                : e.deltaY;

      scrollAccum.current += raw;

      const THRESHOLD = 140;    // px of accumulated delta per step
      const MIN_INTERVAL = 250; // ms minimum between steps

      const now = Date.now();
      if (
        Math.abs(scrollAccum.current) >= THRESHOLD &&
        now - lastStepTime.current >= MIN_INTERVAL
      ) {
        const dir = scrollAccum.current > 0 ? 1 : -1;
        scrollAccum.current = 0; // reset so bursts don't queue multiple steps
        lastStepTime.current = now;
        setActiveIndex((i) => (i + dir + plants.length) % plants.length);
      }
    },
    [phase]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // --- Carousel click handler — navigates to the active plant's route ---
  const handleCarouselClick = useCallback(() => {
    if (phase !== "ready") return;

    const plant = plants[activeIndex] as any;

    if (plant.action === "start") {
      if (isTouch) {
        // Mobile: try Telegram deep link, fall back to web signup
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

  // Staggered reveal helpers
  // Opacity is controlled via inline style (not Tailwind class) to prevent FOUC on cold page load.
  // Tailwind classes can flash briefly before CSS is processed; inline styles are immediate.
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
      className="min-h-screen w-full bg-white flex items-center justify-center overflow-hidden"
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
        {/* Tagline */}
        <div
          className={`font-mono text-sm mb-[-40px] md:mb-[-100px] ${revealClass(0)}`}
          style={{ ...revealStyle(0), fontSize: "16px" }}
        >
          plant care made easy
        </div>

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
            {/* Annotation callout — anchored top-left of carousel, extends left */}
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
                  {/* Horizontal line from text, then diagonal kick down-right toward carousel */}
                  <path
                    d="M 2,12 L 98,12 L 128,34"
                    stroke="black"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {/* Route labels — left-aligned above the line, one at a time */}
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

            {/* Real carousel — always rendered for pre-loading, but invisible until canvas fades */}
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

            {/* De-pixelating canvas — overlays the carousel, fades out when done */}
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
        </div>
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
    </div>
  );
}
