import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BackButton } from "@/components/ui/back-button";
import { DeveloperDashboard } from "@/components/developers/DeveloperDashboard";
import { DeveloperDocs } from "@/components/developers/DeveloperDocs";

const mono = "ui-monospace, monospace";
const pressStart = '"Press Start 2P", cursive';
const DENSITY_STEPS = ["█", "▓", "▒", "░", ""];
const DECRYPT_SPEED = 3;

type Tab = "dashboard" | "docs";

// ── Decrypt text hook (matches proposal/start-page pattern) ─────────────────

const ScrambleButton = ({ text, onClick }: { text: string, onClick: () => void }) => {
    const [displayText, setDisplayText] = useState(text);

    const handleClick = () => {
        let iterations = 0;
        const interval = setInterval(() => {
            iterations++;
            setDisplayText(text.split('').map((char) => {
                if (char === ' ') return ' ';
                return DENSITY_STEPS[Math.floor(Math.random() * (DENSITY_STEPS.length - 1))] || '█';
            }).join(''));

            if (iterations > 8) {
                clearInterval(interval);
                setDisplayText(text);
                onClick();
            }
        }, 50);
    };

    return (
        <button
            onClick={handleClick}
            className="cursor-pointer transition-colors duration-200 hover:text-white"
            style={{
                fontFamily: pressStart,
                fontSize: '11px',
                letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.7)',
                backgroundColor: 'transparent',
                border: 'none',
                padding: '6px 10px',
                marginTop: '1px',
            }}
        >
            {displayText}
        </button>
    );
};

function useDecryptText(text: string, visible: boolean, charDelay = 1.5) {
    const [decrypted, setDecrypted] = useState(text);
    const frameRef = useRef(0);

    useEffect(() => {
        if (!visible) { setDecrypted(text); return; }

        const chars = text.split("");
        let animationId: number;

        const animate = () => {
            frameRef.current++;
            const frame = frameRef.current;
            let allDone = true;

            const newText = chars
                .map((char, i) => {
                    if (char === " ") return " ";
                    const charFrames = frame - i * charDelay;
                    if (charFrames < 0) { allDone = false; return DENSITY_STEPS[0]; }
                    const cycles = Math.floor(charFrames / DECRYPT_SPEED);
                    if (cycles >= DENSITY_STEPS.length) return char;
                    allDone = false;
                    return DENSITY_STEPS[Math.min(cycles, DENSITY_STEPS.length - 1)];
                })
                .join("");

            setDecrypted(newText);
            if (!allDone) animationId = requestAnimationFrame(animate);
        };

        frameRef.current = 0;
        animationId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationId);
    }, [visible, text, charDelay]);

    return decrypted;
}

export default function DeveloperPlatform() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>("dashboard");
    const [scrollProgress, setScrollProgress] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const decryptedTitle = useDecryptText("developer platform", true);

    // Track scroll for top progress bar
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const handleScroll = () => {
            const h = el.scrollHeight - el.clientHeight;
            setScrollProgress(h > 0 ? Math.min(el.scrollTop / h, 1) : 0);
        };
        el.addEventListener("scroll", handleScroll);
        return () => el.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <div className="fixed inset-0 bg-black text-white overflow-hidden" style={{ fontFamily: mono }}>
            {/* Grain overlay — matches hero/start-page */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.04] mix-blend-screen z-40">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <filter id="grain-dev">
                        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                        <feColorMatrix type="saturate" values="0" />
                    </filter>
                    <rect width="100%" height="100%" filter="url(#grain-dev)" />
                </svg>
            </div>

            {/* Top progress bar — matches start-page */}
            <div
                className="absolute top-0 left-0 h-2 bg-white z-50 transition-all duration-150"
                style={{ width: `${scrollProgress * 100}%` }}
            />

            {/* Back button */}
            <BackButton onClick={() => navigate("/")} />

            {/* Unified nav — top wide */}
            <div
                className="absolute z-50 flex justify-between w-full px-4"
                style={{
                    top: 'max(12px, env(safe-area-inset-top, 12px))',
                }}
            >
                <div className="flex items-center">
                    <ScrambleButton text="ORCHID" onClick={() => navigate('/')} />
                </div>

                <div className="flex gap-1 items-center">
                    {([
                        { label: "/dashboard", action: () => navigate("/dashboard"), active: false },
                        { label: "/docs", action: () => setActiveTab("docs"), active: activeTab === "docs" },
                        { label: "|", action: undefined, active: false },
                        { label: "/collection", action: () => navigate("/dashboard"), active: false },
                        { label: "/chat", action: () => navigate("/chat"), active: false },
                        { label: "/call", action: () => navigate("/call"), active: false },
                    ] as const).map((item, i) => {
                        if (item.label === '|') {
                            return <div key={`divider-${i}`} style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center', margin: '0 4px' }} />;
                        }
                        const isAction = item.label === '/chat' || item.label === '/call';
                        return (
                            <button
                                key={item.label}
                                onClick={item.action}
                                className="cursor-pointer transition-colors duration-200"
                                style={{
                                    fontFamily: mono,
                                    fontSize: '11px',
                                    letterSpacing: '0.06em',
                                    color: isAction ? 'white' : (item.active ? 'white' : 'rgba(255,255,255,0.3)'),
                                    fontWeight: isAction ? 'bold' : 'normal',
                                    backgroundColor: isAction ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    border: isAction ? '1px solid rgba(255,255,255,0.5)' : 'none',
                                    borderBottom: isAction ? '1px solid rgba(255,255,255,0.5)' : (item.active ? '1px solid white' : '1px solid transparent'),
                                    padding: '6px 10px',
                                    borderRadius: '0',
                                }}
                                onMouseEnter={(e) => { if (!item.active && !isAction) e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                                onMouseLeave={(e) => { if (!item.active && !isAction) e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                            >
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sticky header — title only */}
            <div
                className="sticky top-0 z-30"
                style={{ backdropFilter: "blur(12px)", backgroundColor: "rgba(0,0,0,0.85)" }}
            >
                <div className="max-w-[1100px] mx-auto px-8 md:px-16 py-5">
                    <h1 style={{ fontFamily: pressStart, fontSize: "clamp(11px, 2.5vw, 14px)", letterSpacing: "0.05em" }}>
                        {decryptedTitle}
                    </h1>
                </div>
            </div>

            {/* Scrollable content */}
            <div
                ref={scrollRef}
                className="h-full overflow-y-auto pt-4 pb-24"
                style={{ scrollbarWidth: "none" }}
            >
                <main className="max-w-[1100px] mx-auto px-8 md:px-16 py-10">
                    {activeTab === "dashboard" && <DeveloperDashboard />}
                    {activeTab === "docs" && <DeveloperDocs />}
                </main>
            </div>
        </div>
    );
}
