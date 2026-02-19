import { useState, useEffect, useRef } from "react";
import { Image as ImageIcon } from "lucide-react";

const SICK_PLANT_PHOTO = "/mites_palm.png";

const mono = "ui-monospace, monospace";

const orchidPixelBW = "/botanical-pixels/115bb6b0b253fffe4442e446bcfb3e03619f32d4.png";

// ─── Fake bot responses ─────────────────────────────────────────────────────

const diagnosisResponse = {
  issue: "SPIDER MITES",
  confidence: "98% MATCH",
  symptoms: ["Webbing", "Speckled Leaves"],
  body: "These tiny pests suck sap, causing stippling. They thrive in dry air.",
  treatment: [
    "Isolate immediately.",
    "Wipe leaves with cloth.",
    "Apply neem oil weekly — I can remind you.",
  ],
};

// ─── Bubble components (Duplicated from identify-feature for isolation) ─────

function ChatBubbleUser({
  children,
  time,
  visible,
  delay,
}: {
  children: React.ReactNode;
  time?: string;
  visible: boolean;
  delay: number;
}) {
  return (
    <div
      className="flex flex-col items-end transition-all duration-500 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transitionDelay: visible ? `${delay}ms` : "0ms",
      }}
    >
      {children}
      {time && (
        <span
          className="mt-1 opacity-30"
          style={{ fontFamily: mono, fontSize: "10px", color: "white" }}
        >
          {time}
        </span>
      )}
    </div>
  );
}

function ChatBubbleOrchid({
  children,
  time,
  visible,
  delay,
}: {
  children: React.ReactNode;
  time?: string;
  visible: boolean;
  delay: number;
}) {
  return (
    <div
      className="flex flex-col items-start transition-all duration-500 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transitionDelay: visible ? `${delay}ms` : "0ms",
      }}
    >
      {children}
      {time && (
        <span
          className="mt-1 opacity-30"
          style={{ fontFamily: mono, fontSize: "10px", color: "white" }}
        >
          {time}
        </span>
      )}
    </div>
  );
}

// ─── Diagnosis Card ─────────────────────────────────────────────────────────

