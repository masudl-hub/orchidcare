import { useState, useEffect, useRef, useCallback } from "react";

const mono = "ui-monospace, monospace";
const pressStart = '"Press Start 2P", cursive';
const DENSITY_STEPS = ["█", "▓", "▒", "░", ""];
const DECRYPT_SPEED = 3;

// ── Design system hooks ─────────────────────────────────────────────────────

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

function useInView(threshold = 0.15) {
    const ref = useRef<HTMLElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setVisible(true); },
            { threshold }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [threshold]);

    return { ref, visible };
}

// ── Sub-components ──────────────────────────────────────────────────────────

function CodeBlock({ children }: { children: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(children).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        });
    }, [children]);

    return (
        <div style={{ position: "relative" }}>
            <button
                onClick={handleCopy}
                style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    fontFamily: mono,
                    fontSize: "10px",
                    letterSpacing: "0.06em",
                    color: copied ? "#4ade80" : "rgba(255,255,255,0.25)",
                    backgroundColor: "transparent",
                    border: copied ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "4px",
                    padding: "3px 8px",
                    cursor: "pointer",
                    transition: "all 200ms",
                }}
                onMouseEnter={(e) => { if (!copied) e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
                onMouseLeave={(e) => { if (!copied) e.currentTarget.style.color = "rgba(255,255,255,0.25)"; }}
            >
                {copied ? "COPIED" : "COPY"}
            </button>
            <pre style={{
                backgroundColor: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "16px",
                paddingRight: "70px",
                fontSize: "12px",
                lineHeight: 1.7,
                overflowX: "auto",
                whiteSpace: "pre",
                color: "rgba(255,255,255,0.8)",
            }}>
                {children}
            </pre>
        </div>
    );
}

function Section({
    title,
    figLabel,
    delay,
    children,
}: {
    title: string;
    figLabel: string;
    delay: number;
    children: React.ReactNode;
}) {
    const { ref, visible } = useInView(0.15);
    const decryptedTitle = useDecryptText(title, visible);

    return (
        <section
            ref={ref as React.RefObject<HTMLDivElement>}
            className="relative mb-16"
            style={revealStyle(visible, delay)}
        >
            <div
                className="hidden md:block"
                style={{
                    position: "absolute", top: 0, right: 0,
                    opacity: visible ? 0.25 : 0,
                    transform: visible ? "translateY(0)" : "translateY(6px)",
                    transition: "all 600ms ease-out",
                    transitionDelay: visible ? "100ms" : "0ms",
                    fontFamily: mono, fontSize: "10px", color: "white",
                    letterSpacing: "0.12em",
                }}
            >
                {figLabel}
            </div>

            <h3 style={{ fontFamily: pressStart, fontSize: "12px", marginBottom: "16px", color: "white" }}>
                {decryptedTitle}
            </h3>
            <div style={{ fontSize: "13px", lineHeight: 1.8, color: "rgba(255,255,255,0.6)" }}>
                {children}
            </div>
        </section>
    );
}

// ── Tool entry ──────────────────────────────────────────────────────────────

function ToolEntry({ name, desc, params }: { name: string; desc: string; params?: string }) {
    return (
        <div style={{ border: "1px solid rgba(255,255,255,0.06)", padding: "12px 14px", marginBottom: "4px" }}>
            <code style={{ color: "#4ade80", fontSize: "12px" }}>{name}</code>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", marginTop: "4px" }}>
                {desc}
            </div>
            {params && (
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "6px", fontStyle: "italic" }}>
                    {params}
                </div>
            )}
        </div>
    );
}

// ── Note callout ────────────────────────────────────────────────────────────

function Note({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            borderLeft: "2px solid rgba(250,204,21,0.5)",
            paddingLeft: "12px",
            marginTop: "12px",
            fontSize: "12px",
            color: "rgba(255,255,255,0.4)",
        }}>
            {children}
        </div>
    );
}

// ── Main ────────────────────────────────────────────────────────────────────

const API_ENDPOINT = "https://mskieqnxdtezxbijpvgy.supabase.co/functions/v1/api";

