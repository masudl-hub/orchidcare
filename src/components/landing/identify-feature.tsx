import { useState, useEffect, useRef, useCallback } from "react";
import { Image as ImageIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

const orchidPixelBW = "/botanical-pixels/115bb6b0b253fffe4442e446bcfb3e03619f32d4.png";

// ─── iMessage-style chat mock in botanical pixels ───────────────────────────

const MONSTERA_PHOTO =
  "https://images.unsplash.com/photo-1739288633830-a5173a18718b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb25zdGVyYSUyMGRlbGljaW9zYSUyMHBsYW50JTIwaW5kb29yJTIwcG90dGVkfGVufDF8fHx8MTc3MTExOTEwNnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

const mono = "ui-monospace, monospace";

// ─── Fake bot responses ─────────────────────────────────────────────────────

const fakeResponses = [
  {
    name: "POTHOS (EPIPREMNUM AUREUM)",
    common: "Devil's Ivy",
    confidence: "95% MATCH",
    tags: ["LOW-LIGHT"],
    body: "Nearly indestructible — perfect for dim corners. Yours looks like it could use a trim though; those trailing vines will get leggy without pruning.",
    alert: "Mildly toxic to pets if ingested. Keep it on a high shelf.",
    followUp: "Want watering reminders for this one?",
  },
  {
    name: "FICUS LYRATA",
    common: "Fiddle-Leaf Fig",
    confidence: "91% MATCH",
    tags: ["BRIGHT INDIRECT"],
    body: "Dramatic but worth it. Rotate it quarterly so it doesn't lean. Brown edges usually mean low humidity, not overwatering.",
    alert: "Toxic to cats and dogs — keep out of reach.",
    followUp: "I can track its growth if you add it to your collection.",
  },
  {
    name: "SANSEVIERIA TRIFASCIATA",
    common: "Snake Plant",
    confidence: "97% MATCH",
    tags: ["DROUGHT-TOLERANT"],
    body: "Thrives on neglect. Water every 2–3 weeks max — root rot is the #1 killer. Great air purifier for bedrooms.",
    alert: "Mildly toxic to pets. Symptoms are usually mild.",
    followUp: "Should I set up a low-frequency watering schedule?",
  },
];

// ─── Bubble components ──────────────────────────────────────────────────────

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

// ─── Identification card (reused for demo + interactive replies) ────────────

function IdentificationCard({
  name,
  common,
  confidence,
  tags,
  body,
  alert,
  followUp,
}: {
  name: string;
  common: string;
  confidence: string;
  tags: string[];
  body: string;
  alert: string;
  followUp: string;
}) {
  return (
    <div
      className="flex flex-col gap-3 w-full"
      style={{
        border: "1px solid rgba(255,255,255,0.15)",
        padding: "16px",
        maxWidth: 400,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: mono,
            fontSize: "14px",
            color: "white",
            letterSpacing: "0.02em",
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontFamily: mono,
            fontSize: "11px",
            color: "rgba(255,255,255,0.45)",
            marginTop: 2,
          }}
        >
          {common}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <span
          style={{
            fontFamily: mono,
            fontSize: "10px",
            color: "white",
            border: "1px solid rgba(255,255,255,0.3)",
            padding: "3px 8px",
            letterSpacing: "0.06em",
            backgroundColor: "rgba(255,255,255,0.06)",
          }}
        >
          {confidence}
        </span>
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              fontFamily: mono,
              fontSize: "10px",
              color: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "3px 8px",
              letterSpacing: "0.06em",
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
        {body}
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
        {alert}
      </div>

      <div
        style={{
          fontFamily: mono,
          fontSize: "12px",
          color: "rgba(255,255,255,0.5)",
          marginTop: 4,
        }}
      >
        {followUp}
      </div>
    </div>
  );
}

// ─── Interactive message types ──────────────────────────────────────────────

type LiveMessage =
  | { type: "user-text"; text: string; time: string; media?: { type: string; preview: string }[] }
  | { type: "typing" }
  | { type: "bot-text"; text: string; time: string }
  | { type: "bot-id"; data: (typeof fakeResponses)[number]; time: string };

// ─── Mock chat ──────────────────────────────────────────────────────────────

interface MediaFile {
  id: string;
  file: File;
  preview: string;
  type: string;
}

function MockChat({
  visible,
  interactive,
}: {
  visible: boolean;
  interactive: boolean;
}) {
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const responseIdx = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [liveMessages, scrollToBottom]);

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
    const files = Array.from(e.target.files || []);
    
    files.forEach(file => {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = () => {
          const newMedia: MediaFile = {
            id: `${Date.now()}-${Math.random()}`,
            file,
            preview: reader.result as string,
            type: file.type,
          };
          setMediaFiles(prev => [...prev, newMedia]);
        };
        reader.readAsDataURL(file);
      }
    });
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeMedia = (id: string) => {
    setMediaFiles(prev => prev.filter(m => m.id !== id));
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text && mediaFiles.length === 0) return;

    const time = now();
    
    // Add user message with media
    const userMessageContent: LiveMessage = { 
      type: "user-text", 
      text, 
      time,
      media: mediaFiles.map(m => ({ type: m.type, preview: m.preview })),
    };
    setLiveMessages((prev) => [...prev, userMessageContent]);
    setInputValue("");
    const currentMedia = [...mediaFiles];
    setMediaFiles([]);
    setIsLoading(true);

    // Show typing indicator
    setTimeout(() => {
      setLiveMessages((prev) => [...prev, { type: "typing" }]);
    }, 400);

    try {
      // Prepare media for API
      const mediaForApi = await Promise.all(
        currentMedia.map(async (m) => {
          const base64 = m.preview.split(',')[1];
          return { type: m.type, data: base64 };
        })
      );
      
      // Build conversation history
      const conversationHistory = liveMessages
        .filter(m => m.type === "user-text" || m.type === "bot-id" || m.type === "bot-text")
        .map(m => {
          if (m.type === "user-text") {
            return { role: "user" as const, content: m.text };
          } else if (m.type === "bot-text") {
            return { role: "assistant" as const, content: m.text };
          } else if (m.type === "bot-id") {
            // Extract meaningful content from structured identification
            const summary = `I identified this as ${m.data.name}. ${m.data.body}`;
            return { role: "assistant" as const, content: summary };
          }
          return { role: "assistant" as const, content: "" };
        });
      conversationHistory.push({ role: "user", content: text });
      
      // Call demo-agent
      const { data, error } = await supabase.functions.invoke('demo-agent', {
        body: {
          messages: conversationHistory,
          media: mediaForApi.length > 0 ? mediaForApi : undefined,
          exchangeCount: liveMessages.filter(m => m.type === "bot-id").length,
        },
      });
      
      if (error) throw error;
      
      // Remove typing indicator and add response
      setTimeout(() => {
        setLiveMessages((prev) => {
          const withoutTyping = prev.filter((m) => m.type !== "typing");
          
          // Use actual API response content
          const content = data?.content || "I'm having trouble responding. Please try again.";
          
          // Try to parse as structured identification response
          // The demo-agent might return structured data or plain text
          let parsedResponse;
          
          try {
            // Check if content contains JSON-like structure
            const jsonMatch = content.match(/\{[\s\S]*"species"[\s\S]*\}/);
            if (jsonMatch) {
              parsedResponse = JSON.parse(jsonMatch[0]);
            }
          } catch (e) {
            // Not JSON, treat as plain text
          }
          
          // If we got structured identification data, format it
          if (parsedResponse && parsedResponse.species) {
            const identificationData = {
              name: parsedResponse.species || "Unknown",
              common: parsedResponse.commonNames?.[0] || "",
              confidence: parsedResponse.confidence 
                ? `${Math.round(parsedResponse.confidence * 100)}% MATCH`
                : "ANALYZED",
              tags: parsedResponse.tags || [],
              body: parsedResponse.careSummary || content,
              alert: parsedResponse.petSafety || "",
              followUp: parsedResponse.followUp || "Want to know more?",
            };
            return [...withoutTyping, { type: "bot-id", data: identificationData, time: now() }];
          } else {
            // Plain text response - display as text bubble from bot
            return [...withoutTyping, { 
              type: "bot-text", 
              text: content,
              time: now() 
            }];
          }
        });
        setIsLoading(false);
      }, 1600);
      
    } catch (err) {
      console.error('Demo agent error:', err);
      setLiveMessages((prev) => {
        const withoutTyping = prev.filter((m) => m.type !== "typing");
        return [...withoutTyping, { 
          type: "bot-text", 
          text: "Oops, something went wrong! Try asking me about plant care or send a photo of your plant. 🌱",
          time: now() 
        }];
      });
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative flex flex-col transition-all duration-500"
      style={{
        width: "100%",
        maxWidth: 400,
        border: "1px solid rgba(255,255,255,0.12)",
        maxHeight: interactive ? "70vh" : "none",
      }}
    >
      {/* Chat header */}
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

      {/* Messages (scrollable when interactive) */}
      <div
        className="flex flex-col gap-4 px-5 py-5"
        style={{
          overflowY: interactive ? "auto" : "visible",
          flex: interactive ? 1 : "none",
          minHeight: 0,
        }}
      >
        {/* Show demo messages only when NOT interactive */}
        {!interactive && (
          <>
            {/* Demo: User photo + text (single group, one timestamp) */}
            <ChatBubbleUser time="10:32 AM" visible={visible} delay={0}>
              <div className="flex flex-col items-end gap-2">
                <div
                  style={{
                    border: "1px solid rgba(255,255,255,0.15)",
                    overflow: "hidden",
                    width: 160,
                    height: 160,
                  }}
                >
                  <img
                    src={MONSTERA_PHOTO}
                    alt="Monstera photo"
                    className="w-full h-full object-cover"
                    style={{ filter: "contrast(1.05)" }}
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
                  What plant is this?
                </div>
              </div>
            </ChatBubbleUser>

            {/* Demo: Orchid identification response */}
            <ChatBubbleOrchid visible={visible} delay={400} time="10:33 AM">
              <IdentificationCard
                name="MONSTERA DELICIOSA"
                common="Swiss Cheese Plant"
                confidence="98% MATCH"
                tags={["TROPICAL"]}
                body="Since Monsteras are drought-tolerant, they're actually a solid pick for you since you tend to underwater (no shade)."
                alert="Heads up: toxic to cats. I've got placement ideas to keep Ellie safe."
                followUp="Want me to add this to your collection?"
              />
            </ChatBubbleOrchid>
          </>
        )}

        {/* Show greeting when interactive starts */}
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
              Hey! Send me a photo of a plant and I'll identify it for you. You can also ask me questions about plant care. 🌱
            </div>
          </ChatBubbleOrchid>
        )}

        {/* Live messages (interactive mode) */}
        {liveMessages.map((msg, i) => {
          if (msg.type === "user-text") {
            return (
              <ChatBubbleUser key={i} time={msg.time} visible={true} delay={0}>
                <div className="flex flex-col items-end gap-2">
                  {/* Show media if present */}
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
                          {m.type.startsWith("video/") ? (
                            <video
                              src={m.preview}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              controls
                            />
                          ) : (
                            <img
                              src={m.preview}
                              alt="Uploaded media"
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Show text if present */}
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
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </ChatBubbleOrchid>
            );
          }
          if (msg.type === "bot-id") {
            return (
              <ChatBubbleOrchid
                key={i}
                visible={true}
                delay={0}
                time={msg.time}
              >
                <IdentificationCard {...msg.data} />
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
                {media.type.startsWith("video/") ? (
                  <video
                    src={media.preview}
                    className="w-20 h-20 object-cover"
                    style={{ border: "1px solid rgba(255,255,255,0.15)" }}
                    muted
                    playsInline
                    controls
                  />
                ) : (
                  <img
                    src={media.preview}
                    alt="Upload preview"
                    className="w-20 h-20 object-cover"
                    style={{ border: "1px solid rgba(255,255,255,0.15)" }}
                  />
                )}
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
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer transition-colors duration-150 hover:bg-white hover:text-black flex-shrink-0"
            style={{
              padding: "8px",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color: "white",
            }}
            title="Upload image or video"
          >
            <ImageIcon size={16} />
          </button>
          
          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSend()}
            placeholder="Describe or ask about a plant..."
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
          
          {/* Send button */}
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

// ─── Feature description panel ──────────────────────────────────────────────

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
          ...revealStyle(200),
          fontFamily: '"Press Start 2P", cursive',
          fontSize: "32px",
          lineHeight: 1.4,
          color: "white",
        }}
      >
        Instant
        <br />
        Identification
      </h2>

      {/* Tagline */}
      <p
        style={{
          ...revealStyle(350),
          fontFamily: mono,
          fontSize: "15px",
          color: "rgba(255,255,255,0.5)",
          marginTop: 20,
          fontStyle: "italic",
        }}
      >
        Snap a photo. Know your plant.
      </p>

      {/* Body */}
      <p
        style={{
          ...revealStyle(500),
          fontFamily: mono,
          fontSize: "14px",
          color: "rgba(255,255,255,0.55)",
          lineHeight: 1.7,
          marginTop: 16,
          letterSpacing: "0.01em",
        }}
      >
        Send a photo or a video via iMessage and receive instant species
        identification with personalized context — care tips based on your
        habits, pet safety alerts, and more.
      </p>

      {/* CTA button */}
      <div style={revealStyle(650)}>
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

// ─── Main feature spread ────────────────────────────────────────────────────

interface IdentifyFeatureProps {
  className?: string;
  scrollRoot?: React.RefObject<HTMLElement | null>;
}

export function IdentifyFeature({
  className = "",
  scrollRoot,
}: IdentifyFeatureProps) {
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
      { threshold: 0.15, root: scrollRoot?.current ?? null }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  return (
    <section
      ref={sectionRef}
      className={`relative min-h-screen w-full flex flex-col justify-center ${className}`}
      style={{ backgroundColor: "black" }}
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
        FIG 2.1 — SPECIES IDENTIFICATION
      </div>

      {/* Content grid */}
      <div className="w-full px-10 md:px-16 lg:px-24 py-20">
        <div className="flex flex-row items-center gap-8 lg:gap-12 max-w-[1100px] mx-auto">
          {/* Left — Chat mock */}
          <div className="flex-shrink-0 flex-1 min-w-0 max-w-[400px]">
            <MockChat visible={visible} interactive={interactive} />
          </div>

          {/* Right — Feature description */}
          <div className="flex items-center flex-1 min-w-0">
            <FeatureDescription
              visible={visible}
              interactive={interactive}
              onActivate={() => setInteractive(true)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