function DiagnosisCard({ data }: { data: typeof diagnosisResponse }) {
  return (
    <div
      className="flex flex-col gap-3 w-full"
      style={{
        border: "1px solid rgba(255,255,255,0.15)",
        padding: "16px",
        maxWidth: 400,
        backgroundColor: "rgba(0,0,0,0.3)",
      }}
    >
      <div className="flex justify-between items-start">
        <div className="flex flex-col">
          <span
            style={{
              fontFamily: mono,
              fontSize: "10px",
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "1px",
              marginBottom: 4,
            }}
          >
            DIAGNOSIS
          </span>
          <span
            style={{
              fontFamily: mono,
              fontWeight: "bold",
              fontSize: "14px",
              color: "white",
              letterSpacing: "-0.02em",
            }}
          >
            {data.issue}
          </span>
        </div>
        <div
          style={{
            fontFamily: mono,
            fontSize: "10px",
            color: "rgba(255,255,255,0.8)",
            border: "1px solid rgba(255,255,255,0.3)",
            padding: "2px 6px",
          }}
        >
          {data.confidence}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {data.symptoms.map((tag) => (
          <span
            key={tag}
            style={{
              fontFamily: mono,
              fontSize: "10px",
              color: "black",
              backgroundColor: "white",
              padding: "2px 6px",
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      <div
        style={{
          fontFamily: mono,
          fontSize: "12px",
          color: "rgba(255,255,255,0.7)",
          lineHeight: 1.6,
        }}
      >
        {data.body}
      </div>

      <div
        style={{
          fontFamily: mono,
          fontSize: "12px",
          color: "rgba(255,255,255,0.8)",
          lineHeight: 1.6,
          borderLeft: "2px solid rgba(255,255,255,0.3)",
          paddingLeft: 12,
          marginTop: 2,
        }}
      >
        <div style={{ opacity: 0.5, marginBottom: 4, fontSize: "10px" }}>TREATMENT PLAN:</div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {data.treatment.map((step, i) => (
                <li key={i} style={{ marginBottom: 4 }}>{i + 1}. {step}</li>
            ))}
        </ul>
      </div>
    </div>
  );
}


// ─── Mock Diagnosis Chat ────────────────────────────────────────────────────

interface MediaFile {
  id: string;
  file: File;
  preview: string;
  type: string;
}

// Interactive message types
type LiveMessage =
  | { type: "user-text"; text: string; time: string; media?: { type: string; preview: string }[] }
  | { type: "typing" }
  | { type: "bot-text"; text: string; time: string }
  | { type: "bot-id"; data: typeof diagnosisResponse; time: string }; // Reusing diagnosisResponse type

function MockDiagnosisChat({
  visible,
  interactive,
}: {
  visible: boolean;
  interactive: boolean;
}) {
  // Demo state
  const [demoStep, setDemoStep] = useState(0);

  // Interactive state
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    // If container available, scroll it
    if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [liveMessages, demoStep]);

  // Demo sequence
  useEffect(() => {
    if (visible && !interactive) {
      if (demoStep === 0) setTimeout(() => setDemoStep(1), 500);
    }
  }, [visible, interactive, demoStep]);

  useEffect(() => {
    if (!interactive && demoStep >= 1 && demoStep < 2) {
      const timer = setTimeout(() => {
        setDemoStep(2);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [demoStep, interactive]);

  // Auto-focus input when interactive mode activates
  useEffect(() => {
    if (interactive) {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [interactive]);

  const now = () => {
    const d = new Date();
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h > 12 ? h - 12 : h || 12}:${m} ${ampm}`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const preview = URL.createObjectURL(file);
      setMediaFiles((prev) => [
        ...prev,
        { id: Math.random().toString(), file, preview, type: file.type },
      ]);
      e.target.value = "";
    }
  };

  const removeMedia = (id: string) => {
    setMediaFiles((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSend = () => {
    if (!inputValue.trim() && mediaFiles.length === 0) return;

    const newMsg: LiveMessage = {
      type: "user-text",
      text: inputValue,
      time: now(),
      media: mediaFiles.map((m) => ({ type: m.type, preview: m.preview })),
    };

    setLiveMessages((prev) => [...prev, newMsg]);
    setInputValue("");
    setMediaFiles([]);
    setIsLoading(true);

    setTimeout(() => {
      setLiveMessages((prev) => [...prev, { type: "typing" }]);
      scrollToBottom();
      
      setTimeout(() => {
         setLiveMessages((prev) => prev.filter(m => m.type !== "typing"));
         setLiveMessages((prev) => [
             ...prev, 
             { type: "bot-text", text: "This feature is currently in demo mode. In the full version, I would diagnose your plant essentially instantly.", time: now() }
         ]);
         setIsLoading(false);
         scrollToBottom();
      }, 1500);

    }, 600);
  };

  return (
    <div
      className="relative flex flex-col transition-all duration-500"
      style={{
        width: "100%",
        maxWidth: 400,
        border: "1px solid rgba(255,255,255,0.12)",
        maxHeight: interactive ? "70vh" : "none",
        minHeight: interactive ? 500 : 0
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: 32,
            height: 32,
            border: "1px solid rgba(255,255,255,0.2)",
            backgroundColor: "rgba(255,255,255,0.05)",
          }}
        >
          <img
            src={orchidPixelBW}
            alt=""
            style={{ width: 18, imageRendering: "pixelated", opacity: 0.8 }}
          />
        </div>
        <div>
          <div
            style={{
              fontFamily: mono,
              fontSize: "13px",
              color: "white",
              letterSpacing: "0.08em",
            }}
          >
            ORCHID
          </div>
          <div
            style={{
              fontFamily: mono,
              fontSize: "10px",
              color: interactive
                ? "rgba(255,255,255,0.6)"
                : "rgba(255,255,255,0.35)",
              transition: "color 300ms",
            }}
          >
            {interactive ? "active now" : "iMessage"}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex flex-col gap-4 px-5 py-5"
        style={{
            overflowY: interactive ? "auto" : "visible",
            flex: interactive ? 1 : "none",
            minHeight: 0,
        }}
      >
        {/* Demo Mode Content */}
        {!interactive && (
          <>
            <ChatBubbleUser visible={demoStep >= 1} delay={0} time="10:42 AM">
              <div className="flex flex-col items-end gap-2">
                <div
                    className="overflow-hidden"
                    style={{
                    border: "1px solid rgba(255,255,255,0.15)",
                    padding: "0",
                    width: 160,
                    height: 160,
                    }}
                >
                    <img
                    src={SICK_PLANT_PHOTO}
                    alt="Sick Plant"
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                        filter: "contrast(1.05)",
                    }}
                    />
                </div>
                <div
                    style={{
                    padding: "10px 14px",
                    backgroundColor: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    fontFamily: mono,
                    fontSize: "13px",
                    color: "white",
                    }}
                >
                    My palm looks sad. Are these webs??
                </div>
              </div>
            </ChatBubbleUser>

             {/* Diagnostics Phase */}
             {/* Note: We skip a visible typing phase for simplicity in the demo flow or add it if strictly needed, 
                 but standard mock usually jumps to result in these reliable animations. 
                 The Identify component had a delay=400 for the response. */}
            
            <ChatBubbleOrchid visible={demoStep >= 2} delay={0} time="10:43 AM">
                <DiagnosisCard data={diagnosisResponse} />
            </ChatBubbleOrchid>
          </>
        )}

        {/* Interactive Mode Content */}
        {interactive && liveMessages.length === 0 && (
             <ChatBubbleOrchid visible={true} delay={0} time={now()}>
                <div
                style={{
                    padding: "10px 14px",
                    backgroundColor: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    fontFamily: mono,
                    fontSize: "13px",
                    color: "white",
                    lineHeight: 1.6,
                }}
                >
                Orchid Diagnosis is active. Describe your plant&apos;s symptoms or upload a photo.
                </div>
            </ChatBubbleOrchid>
        )}

        {interactive && liveMessages.map((msg, i) => {
             if (msg.type === "user-text") {
                return (
                  <ChatBubbleUser key={i} time={msg.time} visible={true} delay={0}>
                    <div className="flex flex-col items-end gap-2">
                       {/* Media */}
                       {msg.media && msg.media.length > 0 && (
                        <div className="flex gap-2">
                          {msg.media.map((m, idx) => (
                            <div
                              key={idx}
                              style={{
                                border: "1px solid rgba(255,255,255,0.15)",
                                overflow: "hidden",
                                width: 120,
                                height: 120,
                              }}
                            >
                                <img
                                  src={m.preview}
                                  alt="Uploaded media"
                                  className="w-full h-full object-cover"
                                />
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {msg.text && (
                        <div
                            style={{
                            padding: "10px 14px",
                            backgroundColor: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            fontFamily: mono,
                            fontSize: "13px",
                            color: "white",
                            }}
                        >
                            {msg.text}
                        </div>
                      )}
                    </div>
                  </ChatBubbleUser>
                );
              }
              if (msg.type === "typing") {
                return (
                  <ChatBubbleOrchid key={`typing-${i}`} visible={true} delay={0}>
                    <div
                      className="flex gap-1 items-center"
                      style={{ padding: "10px 14px" }}
                    >
                      {[0, 1, 2].map((dot) => (
                        <span
                          key={dot}
                          style={{
                            width: 6,
                            height: 6,
                            backgroundColor: "rgba(255,255,255,0.4)",
                            display: "inline-block",
                            animation: `pulse 1s ease-in-out ${dot * 0.15}s infinite`,
                          }}
                        />
                      ))}
                    </div>
                  </ChatBubbleOrchid>
                );
              }
              if (msg.type === "bot-text") {
                return (
                  <ChatBubbleOrchid key={i} visible={true} delay={0} time={msg.time}>
                    <div
                      style={{
                        padding: "10px 14px",
                        backgroundColor: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        fontFamily: mono,
                        fontSize: "13px",
                        color: "white",
                        lineHeight: 1.6,
                        maxWidth: 400,
                      }}
                    >
                      {msg.text}
                    </div>
                  </ChatBubbleOrchid>
                );
              }
              return null;
        })}

        <div ref={messagesEndRef} />
      </div>
      
      {/* Input bar (interactive mode only) */}
      <div
        className="flex-shrink-0 overflow-hidden transition-all duration-500 ease-out"
        style={{
          maxHeight: interactive ? (mediaFiles.length > 0 ? 180 : 60) : 0,
          opacity: interactive ? 1 : 0,
          borderTop: interactive
            ? "1px solid rgba(255,255,255,0.08)"
            : "none",
        }}
      >
         {/* Media Previews */}
         {mediaFiles.length > 0 && (
          <div className="px-4 pt-3 pb-2 flex gap-2 overflow-x-auto">
            {mediaFiles.map((media) => (
              <div key={media.id} className="relative flex-shrink-0">
                  <img
                    src={media.preview}
                    alt="Upload preview"
                    className="w-20 h-20 object-cover"
                    style={{ border: "1px solid rgba(255,255,255,0.15)" }}
                  />
                <button
                  onClick={() => removeMedia(media.id)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-white text-black flex items-center justify-center text-xs font-bold cursor-pointer hover:bg-red-500 hover:text-white transition-colors"
                  style={{ border: "1px solid rgba(255,255,255,0.3)" }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input + buttons */}
        <div className="flex items-center gap-2 px-4 py-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer transition-colors duration-150 hover:bg-white hover:text-black flex-shrink-0"
            style={{
              padding: "8px",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color: "white",
            }}
            title="Upload image"
          >
            <ImageIcon size={16} />
          </button>
          
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSend()}
            placeholder="Describe symptoms..."
            disabled={isLoading}
            style={{
              flex: 1,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.12)",
              padding: "8px 12px",
              fontFamily: mono,
              fontSize: "12px",
              color: "white",
              outline: "none",
            }}
          />
          
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="cursor-pointer transition-colors duration-150 hover:bg-white hover:text-black disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            style={{
              fontFamily: mono,
              fontSize: "11px",
              color: "white",
              letterSpacing: "0.06em",
              padding: "8px 14px",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              whiteSpace: "nowrap",
            }}
          >
            {isLoading ? "..." : "SEND →"}
          </button>
        </div>
      </div>
      
       {/* Typing dot animation */}
       <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>

    </div>
  );
}

// ─── Feature Description ────────────────────────────────────────────────────

function FeatureDescription({
  visible,
  interactive,
  onActivate,
}: {
  visible: boolean;
  interactive: boolean;
  onActivate: () => void;
}) {
  const revealStyle = (delay: number): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(12px)",
    transition: "all 600ms ease-out",
    transitionDelay: visible ? `${delay}ms` : "0ms",
  });

  return (
    <div
      className="flex flex-col transition-opacity duration-500"
      style={{
        maxWidth: 440,
        opacity: interactive ? 0.2 : 1,
        pointerEvents: interactive ? "none" : "auto",
      }}
    >
      {/* Heading */}
      <h2
        style={{
          ...revealStyle(0),
          fontFamily: '"Press Start 2P", cursive',
          fontSize: "32px",
          lineHeight: 1.4,
          color: "white",
        }}
      >
        Diagnosis &<br />
        Treatment
      </h2>

      {/* Tagline */}
      <p
        style={{
          ...revealStyle(150),
          fontFamily: mono,
          fontSize: "15px",
          color: "rgba(255,255,255,0.5)",
          marginTop: 20,
          fontStyle: "italic",
        }}
      >
        Something wrong? We'll figure it out.
      </p>

      {/* Body */}
      <p
        style={{
          ...revealStyle(300),
          fontFamily: mono,
          fontSize: "13px",
          color: "rgba(255,255,255,0.7)",
          lineHeight: 1.8,
          marginTop: 24,
          maxWidth: 400,
        }}
      >
        Text a photo of spots, webbing, or pests. Orchid analyzes visual symptoms to provide an instant diagnosis and a step-by-step treatment plan.
      </p>
      
      {/* CTA button */}
      <div style={revealStyle(450)}>
        <button
          onClick={onActivate}
          className="mt-8 cursor-pointer transition-colors duration-200 hover:bg-white hover:text-black"
          style={{
            fontFamily: mono,
            fontSize: "13px",
            color: "white",
            letterSpacing: "0.06em",
            padding: "14px 24px",
            border: "1px solid rgba(255,255,255,0.3)",
            background: "transparent",
          }}
        >
          TRY WITHOUT SIGNING IN →
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface DiagnosisFeatureProps {
  className?: string;
  scrollRoot?: React.RefObject<HTMLElement | null>;
}

export function DiagnosisFeature({
  className = "",
  scrollRoot,
}: DiagnosisFeatureProps) {
  const [visible, setVisible] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
        }
      },
      { threshold: 0.2, root: scrollRoot?.current ?? null }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  return (
    <section
      ref={sectionRef}
      className={`relative min-h-screen w-full flex flex-col justify-center ${className}`}
      style={{ backgroundColor: "black" }} // Consistent dark bg
    >
      {/* Figure annotation label */}
      <div
        className="absolute transition-all duration-600 ease-out"
        style={{
          top: 40,
          right: 40,
          opacity: visible ? 0.35 : 0,
          transform: visible ? "translateY(0)" : "translateY(6px)",
          transitionDelay: visible ? "100ms" : "0ms",
          fontFamily: mono,
          fontSize: "11px",
          color: "white",
          letterSpacing: "0.12em",
        }}
      >
        FIG 2.2 — DIAGNOSTIC PROTOCOL
      </div>

      {/* Content grid */}
      <div className="w-full px-10 md:px-16 lg:px-24 py-20">
        <div className="flex flex-col md:flex-row items-center gap-8 lg:gap-12 max-w-[1100px] mx-auto">
            
           {/* Left: Description */}
           <div className="flex items-center flex-1 min-w-0 order-2 md:order-1">
             <FeatureDescription 
                visible={visible} 
                interactive={interactive}
                onActivate={() => setInteractive(true)}
              />
          </div>

          {/* Right: Interface */}
          <div className="flex-shrink-0 flex-1 min-w-0 max-w-[400px] order-1 md:order-2 self-center">
            <div
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(20px)",
                transition: "all 800ms ease-out",
                transitionDelay: "200ms",
                width: "100%",
              }}
            >
              <MockDiagnosisChat visible={visible} interactive={interactive} />
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
}
