import { useState, useRef, useEffect } from 'react';
import { BackButton } from '@/components/ui/back-button';

// ─── Constants ──────────────────────────────────────────────────────────────

const mono = "ui-monospace, monospace";
const pressStart = '"Press Start 2P", cursive';
const DENSITY_STEPS = ["█", "▓", "▒", "░", ""];
const DECRYPT_SPEED = 3;

// ─── Reusable Hooks ─────────────────────────────────────────────────────────

function useInView(threshold = 0.2, root?: React.RefObject<HTMLElement | null>) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold, root: root?.current ?? null }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, root]);

  return { ref, visible };
}

function revealStyle(visible: boolean, delay: number): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(12px)",
    transition: "all 800ms ease-out",
    transitionDelay: visible ? `${delay}ms` : "0ms",
  };
}

function useDecryptText(text: string, visible: boolean, charDelay = 1.5, skip = false) {
  const [decrypted, setDecrypted] = useState(text);
  const frameRef = useRef(0);

  useEffect(() => {
    if (skip) { setDecrypted(text); return; }
    if (!visible) { setDecrypted(text); return; }

    const chars = text.split('');
    let animationId: number;

    const animate = () => {
      frameRef.current++;
      const frame = frameRef.current;
      let allDone = true;

      const newText = chars.map((char, i) => {
        if (char === ' ') return ' ';
        const charFrames = frame - i * charDelay;
        if (charFrames < 0) { allDone = false; return DENSITY_STEPS[0]; }
        const cycles = Math.floor(charFrames / DECRYPT_SPEED);
        if (cycles >= DENSITY_STEPS.length) return char;
        allDone = false;
        return DENSITY_STEPS[Math.min(cycles, DENSITY_STEPS.length - 1)];
      }).join('');

      setDecrypted(newText);
      if (!allDone) animationId = requestAnimationFrame(animate);
    };

    frameRef.current = 0;
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [visible, text, charDelay, skip]);

  return decrypted;
}

// ─── Figure Annotation ──────────────────────────────────────────────────────

function FigureAnnotation({ label, visible }: { label: string; visible: boolean }) {
  return (
    <div
      className="absolute transition-all duration-600 ease-out z-10"
      style={{
        top: 40, right: 40,
        opacity: visible ? 0.35 : 0,
        transform: visible ? "translateY(0)" : "translateY(6px)",
        transitionDelay: visible ? "100ms" : "0ms",
        fontFamily: mono, fontSize: "11px", color: "white",
        letterSpacing: "0.12em",
      }}
    >
      {label}
    </div>
  );
}

// ─── Grain Overlay ──────────────────────────────────────────────────────────

function GrainOverlay() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-50"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        mixBlendMode: 'overlay',
      }}
    />
  );
}

// ─── Data Card ──────────────────────────────────────────────────────────────

