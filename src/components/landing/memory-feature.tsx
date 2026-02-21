import { useState, useEffect, useRef } from "react";
import { MemoryOrb } from "./MemoryOrb";
import { motion } from "framer-motion";

const mono = "ui-monospace, monospace";

export function MemoryFeature({
  className = "",
  scrollRoot,
}: {
  className?: string;
  scrollRoot?: React.RefObject<HTMLElement | null>;
}) {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

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

  const revealStyle = (delay: number): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(12px)",
    transition: "all 800ms ease-out",
    transitionDelay: visible ? `${delay}ms` : "0ms",
  });

  return (
    <section
      ref={sectionRef}
      className={`snap-start w-full min-h-screen flex flex-col items-center justify-center bg-black relative overflow-hidden ${className}`}
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
          zIndex: 10,
        }}
      >
        FIG 2.3 — ADAPTIVE MEMORY
      </div>

      <div className="max-w-[1000px] w-full px-4 md:px-16 lg:px-24 flex flex-col items-center text-center">
        {/* Heading */}
        <h2
          className="text-[22px] md:text-[36px]"
          style={{
            ...revealStyle(200),
            fontFamily: '"Press Start 2P", cursive',
            lineHeight: 1.3,
            color: "white",
            marginBottom: "24px",
          }}
        >
          Memory That Learns
        </h2>

        {/* body */}
        <p
          style={{
            ...revealStyle(400),
            fontFamily: mono,
            fontSize: "14px",
            color: "rgba(255,255,255,0.5)",
            maxWidth: "600px",
            lineHeight: 1.6,
            marginBottom: "40px",
          }}
        >
          The more you chat, the smarter Orchid gets. Every conversation<br className="hidden md:block" />
          builds a richer understanding of you and your plants.
        </p>

        {/* Memory Orb Visualization */}
        <div 
            className="w-full relative flex justify-center"
            style={{ 
                ...revealStyle(600),
                height: "500px",
                marginTop: "-20px"
            }}
        >
            <div className="w-full h-full relative">
                <MemoryOrb />
                
                {/* Subtle bottom fade to blend with next section */}
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none" />
            </div>
        </div>
      </div>
    </section>
  );
}
