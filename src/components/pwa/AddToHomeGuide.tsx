import { useState } from "react";
import type { IosBrowser } from "@/hooks/use-pwa-install";

interface AddToHomeGuideProps {
  browser: IosBrowser;
  visible: boolean;
  onClose: () => void;
}

interface Step {
  instruction: string;
  illustration: React.ReactNode;
}

/* ── CSS icon primitives ── */

function ShareIcon({ size = 28, pulse = false }: { size?: number; pulse?: boolean }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      className={pulse ? "animate-pulse" : ""}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="9" width="14" height="13" rx="2" />
        <polyline points="9,5 12,2 15,5" />
        <line x1="12" y1="2" x2="12" y2="14" />
      </svg>
    </div>
  );
}

function MoreDotsIcon({ pulse = false }: { pulse?: boolean }) {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        border: "1.5px solid rgba(255,255,255,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
      }}
      className={pulse ? "animate-pulse" : ""}
    >
      <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "white" }} />
      <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "white" }} />
      <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "white" }} />
    </div>
  );
}

function PlusSquareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function PulseArrow({ direction }: { direction: "up" | "down" | "right" }) {
  const rotation = direction === "up" ? "rotate(180deg)" : direction === "right" ? "rotate(-90deg)" : "rotate(0deg)";
  return (
    <div className="animate-bounce" style={{ transform: rotation, display: "inline-flex" }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round">
        <line x1="10" y1="4" x2="10" y2="16" />
        <polyline points="5,11 10,16 15,11" />
      </svg>
    </div>
  );
}

/* ── Menu row item ── */
function MenuRow({ icon, label, highlight = false }: { icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        border: highlight ? "1px solid rgba(255,255,255,0.4)" : "1px solid rgba(255,255,255,0.08)",
        backgroundColor: highlight ? "rgba(255,255,255,0.06)" : "transparent",
      }}
      className={highlight ? "animate-pulse" : ""}
    >
      {icon}
      <span style={{ fontSize: 13, color: highlight ? "white" : "rgba(255,255,255,0.5)" }}>{label}</span>
    </div>
  );
}

/* ── Safari steps ── */
function safariSteps(): Step[] {
  return [
    {
      instruction: "tap the share button in the bottom toolbar",
      illustration: (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          {/* Simplified Safari bottom bar */}
          <div
            style={{
              width: 260,
              padding: "12px 0",
              border: "1px solid rgba(255,255,255,0.12)",
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.03)",
              borderRadius: 4,
            }}
          >
            <div style={{ width: 24, height: 24, opacity: 0.2, border: "1px solid white", borderRadius: 3 }} />
            <div style={{ width: 24, height: 24, opacity: 0.2, border: "1px solid white", borderRadius: 3 }} />
            <ShareIcon size={26} pulse />
            <div style={{ width: 24, height: 24, opacity: 0.2, border: "1px solid white", borderRadius: 3 }} />
            <div style={{ width: 24, height: 24, opacity: 0.2, border: "1px solid white", borderRadius: 3 }} />
          </div>
          <PulseArrow direction="up" />
        </div>
      ),
    },
    {
      instruction: "scroll right and tap 'More'",
      illustration: (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          {/* Share sheet action row */}
          <div
            style={{
              display: "flex",
              gap: 16,
              padding: "12px 16px",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            {[
              { icon: "📋", label: "Copy" },
              { icon: "📑", label: "Bookmarks" },
              { icon: "📖", label: "Reading List" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.35, minWidth: 48 }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontSize: 9, whiteSpace: "nowrap" }}>{item.label}</span>
              </div>
            ))}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 48 }}>
              <MoreDotsIcon pulse />
              <span style={{ fontSize: 9, color: "white" }}>More</span>
            </div>
          </div>
          <PulseArrow direction="up" />
        </div>
      ),
    },
    {
      instruction: "tap 'Add to Home Screen'",
      illustration: (
        <div style={{ display: "flex", flexDirection: "column", gap: 0, width: 240 }}>
          <MenuRow icon={<div style={{ opacity: 0.3, fontSize: 16 }}>📌</div>} label="Add to Favorites" />
          <MenuRow icon={<PlusSquareIcon />} label="Add to Home Screen" highlight />
          <MenuRow icon={<div style={{ opacity: 0.3, fontSize: 16 }}>📋</div>} label="Copy" />
        </div>
      ),
    },
  ];
}

