import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { OrchidHero } from "@/components/landing/orchid-hero";
import { StartPage } from "@/components/landing/start-page";

const SLIDE_MS = 600;

export default function OrchidPage() {
  const navigate = useNavigate();
  const [startOpen, setStartOpen] = useState(false);
  const [loginSliding, setLoginSliding] = useState(false);
  const [demoSliding, setDemoSliding] = useState(false);

  const handleStart = useCallback(() => {
    setStartOpen(true);
  }, []);

  const handleLogin = useCallback(() => {
    setLoginSliding(true);
    setTimeout(() => navigate("/login"), SLIDE_MS);
  }, [navigate]);

  const handleDemo = useCallback(() => {
    setDemoSliding(true);
    setTimeout(() => navigate("/demo"), SLIDE_MS);
  }, [navigate]);

  const handleClose = useCallback(() => {
    setStartOpen(false);
  }, []);

  return (
    <>
      <OrchidHero onStartClick={handleStart} onLoginClick={handleLogin} onDemoClick={handleDemo} />

      {/* Login slide-up transition — mirrors StartPage's slide */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          backgroundColor: "black",
          transform: loginSliding ? "translateY(0)" : "translateY(100%)",
          transition: `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          pointerEvents: loginSliding ? "auto" : "none",
        }}
      />

      {/* Demo slide-up transition */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          backgroundColor: "black",
          transform: demoSliding ? "translateY(0)" : "translateY(100%)",
          transition: `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          pointerEvents: demoSliding ? "auto" : "none",
        }}
      />

      <StartPage visible={startOpen} onClose={handleClose} />
    </>
  );
}
