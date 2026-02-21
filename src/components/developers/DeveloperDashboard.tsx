import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const mono = "ui-monospace, monospace";
const pressStart = '"Press Start 2P", cursive';
const DENSITY_STEPS = ["█", "▓", "▒", "░", ""];
const DECRYPT_SPEED = 3;

// ── Design system hooks (matching proposal/feature pages) ───────────────────

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

function revealStyle(visible: boolean, delay: number): React.CSSProperties {
    return {
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "all 800ms ease-out",
        transitionDelay: visible ? `${delay}ms` : "0ms",
    };
}

// ── SHA-256 hashing (matches the edge function) ─────────────────────────────

async function hashApiKey(plainKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateApiKey(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let key = "orch_";
    for (let i = 0; i < 40; i++) {
        key += chars[Math.floor(Math.random() * chars.length)];
    }
    return key;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ApiKeyRecord {
    id: string;
    key_prefix: string;
    name: string;
    status: string;
    total_calls: number;
    rate_limit_per_minute: number;
    created_at: string;
    last_used_at: string | null;
}

interface UsageLogEntry {
    id: string;
    end_user_id: string;
    status: string;
    error_message: string | null;
    latency_ms: number | null;
    created_at: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function DeveloperDashboard() {
    const { user } = useAuth();
    const [keyRecord, setKeyRecord] = useState<ApiKeyRecord | null>(null);
    const [recentLogs, setRecentLogs] = useState<UsageLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [newKeyPlaintext, setNewKeyPlaintext] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [confirmRevoke, setConfirmRevoke] = useState(false);
    const [stats, setStats] = useState({ total: 0, last7d: 0, last30d: 0, errorRate: 0 });
    const [visible, setVisible] = useState(false);
    const [profileId, setProfileId] = useState<string | null>(null);

    // Trigger reveal after data loads
    useEffect(() => {
        if (!loading) {
            const t = setTimeout(() => setVisible(true), 100);
            return () => clearTimeout(t);
        }
    }, [loading]);

    // Decrypted section titles
    const titleKey = useDecryptText("api key", visible);
    const titleUsage = useDecryptText("usage", visible);
    const titleRecent = useDecryptText("recent calls", visible);

    // ── Fetch existing key + stats ──
    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", user.id)
            .single();
        if (!profile) { setLoading(false); return; }
        setProfileId(profile.id);

        const { data: keys } = await supabase
            .from("developer_api_keys")
            .select("*")
            .eq("profile_id", profile.id)
            .eq("status", "active")
            .limit(1) as any;

        const activeKey = keys?.[0] || null;
        setKeyRecord(activeKey);

        if (activeKey) {
            const { data: logs } = await supabase
                .from("api_usage_log")
                .select("*")
                .eq("api_key_id", activeKey.id)
                .order("created_at", { ascending: false })
                .limit(20) as any;

            setRecentLogs(logs || []);

            const now = new Date();
            const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

            const { count: c7 } = await supabase
                .from("api_usage_log")
                .select("*", { count: "exact", head: true })
                .eq("api_key_id", activeKey.id)
                .gte("created_at", d7) as any;

            const { count: c30 } = await supabase
                .from("api_usage_log")
                .select("*", { count: "exact", head: true })
                .eq("api_key_id", activeKey.id)
                .gte("created_at", d30) as any;

            const { count: errors30 } = await supabase
                .from("api_usage_log")
                .select("*", { count: "exact", head: true })
                .eq("api_key_id", activeKey.id)
                .eq("status", "error")
                .gte("created_at", d30) as any;

            const total = activeKey.total_calls || 0;
            const errRate = (c30 || 0) > 0 ? ((errors30 || 0) / (c30 || 1)) * 100 : 0;

            setStats({
                total,
                last7d: c7 || 0,
                last30d: c30 || 0,
                errorRate: Math.round(errRate * 10) / 10,
            });
        }

        setLoading(false);
    }, [user]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Generate ──
    const handleGenerate = async () => {
        if (!user || !profileId) return;
        const plainKey = generateApiKey();
        const hash = await hashApiKey(plainKey);
        const prefix = plainKey.slice(0, 12) + "...";

        const { error } = await supabase.from("developer_api_keys").insert({
            profile_id: profileId,
            key_hash: hash,
            key_prefix: prefix,
            name: "Default",
        } as any);

        if (error) { console.error("Error generating key:", error); return; }
        setNewKeyPlaintext(plainKey);
        await fetchData();
    };

    // ── Revoke ──
    const handleRevoke = async () => {
        if (!keyRecord) return;
        await supabase
            .from("developer_api_keys")
            .update({ status: "revoked" } as any)
            .eq("id", keyRecord.id);
        setKeyRecord(null);
        setNewKeyPlaintext(null);
        setConfirmRevoke(false);
        setRecentLogs([]);
        setStats({ total: 0, last7d: 0, last30d: 0, errorRate: 0 });
        await fetchData();
    };

    // ── Copy ──
    const handleCopy = async () => {
        if (!newKeyPlaintext) return;
        await navigator.clipboard.writeText(newKeyPlaintext);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) {
        return <div style={{ opacity: 0.4, fontSize: "13px" }}>loading...</div>;
    }

    // ── No key yet ──
    if (!keyRecord && !newKeyPlaintext) {
        return (
            <div className="flex flex-col gap-6 max-w-[600px]" style={revealStyle(visible, 0)}>
                <h2 style={{ fontFamily: pressStart, fontSize: "16px", marginBottom: "8px" }}>
                    {titleKey}
                </h2>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: 1.8 }}>
                    Generate an API key to integrate Orchid's plant intelligence
                    into your own applications. Your key will only be shown once — copy it immediately.
                </p>
                <button
                    onClick={handleGenerate}
                    className="cursor-pointer transition-colors duration-200 hover:bg-white/90"
                    style={{
                        padding: "14px 24px",
                        border: "1px solid white",
                        backgroundColor: "white",
                        color: "black",
                        fontFamily: mono,
                        fontSize: "12px",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        width: "fit-content",
                    }}
                >
                    generate api key
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-12">
            {/* ── API Key ── */}
            <section style={revealStyle(visible, 0)}>
                <h2 style={{ fontFamily: pressStart, fontSize: "14px", marginBottom: "20px" }}>
                    {titleKey}
                </h2>

                {/* Plaintext key (shown once) */}
                {newKeyPlaintext && (
                    <div
                        style={{
                            border: "1px solid rgba(255,255,255,0.15)",
                            padding: "20px",
                            marginBottom: "16px",
                            backgroundColor: "rgba(255,255,255,0.02)",
                        }}
                    >
                        <div style={{
                            fontSize: "10px", color: "rgba(255,255,255,0.4)", marginBottom: "10px",
                            textTransform: "uppercase", letterSpacing: "0.12em",
                        }}>
                            ⚠ copy now — will not be shown again
                        </div>
                        <div className="flex items-center gap-3">
                            <code style={{
                                fontSize: "13px", color: "#4ade80",
                                backgroundColor: "rgba(255,255,255,0.03)",
                                padding: "10px 14px", flex: 1, wordBreak: "break-all",
                            }}>
                                {newKeyPlaintext}
                            </code>
                            <button
                                onClick={handleCopy}
                                className="cursor-pointer transition-colors duration-200"
                                style={{
                                    padding: "10px 18px",
                                    border: "1px solid rgba(255,255,255,0.15)",
                                    backgroundColor: copied ? "rgba(74,222,128,0.1)" : "transparent",
                                    color: copied ? "#4ade80" : "rgba(255,255,255,0.6)",
                                    fontFamily: mono, fontSize: "11px", whiteSpace: "nowrap",
                                }}
                            >
                                {copied ? "copied ✓" : "copy"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Key info */}
                {keyRecord && (
                    <div style={{
                        border: "1px solid rgba(255,255,255,0.08)",
                        padding: "16px 20px",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                        <div>
                            <div style={{ fontSize: "13px", marginBottom: "4px" }}>
                                <span style={{ color: "rgba(255,255,255,0.4)" }}>key: </span>
                                <code style={{ color: "rgba(255,255,255,0.7)" }}>{keyRecord.key_prefix}</code>
                            </div>
                            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>
                                created {new Date(keyRecord.created_at).toLocaleDateString()}
                                {keyRecord.last_used_at && ` · last used ${new Date(keyRecord.last_used_at).toLocaleDateString()}`}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            {!confirmRevoke ? (
                                <button
                                    onClick={() => setConfirmRevoke(true)}
                                    className="cursor-pointer transition-colors duration-200"
                                    style={{
                                        padding: "6px 14px",
                                        border: "1px solid rgba(255,80,80,0.2)",
                                        backgroundColor: "transparent",
                                        color: "rgba(255,80,80,0.6)",
                                        fontFamily: mono, fontSize: "11px",
                                    }}
                                >
                                    revoke
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handleRevoke}
                                        className="cursor-pointer"
                                        style={{
                                            padding: "6px 14px",
                                            border: "1px solid #ef4444",
                                            backgroundColor: "#ef4444",
                                            color: "white",
                                            fontFamily: mono, fontSize: "11px",
                                        }}
                                    >
                                        confirm revoke
                                    </button>
                                    <button
                                        onClick={() => setConfirmRevoke(false)}
                                        className="cursor-pointer"
                                        style={{
                                            padding: "6px 14px",
                                            border: "1px solid rgba(255,255,255,0.15)",
                                            backgroundColor: "transparent",
                                            color: "rgba(255,255,255,0.4)",
                                            fontFamily: mono, fontSize: "11px",
                                        }}
                                    >
                                        cancel
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {/* ── Usage Stats ── */}
            <section style={revealStyle(visible, 200)}>
                <h2 style={{ fontFamily: pressStart, fontSize: "14px", marginBottom: "20px" }}>
                    {titleUsage}
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "total calls", value: stats.total.toLocaleString() },
                        { label: "last 7 days", value: stats.last7d.toLocaleString() },
                        { label: "last 30 days", value: stats.last30d.toLocaleString() },
                        { label: "error rate", value: `${stats.errorRate}%` },
                    ].map((stat, i) => (
                        <div
                            key={stat.label}
                            style={{
                                ...revealStyle(visible, 300 + i * 80),
                                border: "1px solid rgba(255,255,255,0.08)",
                                padding: "16px",
                            }}
                        >
                            <div style={{
                                fontSize: "10px", color: "rgba(255,255,255,0.3)",
                                textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px",
                            }}>
                                {stat.label}
                            </div>
                            <div style={{ fontSize: "22px", fontWeight: "bold", letterSpacing: "-0.02em" }}>
                                {stat.value}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Recent Calls ── */}
            <section style={revealStyle(visible, 500)}>
                <h2 style={{ fontFamily: pressStart, fontSize: "14px", marginBottom: "20px" }}>
                    {titleRecent}
                </h2>

                {recentLogs.length === 0 ? (
                    <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)" }}>
                        No API calls yet. Make your first request to see activity here.
                    </div>
                ) : (
                    <div style={{ border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
                        {/* Header */}
                        <div
                            className="grid grid-cols-4 gap-4"
                            style={{
                                padding: "10px 16px",
                                borderBottom: "1px solid rgba(255,255,255,0.08)",
                                fontSize: "10px", textTransform: "uppercase",
                                letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)",
                            }}
                        >
                            <div>time</div>
                            <div>user</div>
                            <div>status</div>
                            <div>latency</div>
                        </div>

                        {/* Rows */}
                        {recentLogs.map((log) => (
                            <div
                                key={log.id}
                                className="grid grid-cols-4 gap-4"
                                style={{
                                    padding: "8px 16px",
                                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                                    fontSize: "12px",
                                }}
                            >
                                <div style={{ color: "rgba(255,255,255,0.4)" }}>
                                    {new Date(log.created_at).toLocaleTimeString()}
                                </div>
                                <div style={{ color: "rgba(255,255,255,0.6)" }}>
                                    {log.end_user_id.length > 16
                                        ? log.end_user_id.slice(0, 16) + "…"
                                        : log.end_user_id}
                                </div>
                                <div>
                                    <span style={{ color: log.status === "success" ? "#4ade80" : "#ef4444", fontSize: "11px" }}>
                                        {log.status}
                                    </span>
                                </div>
                                <div style={{ color: "rgba(255,255,255,0.4)" }}>
                                    {log.latency_ms != null ? `${log.latency_ms}ms` : "—"}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* ── Rate Limit ── */}
            {keyRecord && (
                <section style={revealStyle(visible, 700)}>
                    <div style={{
                        fontSize: "11px", color: "rgba(255,255,255,0.25)",
                        borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px",
                    }}>
                        rate limit: {keyRecord.rate_limit_per_minute} requests/minute
                    </div>
                </section>
            )}
        </div>
    );
}