/* ── Chrome steps ── */
function chromeSteps(): Step[] {
  return [
    {
      instruction: "tap the share icon in the top bar",
      illustration: (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          {/* Simplified Chrome top bar */}
          <div
            style={{
              width: 280,
              padding: "10px 12px",
              border: "1px solid rgba(255,255,255,0.12)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: "rgba(255,255,255,0.03)",
              borderRadius: 4,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 30,
                backgroundColor: "rgba(255,255,255,0.06)",
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                paddingLeft: 12,
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
              }}
            >
              orchidaicare.lovable.app
            </div>
            <ShareIcon size={24} pulse />
          </div>
          <PulseArrow direction="up" />
        </div>
      ),
    },
    {
      instruction: "tap 'More' with the three dots",
      illustration: (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              gap: 16,
              padding: "12px 16px",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 4,
            }}
          >
            {[
              { icon: "📋", label: "Copy" },
              { icon: "📑", label: "Read Later" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.35, minWidth: 48 }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontSize: 9, whiteSpace: "nowrap" }}>{item.label}</span>
              </div>
            ))}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 48 }}>
              <MoreDotsIcon pulse />
              <span style={{ fontSize: 9, color: "white" }}>More</span>
            </div>
          </div>
          <PulseArrow direction="up" />
        </div>
      ),
    },
    {
      instruction: "tap 'Add to Home Screen'",
      illustration: (
        <div style={{ display: "flex", flexDirection: "column", gap: 0, width: 240 }}>
          <MenuRow icon={<div style={{ opacity: 0.3, fontSize: 16 }}>🔖</div>} label="Add to Bookmarks" />
          <MenuRow icon={<PlusSquareIcon />} label="Add to Home Screen" highlight />
          <MenuRow icon={<div style={{ opacity: 0.3, fontSize: 16 }}>📋</div>} label="Copy Link" />
        </div>
      ),
    },
  ];
}

export function AddToHomeGuide({ browser, visible, onClose }: AddToHomeGuideProps) {
  const [step, setStep] = useState(0);

  if (!visible) return null;

  const steps = browser === "chrome" ? chromeSteps() : safariSteps();
  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.88)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          margin: "0 24px",
          maxWidth: 320,
          width: "100%",
          border: "1px solid rgba(255,255,255,0.12)",
          backgroundColor: "rgba(10,10,10,0.97)",
          padding: "28px 20px 20px",
          fontFamily: "ui-monospace, monospace",
          position: "relative",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 10,
            right: 12,
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.3)",
            fontSize: 16,
            cursor: "pointer",
            padding: 4,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          ✕
        </button>

        {/* Header */}
        <div style={{ marginBottom: 6, opacity: 0.4, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "white" }}>
          install orchid
        </div>

        {/* Step counter */}
        <div style={{ marginBottom: 20, fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em" }}>
          step {step + 1}/{steps.length} · {browser === "chrome" ? "chrome" : "safari"}
        </div>

        {/* Instruction */}
        <div style={{ fontSize: 14, color: "white", lineHeight: 1.5, marginBottom: 24 }}>
          {current.instruction}
        </div>

        {/* Illustration */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28, color: "white" }}>
          {current.illustration}
        </div>

        {/* Next / Got it button */}
        <button
          onClick={() => {
            if (isLast) {
              onClose();
            } else {
              setStep((s) => s + 1);
            }
          }}
          style={{
            width: "100%",
            padding: "11px",
            border: "1px solid rgba(255,255,255,0.2)",
            backgroundColor: "transparent",
            color: "rgba(255,255,255,0.6)",
            fontFamily: "ui-monospace, monospace",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            cursor: "pointer",
          }}
        >
          {isLast ? "got it" : "next →"}
        </button>
      </div>
    </div>
  );
}