export function DeveloperDocs() {
    const { ref: introRef, visible: introVisible } = useInView(0.15);
    const introTitle = useDecryptText("api documentation", introVisible);

    return (
        <div style={{ fontFamily: mono, maxWidth: 700 }}>
            {/* Intro */}
            <div
                ref={introRef as React.RefObject<HTMLDivElement>}
                style={{ ...revealStyle(introVisible, 0), marginBottom: "48px" }}
            >
                <h2 style={{ fontFamily: pressStart, fontSize: "16px", marginBottom: "12px" }}>
                    {introTitle}
                </h2>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.8 }}>
                    The Orchid API gives your application access to the same plant AI that powers the
                    Orchid chat. Identify species from photos, diagnose issues, manage plant collections,
                    set care reminders, research the web, find local stores, generate visual guides —
                    everything the agent can do, available as a single REST endpoint. The AI maintains
                    per-user conversation memory, so each user gets a personalized, context-aware
                    experience across sessions.
                </p>
            </div>

            {/* 1. Quick Start */}
            <Section title="1. quick start" figLabel="§ 3.1" delay={0}>
                <CodeBlock>{`curl -X POST ${API_ENDPOINT} \\
  -H "Authorization: Bearer orch_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "My monstera has yellow leaves, what should I do?",
    "end_user_id": "user_123"
  }'`}</CodeBlock>
                <div style={{ marginTop: "16px" }}>
                    <strong style={{ color: "white" }}>Response:</strong>
                </div>
                <CodeBlock>{`{
  "success": true,
  "data": {
    "reply": "Yellow leaves on a Monstera usually come down to one of three things — overwatering, not enough light, or the plant outgrowing its pot. Check if the soil feels soggy more than a couple inches down. If it does, let it dry out completely before watering again. How often are you watering it, and where is it sitting in your home?",
    "mediaToSend": []
  }
}`}</CodeBlock>
            </Section>

            {/* 2. Authentication */}
            <Section title="2. authentication" figLabel="§ 3.2" delay={0}>
                <p style={{ marginBottom: "12px" }}>
                    Include your API key in the{" "}
                    <code style={{ color: "#4ade80" }}>Authorization</code> header:
                </p>
                <CodeBlock>{`Authorization: Bearer orch_YOUR_API_KEY`}</CodeBlock>
                <div style={{ marginTop: "12px", fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>
                    Keys start with <code>orch_</code> and are 45 characters long. They are shown only
                    once on generation — if lost, revoke and create a new one from the dashboard.
                </div>
            </Section>

            {/* 3. Request Format */}
            <Section title="3. request format" figLabel="§ 3.3" delay={0}>
                <p style={{ marginBottom: "4px" }}>
                    <code style={{ color: "#4ade80" }}>POST</code>{" "}
                    <code style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{API_ENDPOINT}</code>
                </p>
                <div style={{ marginBottom: "12px" }} />
                <CodeBlock>{`{
  "message": "string (required) — natural language request",
  "end_user_id": "string (required) — unique ID for this end user",
  "media": ["string (optional) — one public URL to an image, video, or audio file"]
}`}</CodeBlock>
                <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div>
                        <strong style={{ color: "white" }}>message</strong> — Natural language. Write it the
                        same way a user would type in a chat. The AI determines which tools to use based on
                        the content, context, and conversation history.
                    </div>
                    <div>
                        <strong style={{ color: "white" }}>end_user_id</strong> — Any unique string that
                        identifies your user (<code>uuid</code>, <code>email hash</code>, <code>username</code>, etc.).
                        The API creates an isolated profile, plant collection, and conversation thread per
                        developer × user pair. Two different developers using the same end_user_id will
                        not collide.
                    </div>
                    <div>
                        <strong style={{ color: "white" }}>media</strong> — A single public URL to an image,
                        video, or audio file. Used for plant identification, diagnosis, environment analysis,
                        video analysis, and voice transcription.
                    </div>
                    <Note>
                        Currently limited to one media URL per request. If you need to send multiple images,
                        send them in separate requests referencing the same conversation thread.
                    </Note>
                </div>
            </Section>

            {/* 4. Response Format */}
            <Section title="4. response format" figLabel="§ 3.4" delay={0}>
                <CodeBlock>{`{
  "success": true,
  "data": {
    "reply": "string — the AI's text response",
    "mediaToSend": [
      "string — URLs to generated images (visual guides, etc.)"
    ]
  }
}`}</CodeBlock>
                <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div><strong style={{ color: "white" }}>reply</strong> — The AI's natural language response. Written in a conversational tone.</div>
                    <div>
                        <strong style={{ color: "white" }}>mediaToSend</strong> — Array of image URLs generated
                        during the response (visual care guides, AI-generated illustrations). Empty array when
                        the response is text-only.
                    </div>
                </div>
                <Note>
                    Error responses use a different shape:{" "}
                    <code>{`{ "error": "...", "details": "..." }`}</code>
                </Note>
            </Section>

            {/* 5. Conversation Memory */}
            <Section title="5. conversation memory" figLabel="§ 3.5" delay={0}>
                <p style={{ marginBottom: "12px" }}>
                    The AI maintains full conversation history per <code style={{ color: "#4ade80" }}>end_user_id</code>.
                    This means the agent remembers what your user said in previous requests, what plants they
                    have, what their home looks like, and what advice was already given — across sessions, days, and weeks.
                </p>
                <p style={{ marginBottom: "12px" }}>
                    <strong style={{ color: "white" }}>Example — multi-turn conversation:</strong>
                </p>
                <CodeBlock>{`// Request 1
{ "message": "I just got a fiddle leaf fig", "end_user_id": "user_42" }
// → "Nice! Where are you putting it?"

// Request 2
{ "message": "By my south-facing window", "end_user_id": "user_42" }
// → "South-facing is bright — your fiddle leaf will love it, but you may
//    want to pull it back a couple feet to avoid direct afternoon sun..."

// Request 3 — days later
{ "message": "my plant has brown spots", "end_user_id": "user_42" }
// → "Since your fiddle leaf fig is by that south-facing window, those
//    brown spots could be sunburn. Has anything changed..."

// The AI remembered the plant AND its location from earlier`}</CodeBlock>
                <Note>
                    The AI also passively learns about users — if someone mentions they have cats, it will
                    proactively flag toxic plants in future conversations. These insights persist across sessions.
                </Note>
            </Section>

            {/* 6. User Isolation */}
            <Section title="6. user isolation" figLabel="§ 3.6" delay={0}>
                <p>
                    Each <code style={{ color: "#4ade80" }}>end_user_id</code> gets a fully isolated profile
                    under your developer account:
                </p>
                <ul style={{ marginTop: "8px", paddingLeft: "20px", listStyle: "disc" }}>
                    <li>Own plant collection with nicknames, locations, and notes</li>
                    <li>Own conversation history — the AI remembers past interactions</li>
                    <li>Own care reminders and event logs</li>
                    <li>Own plant snapshots and visual progress tracking</li>
                    <li>Own user insights (experience level, pets, growing conditions)</li>
                    <li>Own notification preferences and profile settings</li>
                </ul>
            </Section>

            {/* 7. Sending Media */}
            <Section title="7. sending media" figLabel="§ 3.7" delay={0}>
                <p style={{ marginBottom: "12px" }}>
                    Pass a public URL in the <code style={{ color: "#4ade80" }}>media</code> array. The
                    AI selects the right analysis tool based on the message and file type.
                </p>
                <p style={{ marginBottom: "12px" }}>
                    <strong style={{ color: "white" }}>Example — plant identification from photo:</strong>
                </p>
                <CodeBlock>{`{
  "message": "What plant is this?",
  "end_user_id": "user_42",
  "media": ["https://example.com/photos/mystery_plant.jpg"]
}`}</CodeBlock>
                <CodeBlock>{`{
  "success": true,
  "data": {
    "reply": "That's a Pothos (Epipremnum aureum), specifically the Golden Pothos variety. You can tell by the heart-shaped leaves with gold and green variegation. They're one of the hardiest houseplants — perfect for beginners. Want me to save it to your collection?",
    "mediaToSend": []
  }
}`}</CodeBlock>
                <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                        <span><strong style={{ color: "white" }}>Images</strong> — plant identification, diagnosis, environment analysis, snapshot capture</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" /><rect x="2" y="6" width="14" height="12" rx="2" /></svg>
                        <span><strong style={{ color: "white" }}>Video</strong> — health assessment, pest movement tracking, care technique evaluation</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
                        <span><strong style={{ color: "white" }}>Audio</strong> — voice note transcription for hands-free interaction</span>
                    </div>
                </div>
                <Note>
                    URLs must be publicly accessible. The AI downloads and processes the file server-side.
                    Large videos may increase response time.
                </Note>
            </Section>

            {/* 8. Capabilities — Vision & Identification */}
            <Section title="8. vision & identification" figLabel="§ 3.8" delay={0}>
                <ToolEntry
                    name="identify_plant"
                    desc="Photo → species, confidence score, common names, care summary."
                    params="Triggered by: 'what plant is this?', 'identify this', or sending a photo without context"
                />
                <ToolEntry
                    name="diagnose_plant"
                    desc="Photo of sick plant → diagnosis, severity (mild/moderate/severe), treatment plan, prevention tips."
                    params="Triggered by: 'what's wrong with my plant?', 'why are the leaves yellow?'"
                />
                <ToolEntry
                    name="analyze_environment"
                    desc="Room/space photo → light level assessment, space evaluation, placement recommendations."
                    params="Triggered by: 'is this a good spot for a plant?', 'analyze this room'"
                />
                <ToolEntry
                    name="analyze_video"
                    desc="Video analysis for plant health observations, growth patterns, pest movement, or care technique evaluation."
                    params="Triggered by sending a video URL in media with a question"
                />
                <ToolEntry
                    name="transcribe_voice"
                    desc="Transcribe and understand voice notes / audio files. Pass a public audio URL in the media array."
                    params="Triggered by sending an audio URL in media"
                />
            </Section>

            {/* 9. Capabilities — Plant Collection */}
            <Section title="9. plant collection" figLabel="§ 3.9" delay={0}>
                <p style={{ marginBottom: "12px" }}>
                    Full CRUD for each user's plant library. All tools support bulk operations —
                    single plants by name/nickname, all plants, by location, or by type.
                </p>
                <ToolEntry
                    name="save_plant"
                    desc="Add a plant to the user's collection with species, nickname, location, and notes."
                    params="species (required), nickname, location, notes"
                />
                <ToolEntry
                    name="modify_plant"
                    desc="Update nickname, location, or notes. Bulk: 'all plants', 'all plants in the bedroom', 'all succulents'."
                    params="plant_identifier, updates { nickname, location, notes }"
                />
                <ToolEntry
                    name="delete_plant"
                    desc="Remove plants. Bulk deletes require explicit user confirmation before proceeding."
                    params="plant_identifier, user_confirmed (required for bulk)"
                />
            </Section>

            {/* 10. Capabilities — Care Management */}
            <Section title="10. care management" figLabel="§ 3.10" delay={0}>
                <ToolEntry
                    name="create_reminder"
                    desc="Set recurring care reminders: watering, fertilizing, repotting, rotation, misting, pruning."
                    params="plant_identifier, reminder_type (water/fertilize/repot/rotate/check/prune/mist), frequency_days, notes"
                />
                <ToolEntry
                    name="delete_reminder"
                    desc="Remove reminders by plant and optionally by type. Supports bulk."
                    params="plant_identifier, reminder_type (optional — omit to delete all)"
                />
                <ToolEntry
                    name="log_care_event"
                    desc="Record care activities. Supports bulk: 'I watered all my plants'."
                    params="plant_identifier, event_type (water/fertilize/repot/prune/mist/rotate/treat), notes"
                />
                <ToolEntry
                    name="capture_plant_snapshot"
                    desc="Save a timestamped visual description + optional photo for progress tracking over time."
                    params="plant_identifier, description, context (identification/diagnosis/routine_check/user_requested), health_notes"
                />
                <ToolEntry
                    name="compare_plant_snapshots"
                    desc="Compare how a plant looks now vs. previous snapshots — AI generates a temporal health analysis."
                    params="plant_identifier, comparison_type (latest or all)"
                />
            </Section>

            {/* 11. Capabilities — Research & Discovery */}
            <Section title="11. research & discovery" figLabel="§ 3.11" delay={0}>
                <ToolEntry
                    name="research"
                    desc="Real-time web search via Perplexity for plant info, pest treatments, product reviews, URL analysis, toxicity data."
                    params="query, focus (general/product/toxicity/article_analysis/fact_check)"
                />
                <ToolEntry
                    name="find_stores"
                    desc="Find nearby nurseries, garden centers, and hardware stores. Returns full store names, addresses, and distances."
                    params="product_query, store_type (nursery/garden_center/hardware_store/any), max_results"
                />
                <ToolEntry
                    name="verify_store_inventory"
                    desc="Check if a specific store carries a product. Returns stock status, confidence, department/aisle, brand alternatives."
                    params="store_name (with location, e.g. 'Home Depot on Aurora Ave'), product, location"
                />
                <ToolEntry
                    name="get_cached_stores"
                    desc="Retrieve recently cached store results (< 24h) for follow-up questions like 'more stores' or 'other options'."
                    params="product_query — the original product searched for"
                />
                <ToolEntry
                    name="deep_think"
                    desc="Route complex questions to a more capable model for extended multi-step reasoning."
                    params="question, context"
                />
            </Section>

            {/* 12. Capabilities — Content Generation */}
            <Section title="12. content generation" figLabel="§ 3.12" delay={0}>
                <ToolEntry
                    name="generate_visual_guide"
                    desc="Step-by-step illustrated care guides with AI-generated images. Returns text instructions + image URLs in mediaToSend."
                    params="task (e.g., 'propagate pothos in water'), plant_species, step_count (2-4, default 3)"
                />
                <ToolEntry
                    name="generate_image"
                    desc="AI image generation (DALL-E 3) for visual reference, care diagrams, or educational content."
                    params="prompt"
                />
            </Section>

            {/* 13. Capabilities — User & Preferences */}
            <Section title="13. user & preferences" figLabel="§ 3.13" delay={0}>
                <p style={{ marginBottom: "12px" }}>
                    The AI passively learns about each user and stores insights for personalization.
                    These tools are typically called automatically by the agent, but are triggered by
                    natural conversation.
                </p>
                <ToolEntry
                    name="save_user_insight"
                    desc="Persist learned facts: pet ownership, lighting conditions, watering style, climate zone, allergies, child safety."
                    params="insight_key (has_pets/home_lighting/watering_style/experience_level/plant_goals/...), insight_value"
                />
                <ToolEntry
                    name="update_profile"
                    desc="Update core profile fields. Triggered naturally — 'I'm in 94105' saves location, 'Call me Mia' saves display name."
                    params="field (display_name/location/experience_level/primary_concerns/personality/pets/timezone), value"
                />
                <ToolEntry
                    name="update_notification_preferences"
                    desc="Control proactive messaging: enable/disable topics, set frequency, configure quiet hours."
                    params="topic (care_reminders/observations/seasonal_tips/health_followups/all), action (enable/disable/set_frequency)"
                />
            </Section>

            {/* 14. Integration Examples */}
            <Section title="14. integration examples" figLabel="§ 3.14" delay={0}>
                <p style={{ marginBottom: "12px" }}>
                    <strong style={{ color: "white" }}>Node.js / TypeScript:</strong>
                </p>
                <CodeBlock>{`const response = await fetch("${API_ENDPOINT}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer orch_YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: userInput,
    end_user_id: currentUser.id,
  }),
});

const { success, data, error } = await response.json();

if (success) {
  displayMessage(data.reply);
  data.mediaToSend.forEach(url => displayImage(url));
} else {
  handleError(error);
}`}</CodeBlock>

                <p style={{ marginTop: "24px", marginBottom: "12px" }}>
                    <strong style={{ color: "white" }}>Python:</strong>
                </p>
                <CodeBlock>{`import requests

resp = requests.post(
    "${API_ENDPOINT}",
    headers={"Authorization": "Bearer orch_YOUR_API_KEY"},
    json={
        "message": user_input,
        "end_user_id": current_user_id,
    },
)

result = resp.json()
if result.get("success"):
    print(result["data"]["reply"])
    for url in result["data"].get("mediaToSend", []):
        download_image(url)
else:
    print(f"Error: {result.get('error')}")`}</CodeBlock>

                <p style={{ marginTop: "24px", marginBottom: "12px" }}>
                    <strong style={{ color: "white" }}>With photo upload:</strong>
                </p>
                <CodeBlock>{`// Upload image to your storage first, then pass the public URL
const { data } = await fetch("${API_ENDPOINT}", {
  method: "POST",
  headers: {
    "Authorization": "Bearer orch_YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: "What's wrong with this plant?",
    end_user_id: "user_42",
    media: ["https://your-storage.com/uploads/sick_plant.jpg"],
  }),
}).then(r => r.json());`}</CodeBlock>
            </Section>

            {/* 15. Error Codes */}
            <Section title="15. error codes" figLabel="§ 3.15" delay={0}>
                <div className="flex flex-col gap-1">
                    {[
                        { code: "401", desc: "Missing, malformed, or invalid format Authorization header" },
                        { code: "403", desc: "API key not found, revoked, or expired" },
                        { code: "400", desc: "Missing required fields (message and/or end_user_id)" },
                        { code: "429", desc: "Rate limit exceeded — respect the Retry-After header" },
                        { code: "500", desc: "Internal error — agent failure, upstream timeout, or unhandled exception" },
                    ].map((err) => (
                        <div
                            key={err.code}
                            style={{
                                display: "flex", gap: "16px", padding: "8px 0",
                                borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: "12px",
                            }}
                        >
                            <code style={{
                                color: err.code === "429" ? "#facc15" : "#ef4444",
                                width: "40px", flexShrink: 0,
                            }}>
                                {err.code}
                            </code>
                            <span style={{ color: "rgba(255,255,255,0.5)" }}>{err.desc}</span>
                        </div>
                    ))}
                </div>
                <div style={{ marginTop: "16px" }}>
                    <strong style={{ color: "white" }}>Error response shape:</strong>
                </div>
                <CodeBlock>{`{
  "error": "Rate limit exceeded",
  "limit_per_minute": 7,
  "retry_after_seconds": 60
}`}</CodeBlock>
            </Section>

            {/* 16. Rate Limits */}
            <Section title="16. rate limits" figLabel="§ 3.16" delay={0}>
                <p>
                    Default: <strong style={{ color: "white" }}>7 requests/minute</strong> per API key.
                </p>
                <div style={{ marginTop: "12px" }}>
                    Exceeding the limit returns <code style={{ color: "#facc15" }}>429</code> with a{" "}
                    <code style={{ color: "#4ade80" }}>Retry-After: 60</code> header. The window resets
                    on a rolling 60-second basis.
                </div>
                <Note>
                    Requests that fail validation (401, 400) do not count toward the rate limit.
                    Only successfully authenticated requests are counted.
                </Note>
            </Section>

            {/* 17. Limitations */}
            <Section title="17. known limitations" figLabel="§ 3.17" delay={0}>
                <ul style={{ paddingLeft: "20px", listStyle: "disc", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <li>One media URL per request — send multiple images in separate requests</li>
                    <li>Media must be publicly accessible URLs — no base64 encoding or file uploads</li>
                    <li>Response times vary by tool complexity — research, visual guides, and deep_think may take 10-30 seconds</li>
                    <li>The agent responds in English — multilingual support is not guaranteed</li>
                    <li>Store finding and inventory verification depend on the user having a saved location</li>
                    <li>Generated images are temporary URLs — download and store them if you need persistence</li>
                </ul>
            </Section>
        </div>
    );
}
