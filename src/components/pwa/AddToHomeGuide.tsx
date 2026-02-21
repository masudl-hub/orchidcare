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

/* ── SVG icon primitives ── */

function ShareIcon({ dim = false }: { dim?: boolean }) {
  const c = dim ? "rgba(255,255,255,0.3)" : "white";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="9" width="14" height="13" rx="2" />
      <polyline points="9,5 12,2 15,5" />
      <line x1="12" y1="2" x2="12" y2="14" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4V4z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12,2 15,9 22,9.5 17,14.5 18.5,22 12,18 5.5,22 7,14.5 2,9.5 9,9" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="13" y2="12" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 4H6a2 2 0 0 0-2 2v10" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h4a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H4V4z" />
      <path d="M20 4h-4a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h5V4z" />
    </svg>
  );
}

function ThreeDotsHorizontal({ highlight = false }: { highlight?: boolean }) {
  const c = highlight ? "white" : "rgba(255,255,255,0.3)";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: c }} />
      <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: c }} />
      <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: c }} />
    </div>
  );
}

function MoreDotsCircle({ highlight = false }: { highlight?: boolean }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      border: highlight ? "1.5px solid rgba(255,255,255,0.5)" : "1.5px solid rgba(255,255,255,0.15)",
      backgroundColor: highlight ? "rgba(255,255,255,0.08)" : "transparent",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
    }}>
      <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: highlight ? "white" : "rgba(255,255,255,0.4)" }} />
      <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: highlight ? "white" : "rgba(255,255,255,0.4)" }} />
      <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: highlight ? "white" : "rgba(255,255,255,0.4)" }} />
    </div>
  );
}

function PlusSquareIcon({ highlight = false }: { highlight?: boolean }) {
  const c = highlight ? "white" : "rgba(255,255,255,0.3)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function PulseArrow({ direction }: { direction: "up" | "down" }) {
  const rotation = direction === "up" ? "rotate(180deg)" : "rotate(0deg)";
  return (
    <div className="animate-bounce" style={{ transform: rotation, display: "inline-flex" }}>
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round">
        <line x1="10" y1="4" x2="10" y2="16" />
        <polyline points="5,11 10,16 15,11" />
      </svg>
    </div>
  );
}

/* ── Consistent menu row ── */
function MenuRow({ icon, label, highlight = false }: { icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
      border: highlight ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.08)",
      backgroundColor: highlight ? "rgba(255,255,255,0.06)" : "transparent",
    }}>
      {icon}
      <span style={{ fontSize: 12, color: highlight ? "white" : "rgba(255,255,255,0.4)" }}>{label}</span>
    </div>
  );
}

/* ── Share sheet icon row (full width) ── */
function IconRow({ items, highlightLast }: { items: { icon: React.ReactNode; label: string }[]; highlightLast: boolean }) {
  return (
    <div style={{ display: "flex", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}>
      {items.map((item, i) => {
        const isHighlight = highlightLast && i === items.length - 1;
        return (
          <div key={i} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
            padding: "10px 4px",
            borderRight: i < items.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
            backgroundColor: isHighlight ? "rgba(255,255,255,0.06)" : "transparent",
          }}>
            {isHighlight ? <MoreDotsCircle highlight /> : <div style={{ opacity: 0.5 }}>{item.icon}</div>}
            <span style={{ fontSize: 8, color: isHighlight ? "white" : "rgba(255,255,255,0.35)" }}>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Safari steps (4 steps) ── */
function safariSteps(): Step[] {
  return [
    {
      instruction: "tap the three dots in the bottom right",
      illustration: (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.03)" }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round"><polyline points="12,4 6,10 12,16" /></svg>
            <div style={{ flex: 1, height: 26, backgroundColor: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>orchid.masudlewis.com</div>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round"><path d="M17 10a7 7 0 1 1-2-5" /><polyline points="17,2 17,6 13,6" /></svg>
            <ThreeDotsHorizontal highlight />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", width: "100%", paddingRight: 4 }}><PulseArrow direction="up" /></div>
        </div>
      ),
    },
    {
      instruction: "tap 'Share' at the top",
      illustration: (
        <div style={{ width: "100%", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}>
          <MenuRow icon={<ShareIcon />} label="Share" highlight />
          <MenuRow icon={<BookmarkIcon />} label="Add to Bookmarks" />
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
          <MenuRow icon={<PlusIcon />} label="New Tab" />
        </div>
      ),
    },
    {
      instruction: "tap 'More' with the three dots",
      illustration: (
        <IconRow
          items={[
            { icon: <CopyIcon />, label: "Copy" },
            { icon: <BookmarkIcon />, label: "Bookmarks" },
            { icon: <BookIcon />, label: "Reading" },
            { icon: <MoreDotsCircle />, label: "More" },
          ]}
          highlightLast
        />
      ),
    },
    {
      instruction: "tap 'Add to Home Screen'",
      illustration: (
        <div style={{ width: "100%", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}>
          <MenuRow icon={<StarIcon />} label="Add to Favorites" />
          <MenuRow icon={<NoteIcon />} label="Add to Quick Note" />
          <MenuRow icon={<PlusSquareIcon highlight />} label="Add to Home Screen" highlight />
        </div>
      ),
    },
  ];
}

/* ── Chrome steps (3 steps) ── */
function chromeSteps(): Step[] {
  return [
    {
      instruction: "tap the share icon in the top bar",
      illustration: (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.03)" }}>
            <div style={{ flex: 1, height: 26, backgroundColor: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", paddingLeft: 10, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>orchidaicare.lovable.app</div>
            <ShareIcon />
          </div>
          <PulseArrow direction="up" />
        </div>
      ),
    },
    {
      instruction: "tap 'More' with the three dots",
      illustration: (
        <IconRow
          items={[
            { icon: <CopyIcon />, label: "Copy" },
            { icon: <BookmarkIcon />, label: "Read Later" },
            { icon: <MoreDotsCircle />, label: "More" },
          ]}
          highlightLast
        />
      ),
    },
    {
      instruction: "tap 'Add to Home Screen'",
      illustration: (
        <div style={{ width: "100%", border: "1px solid rgba(255,255,255,0.1)", overflow: "hidden" }}>
          <MenuRow icon={<BookmarkIcon />} label="Add to Bookmarks" />
          <MenuRow icon={<PlusSquareIcon highlight />} label="Add to Home Screen" highlight />
          <MenuRow icon={<CopyIcon />} label="Copy Link" />
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

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontVariantNumeric: "tabular-nums" }}>{i + 1}.</span>
                <span style={{ fontSize: 13, color: "white", lineHeight: 1.4 }}>{s.instruction}</span>
              </div>
              {s.illustration}
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "11px", marginTop: 22,
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