function DataCard({ title, items, visible, delay }: { title: string; items: string[]; visible: boolean; delay: number }) {
  return (
    <div
      style={{
        ...revealStyle(visible, delay),
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '24px',
      }}
    >
      <div style={{ fontFamily: mono, fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', marginBottom: '16px', textTransform: 'uppercase' }}>
        {title}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontFamily: mono, fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.8' }}>
            <span style={{ color: 'rgba(255,255,255,0.2)', marginRight: '8px' }}>›</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Service Card ───────────────────────────────────────────────────────────

function ServiceCard({ name, purpose, visible, delay }: { name: string; purpose: string; visible: boolean; delay: number }) {
  return (
    <div
      style={{
        ...revealStyle(visible, delay),
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: '16px',
      }}
    >
      <span style={{ fontFamily: mono, fontSize: '14px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>{name}</span>
      <span style={{ fontFamily: mono, fontSize: '13px', color: 'rgba(255,255,255,0.35)', textAlign: 'right' }}>{purpose}</span>
    </div>
  );
}

// ─── Negation Item ──────────────────────────────────────────────────────────

function NegationItem({ text, visible, delay }: { text: string; visible: boolean; delay: number }) {
  return (
    <div style={{ ...revealStyle(visible, delay), display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 0' }}>
      <span style={{ fontFamily: mono, fontSize: '18px', color: 'rgba(255,255,255,0.25)' }}>✕</span>
      <span style={{ fontFamily: mono, fontSize: '15px', color: 'rgba(255,255,255,0.6)' }}>{text}</span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PRIVACY PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function Privacy() {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Section observers
  const s1 = useInView(0.3, scrollRef);
  const s2 = useInView(0.2, scrollRef);
  const s3 = useInView(0.2, scrollRef);
  const s4 = useInView(0.2, scrollRef);
  const s5 = useInView(0.2, scrollRef);
  const s6 = useInView(0.2, scrollRef);
  const s7 = useInView(0.2, scrollRef);

  // Decrypt titles
  const heroTitle = useDecryptText("TRUST & PRIVACY", s1.visible);
  const collectTitle = useDecryptText("WHAT WE COLLECT", s2.visible);
  const useTitle = useDecryptText("HOW WE USE IT", s3.visible);
  const thirdPartyTitle = useDecryptText("THIRD-PARTY SERVICES", s4.visible);
  const dontTitle = useDecryptText("WHAT WE DON'T DO", s5.visible);
  const controlsTitle = useDecryptText("YOUR CONTROLS", s6.visible);
  const contactTitle = useDecryptText("REACH OUT", s7.visible);

  const sectionStyle: React.CSSProperties = {
    minHeight: '100vh',
    scrollSnapAlign: 'start',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '80px 40px',
  };

  return (
    <div
      ref={scrollRef}
      className="bg-black min-h-screen"
      style={{
        overflowY: 'auto',
        scrollSnapType: 'y mandatory',
        height: '100vh',
      }}
    >
      <GrainOverlay />
      <BackButton theme="dark" onClick={() => window.history.back()} />

      {/* ── Section 1: Hero ─────────────────────────────────────────────── */}
      <section ref={s1.ref as React.RefObject<HTMLElement>} style={sectionStyle}>
        <FigureAnnotation label="FIG P.1" visible={s1.visible} />
        <div className="max-w-3xl mx-auto w-full text-center" style={revealStyle(s1.visible, 0)}>
          <h1
            style={{
              fontFamily: pressStart,
              fontSize: 'clamp(18px, 4vw, 32px)',
              color: 'white',
              letterSpacing: '0.08em',
              lineHeight: 1.6,
              marginBottom: '40px',
            }}
          >
            {heroTitle}
          </h1>
          <p style={{ fontFamily: mono, fontSize: '15px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.8, maxWidth: '520px', margin: '0 auto' }}>
            An honest look at what Orchid collects, how we use it, and what we'll never do. Written from the code, not by lawyers.
          </p>
          <div style={{ ...revealStyle(s1.visible, 400), marginTop: '60px', fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.15em' }}>
            LAST UPDATED — FEB 2026
          </div>
        </div>
      </section>

      {/* ── Section 2: What We Collect ──────────────────────────────────── */}
      <section ref={s2.ref as React.RefObject<HTMLElement>} style={sectionStyle}>
        <FigureAnnotation label="FIG P.2" visible={s2.visible} />
        <div className="max-w-3xl mx-auto w-full">
          <h2
            style={{
              ...revealStyle(s2.visible, 0),
              fontFamily: pressStart,
              fontSize: 'clamp(12px, 2.5vw, 18px)',
              color: 'white',
              letterSpacing: '0.06em',
              lineHeight: 1.6,
              marginBottom: '48px',
            }}
          >
            {collectTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DataCard
              title="Your Profile"
              items={[
                'Display name & experience level',
                'Personality preference',
                'Location & timezone',
                'Phone / WhatsApp number',
                'Telegram username',
                'Pet information',
              ]}
              visible={s2.visible}
              delay={100}
            />
            <DataCard
              title="Your Plants"
              items={[
                'Names, species & nicknames',
                'Photos you share',
                'Location in your home',
                'Care events & history',
                'Health diagnoses',
                'Reminders & schedules',
              ]}
              visible={s2.visible}
              delay={200}
            />
            <DataCard
              title="Conversations"
              items={[
                'Message content & timestamps',
                'Channel (iMessage, WhatsApp, Telegram, web)',
                'Conversation summaries',
                'Media you send',
              ]}
              visible={s2.visible}
              delay={300}
            />
            <DataCard
              title="Learned Insights"
              items={[
                'Preferences extracted from conversations',
                'Care patterns we notice',
                'Proactive message history',
                'Notification preferences',
              ]}
              visible={s2.visible}
              delay={400}
            />
          </div>
        </div>
      </section>

      {/* ── Section 3: How We Use It ───────────────────────────────────── */}
      <section ref={s3.ref as React.RefObject<HTMLElement>} style={sectionStyle}>
        <FigureAnnotation label="FIG P.3" visible={s3.visible} />
        <div className="max-w-3xl mx-auto w-full">
          <h2
            style={{
              ...revealStyle(s3.visible, 0),
              fontFamily: pressStart,
              fontSize: 'clamp(12px, 2.5vw, 18px)',
              color: 'white',
              letterSpacing: '0.06em',
              lineHeight: 1.6,
              marginBottom: '48px',
            }}
          >
            {useTitle}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={revealStyle(s3.visible, 100)}>
              <div style={{ fontFamily: mono, fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
                AI Processing
              </div>
              <p style={{ fontFamily: mono, fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                Your photos and messages are sent to AI models to identify plants, diagnose issues, and have natural conversations about care. We use your conversation history to maintain context — so Orchid remembers what you've talked about.
              </p>
            </div>
            <div style={revealStyle(s3.visible, 200)}>
              <div style={{ fontFamily: mono, fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
                Memory & Learning
              </div>
              <p style={{ fontFamily: mono, fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                Orchid extracts insights from your conversations — things like "prefers bottom watering" or "has a cat that chews leaves." These are stored so the AI can give you genuinely personal advice, not generic care sheets.
              </p>
            </div>
            <div style={revealStyle(s3.visible, 300)}>
              <div style={{ fontFamily: mono, fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
                Proactive Care
              </div>
              <p style={{ fontFamily: mono, fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                We use your location and plant data to send timely reminders — watering schedules, seasonal tips, weather-based alerts. You control which topics trigger messages and can set quiet hours.
              </p>
            </div>
            <div style={revealStyle(s3.visible, 400)}>
              <div style={{ fontFamily: mono, fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
                Research
              </div>
              <p style={{ fontFamily: mono, fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                When Orchid needs current information — like finding a nearby nursery or researching a rare species — it searches the web on your behalf. Your query context is sent to the search provider, not your personal details.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Third-Party Services ────────────────────────────── */}
      <section ref={s4.ref as React.RefObject<HTMLElement>} style={sectionStyle}>
        <FigureAnnotation label="FIG P.4" visible={s4.visible} />
        <div className="max-w-3xl mx-auto w-full">
          <h2
            style={{
              ...revealStyle(s4.visible, 0),
              fontFamily: pressStart,
              fontSize: 'clamp(10px, 2vw, 16px)',
              color: 'white',
              letterSpacing: '0.06em',
              lineHeight: 1.6,
              marginBottom: '48px',
            }}
          >
            {thirdPartyTitle}
          </h2>
          <p style={{ ...revealStyle(s4.visible, 50), fontFamily: mono, fontSize: '14px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.8, marginBottom: '32px' }}>
            These are the services your data touches. Nothing else.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <ServiceCard name="Google Gemini" purpose="AI — identification, diagnosis, conversation" visible={s4.visible} delay={100} />
            <ServiceCard name="Perplexity Sonar" purpose="Web search — nursery finding, care research" visible={s4.visible} delay={150} />
            <ServiceCard name="Twilio" purpose="Messaging — SMS & WhatsApp delivery" visible={s4.visible} delay={200} />
            <ServiceCard name="Telegram Bot API" purpose="Messaging — Telegram delivery" visible={s4.visible} delay={250} />
            <ServiceCard name="Cloud Database" purpose="Storage — your data, auth, plant photos" visible={s4.visible} delay={300} />
          </div>
        </div>
      </section>

      {/* ── Section 5: What We Don't Do ────────────────────────────────── */}
      <section ref={s5.ref as React.RefObject<HTMLElement>} style={sectionStyle}>
        <FigureAnnotation label="FIG P.5" visible={s5.visible} />
        <div className="max-w-3xl mx-auto w-full">
          <h2
            style={{
              ...revealStyle(s5.visible, 0),
              fontFamily: pressStart,
              fontSize: 'clamp(12px, 2.5vw, 18px)',
              color: 'white',
              letterSpacing: '0.06em',
              lineHeight: 1.6,
              marginBottom: '48px',
            }}
          >
            {dontTitle}
          </h2>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <NegationItem text="No analytics or tracking scripts" visible={s5.visible} delay={100} />
            <NegationItem text="No Google Analytics, no telemetry, no pixels" visible={s5.visible} delay={150} />
            <NegationItem text="No ad networks — ever" visible={s5.visible} delay={200} />
            <NegationItem text="No selling or sharing your data with third parties" visible={s5.visible} delay={250} />
            <NegationItem text="No cookies beyond your login session" visible={s5.visible} delay={300} />
            <NegationItem text="No training our own models on your conversations" visible={s5.visible} delay={350} />
          </div>
          <p style={{ ...revealStyle(s5.visible, 500), fontFamily: mono, fontSize: '13px', color: 'rgba(255,255,255,0.3)', lineHeight: 1.8, marginTop: '40px' }}>
            You can verify this yourself. There are zero tracking scripts in the codebase. No analytics endpoints. No fingerprinting. The code is the proof.
          </p>
        </div>
      </section>

      {/* ── Section 6: Your Controls ───────────────────────────────────── */}
      <section ref={s6.ref as React.RefObject<HTMLElement>} style={sectionStyle}>
        <FigureAnnotation label="FIG P.6" visible={s6.visible} />
        <div className="max-w-3xl mx-auto w-full">
          <h2
            style={{
              ...revealStyle(s6.visible, 0),
              fontFamily: pressStart,
              fontSize: 'clamp(12px, 2.5vw, 18px)',
              color: 'white',
              letterSpacing: '0.06em',
              lineHeight: 1.6,
              marginBottom: '48px',
            }}
          >
            {controlsTitle}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={revealStyle(s6.visible, 100)}>
              <div style={{ fontFamily: mono, fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
                Profile & Preferences
              </div>
              <p style={{ fontFamily: mono, fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                Edit or remove any profile information from your settings at any time. Change your personality preference, update your location, or remove your phone number.
              </p>
            </div>
            <div style={revealStyle(s6.visible, 200)}>
              <div style={{ fontFamily: mono, fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
                Notification Control
              </div>
              <p style={{ fontFamily: mono, fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                Toggle proactive messages by topic. Set quiet hours. Turn off all notifications entirely. Orchid only reaches out when you want it to.
              </p>
            </div>
            <div style={revealStyle(s6.visible, 300)}>
              <div style={{ fontFamily: mono, fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
                Data Deletion
              </div>
              <p style={{ fontFamily: mono, fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                Ask Orchid to forget specific plants or clear conversation history.
              </p>
            </div>
            <div style={revealStyle(s6.visible, 400)}>
              <div style={{ fontFamily: mono, fontSize: '11px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase' }}>
                Agent Permissions
              </div>
              <p style={{ fontFamily: mono, fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
                You control what Orchid can do — read plants, manage reminders, search the web, send messages. Each capability can be individually enabled or disabled.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 7: Contact ─────────────────────────────────────────── */}
      <section ref={s7.ref as React.RefObject<HTMLElement>} style={sectionStyle}>
        <FigureAnnotation label="FIG P.7" visible={s7.visible} />
        <div className="max-w-3xl mx-auto w-full text-center">
          <h2
            style={{
              ...revealStyle(s7.visible, 0),
              fontFamily: pressStart,
              fontSize: 'clamp(12px, 2.5vw, 18px)',
              color: 'white',
              letterSpacing: '0.06em',
              lineHeight: 1.6,
              marginBottom: '48px',
            }}
          >
            {contactTitle}
          </h2>
          <p style={{ ...revealStyle(s7.visible, 100), fontFamily: mono, fontSize: '15px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, marginBottom: '32px' }}>
            Questions about your data, privacy concerns, or deletion requests:
          </p>
          <a
            href="mailto:privacy@orchid.care"
            style={{
              ...revealStyle(s7.visible, 200),
              fontFamily: mono,
              fontSize: '16px',
              color: 'rgba(255,255,255,0.7)',
              textDecoration: 'underline',
              textUnderlineOffset: '4px',
              textDecorationColor: 'rgba(255,255,255,0.2)',
            }}
          >
            privacy@orchid.care
          </a>
          <p style={{ ...revealStyle(s7.visible, 400), fontFamily: mono, fontSize: '12px', color: 'rgba(255,255,255,0.2)', marginTop: '80px', letterSpacing: '0.1em' }}>
            This policy reflects the actual codebase as of February 2026.
          </p>
        </div>
      </section>
    </div>
  );
}
