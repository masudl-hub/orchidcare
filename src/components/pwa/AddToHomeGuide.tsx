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
    <div style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }} className={pulse ? "animate-pulse" : ""}>
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
    <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }} className={pulse ? "animate-pulse" : ""}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "white" }} />
      <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "white" }} />
      <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "white" }} />
    </div>
  );
}

function MoreDotsIcon({ pulse = false }: { pulse?: boolean }) {
  return (
    <div style={{ width: 36, height: 36, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }} className={pulse ? "animate-pulse" : ""}>
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

function MenuRow({ icon, label, highlight = false }: { icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "7px 12px",
        border: highlight ? "1px solid rgba(255,255,255,0.4)" : "1px solid rgba(255,255,255,0.08)",
        backgroundColor: highlight ? "rgba(255,255,255,0.06)" : "transparent",
      }}
      className={highlight ? "animate-pulse" : ""}
    >
      {icon}
      <span style={{ fontSize: 11, color: highlight ? "white" : "rgba(255,255,255,0.5)" }}>{label}</span>
    </div>
  );
}

/* ── Safari steps ── */
function safariSteps(): Step[] {
  return [
    {
      instruction: "tap the three dots in the bottom right",
      illustration: (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ width: 260, padding: "6px 8px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, display: "flex", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.03)" }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round"><polyline points="12,4 6,10 12,16" /></svg>
            <div style={{ flex: 1, height: 24, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "rgba(255,255,255,0.3)" }}>orchid.masudlewis.com</div>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round"><path d="M17 10a7 7 0 1 1-2-5" /><polyline points="17,2 17,6 13,6" /></svg>
            <ThreeDotsHorizontal pulse />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", width: 260, paddingRight: 4 }}><PulseArrow direction="up" /></div>
        </div>
      ),
    },
    {
      instruction: "tap 'Share' at the top",
      illustration: (
        <div style={{ width: 220, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, overflow: "hidden" }}>
          <MenuRow icon={<ShareIcon size={16} pulse />} label="Share" highlight />
          <MenuRow icon={<span style={{ fontSize: 12, opacity: 0.3 }}>🔖</span>} label="Add to Bookmarks" />
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", margin: "1px 0" }} />
          <MenuRow icon={<span style={{ fontSize: 12, opacity: 0.3 }}>+</span>} label="New Tab" />
        </div>
      ),
    },
    {
      instruction: "tap 'More' with the three dots",
      illustration: (
        <div style={{ display: "flex", gap: 12, padding: "8px 12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4 }}>
          {["📋", "📑", "📖"].map((icon, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: 0.3, minWidth: 36 }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ fontSize: 7 }}>{["Copy", "Bookmarks", "Reading"][i]}</span>
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 36 }}>
            <MoreDotsIcon pulse />
            <span style={{ fontSize: 7, color: "white" }}>More</span>
          </div>
        </div>
      ),
    },
    {
      instruction: "tap 'Add to Home Screen'",
      illustration: (
        <div style={{ display: "flex", flexDirection: "column", gap: 0, width: 220 }}>
          <MenuRow icon={<span style={{ fontSize: 12, opacity: 0.3 }}>⭐</span>} label="Add to Favorites" />
          <MenuRow icon={<span style={{ fontSize: 12, opacity: 0.3 }}>📝</span>} label="Add to Quick Note" />
          <MenuRow icon={<PlusSquareIcon />} label="Add to Home Screen" highlight />
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ width: 260, padding: "6px 8px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, display: "flex", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.03)" }}>
            <div style={{ flex: 1, height: 24, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, display: "flex", alignItems: "center", paddingLeft: 10, fontSize: 8, color: "rgba(255,255,255,0.3)" }}>orchidaicare.lovable.app</div>
            <ShareIcon size={20} pulse />
          </div>
          <PulseArrow direction="up" />
        </div>
      ),
    },
    {
      instruction: "tap 'More' with the three dots",
      illustration: (
        <div style={{ display: "flex", gap: 12, padding: "8px 12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4 }}>
          {["📋", "📑"].map((icon, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: 0.3, minWidth: 36 }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ fontSize: 7 }}>{["Copy", "Read Later"][i]}</span>
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 36 }}>
            <MoreDotsIcon pulse />
            <span style={{ fontSize: 7, color: "white" }}>More</span>
          </div>
        </div>
      ),
    },
    {
      instruction: "tap 'Add to Home Screen'",
      illustration: (
        <div style={{ display: "flex", flexDirection: "column", gap: 0, width: 220 }}>
          <MenuRow icon={<span style={{ fontSize: 12, opacity: 0.3 }}>🔖</span>} label="Add to Bookmarks" />
          <MenuRow icon={<PlusSquareIcon />} label="Add to Home Screen" highlight />
          <MenuRow icon={<span style={{ fontSize: 12, opacity: 0.3 }}>📋</span>} label="Copy Link" />
        </div>
      ),
    },
  ];
}

export function AddToHomeGuide({ browser, visible, onClose }: AddToHomeGuideProps) {
  if (!visible) return null;

  const steps = browser === "chrome" ? chromeSteps() : safariSteps();

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.88)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          margin: "0 24px", maxWidth: 320, width: "100%", maxHeight: "85vh", overflowY: "auto",
          border: "1px solid rgba(255,255,255,0.12)", backgroundColor: "rgba(10,10,10,0.97)",
          padding: "24px 18px 18px", fontFamily: "ui-monospace, monospace", position: "relative",
        }}
      >
        <button onClick={onClose} style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 16, cursor: "pointer", padding: 4, fontFamily: "ui-monospace, monospace" }}>✕</button>

        <div style={{ marginBottom: 20, opacity: 0.4, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "white" }}>
          install orchid · {browser === "chrome" ? "chrome" : "safari"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontVariantNumeric: "tabular-nums" }}>{i + 1}.</span>
                <span style={{ fontSize: 13, color: "white", lineHeight: 1.4 }}>{s.instruction}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "center", color: "white" }}>
                {s.illustration}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "11px", marginTop: 20,
            border: "1px solid rgba(255,255,255,0.2)", backgroundColor: "transparent",
            color: "rgba(255,255,255,0.6)", fontFamily: "ui-monospace, monospace",
            fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer",
          }}
        >
          got it
        </button>
      </div>
    </div>
  );
}
