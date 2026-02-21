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
      style={{ width: size, height: size, position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
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

function ThreeDotsHorizontal({ pulse = false }: { pulse?: boolean }) {
  return (
    <div
      style={{
        width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
      }}
      className={pulse ? "animate-pulse" : ""}
    >
      <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "white" }} />
      <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "white" }} />
      <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "white" }} />
    </div>
  );
}

function MoreDotsIcon({ pulse = false }: { pulse?: boolean }) {
  return (
    <div
      style={{
        width: 36, height: 36, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
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
        display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
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

/* ── Safari steps (4 steps matching actual iOS Safari) ── */
function safariSteps(): Step[] {
  return [
    {
      instruction: "tap the three dots in the bottom right",
      illustration: (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          {/* Safari bottom toolbar */}
          <div
            style={{
              width: 280, padding: "8px 10px",
              border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4,
              display: "flex", alignItems: "center", gap: 8,
              backgroundColor: "rgba(255,255,255,0.03)",
            }}
          >
            {/* Back chevron */}
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round"><polyline points="12,4 6,10 12,16" /></svg>
            {/* Address bar pill */}
            <div style={{
              flex: 1, height: 28, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, color: "rgba(255,255,255,0.3)",
            }}>
              orchid.masudlewis.com
            </div>
            {/* Reload */}
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round">
              <path d="M17 10a7 7 0 1 1-2-5" /><polyline points="17,2 17,6 13,6" />
            </svg>
            {/* Three dots – highlighted */}
            <ThreeDotsHorizontal pulse />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", width: 280, paddingRight: 8 }}>
            <PulseArrow direction="up" />
          </div>
        </div>
      ),
    },
    {
      instruction: "tap 'Share' at the top",
      illustration: (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 240, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, overflow: "hidden" }}>
            {/* Share – highlighted */}
            <MenuRow icon={<ShareIcon size={18} pulse />} label="Share" highlight />
            <MenuRow icon={<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"><path d="M5 5v12h10V5l-3-3H8L5 5z" /></svg>} label="Add to Bookmarks" />
            <MenuRow icon={<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"><rect x="3" y="3" width="14" height="14" rx="2" /></svg>} label="Add Bookmark to..." />
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", margin: "2px 0" }} />
            <MenuRow icon={<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"><line x1="10" y1="4" x2="10" y2="16" /><line x1="4" y1="10" x2="16" y2="10" /></svg>} label="New Tab" />
            <MenuRow icon={<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"><path d="M6 4a4 4 0 0 1 8 0v2H6V4z" /><rect x="4" y="6" width="12" height="10" rx="1" /></svg>} label="New Private Tab" />
          </div>
          <PulseArrow direction="up" />
        </div>
      ),
    },
    {
      instruction: "tap 'More' with the three dots",
      illustration: (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", gap: 16, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4 }}>
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
          <MenuRow icon={<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"><polygon points="10,2 12.5,7 18,8 14,12 15,18 10,15 5,18 6,12 2,8 7.5,7" /></svg>} label="Add to Favorites" />
          <MenuRow icon={<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"><rect x="3" y="3" width="14" height="14" rx="2" /><line x1="7" y1="7" x2="13" y2="7" /><line x1="7" y1="10" x2="11" y2="10" /></svg>} label="Add to Quick Note" />
          <MenuRow icon={<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"><circle cx="10" cy="10" r="7" /><line x1="7" y1="10" x2="13" y2="10" /></svg>} label="Find on Page" />
          <MenuRow icon={<PlusSquareIcon />} label="Add to Home Screen" highlight />
        </div>
      ),
    },
  ];
}

/* ── Chrome steps (unchanged 3 steps) ── */
function chromeSteps(): Step[] {
  return [
    {
      instruction: "tap the share icon in the top bar",
      illustration: (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <div style={{
            width: 280, padding: "10px 12px",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4,
            display: "flex", alignItems: "center", gap: 8,
            backgroundColor: "rgba(255,255,255,0.03)",
          }}>
            <div style={{
              flex: 1, height: 30, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16,
              display: "flex", alignItems: "center", paddingLeft: 12, fontSize: 11, color: "rgba(255,255,255,0.3)",
            }}>
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
          <div style={{ display: "flex", gap: 16, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4 }}>
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
      style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.88)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          margin: "0 24px", maxWidth: 320, width: "100%",
          border: "1px solid rgba(255,255,255,0.12)", backgroundColor: "rgba(10,10,10,0.97)",
          padding: "28px 20px 20px", fontFamily: "ui-monospace, monospace", position: "relative",
        }}
      >
        <button onClick={onClose} style={{ position: "absolute", top: 10, right: 12, background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 16, cursor: "pointer", padding: 4, fontFamily: "ui-monospace, monospace" }}>✕</button>

        <div style={{ marginBottom: 6, opacity: 0.4, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "white" }}>install orchid</div>
        <div style={{ marginBottom: 20, fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em" }}>
          step {step + 1}/{steps.length} · {browser === "chrome" ? "chrome" : "safari"}
        </div>

        <div style={{ fontSize: 14, color: "white", lineHeight: 1.5, marginBottom: 24 }}>{current.instruction}</div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28, color: "white" }}>{current.illustration}</div>

        <button
          onClick={() => { if (isLast) onClose(); else setStep((s) => s + 1); }}
          style={{
            width: "100%", padding: "11px", border: "1px solid rgba(255,255,255,0.2)",
            backgroundColor: "transparent", color: "rgba(255,255,255,0.6)",
            fontFamily: "ui-monospace, monospace", fontSize: 11, textTransform: "uppercase",
            letterSpacing: "0.08em", cursor: "pointer",
          }}
        >
          {isLast ? "got it" : "next →"}
        </button>
      </div>
    </div>
  );
}
