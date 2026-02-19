import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useIsTouch } from "@/hooks/use-mobile";
import { QRMorphCanvas } from "./qr-morph-canvas";
import { generateQRMatrix } from "@/lib/qr-matrix";
import { sampleOrchidGrid } from "@/lib/orchid-grid";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

const DEEP_LINK = "https://t.me/orchidcare_bot?start=web";
const DEEP_LINK_DATA = "t.me/orchidcare_bot?start=web";
const MORPH_SIZE = 140;

interface QROrchidProps {
  visible?: boolean;
  className?: string;
}

export function QROrchid({ visible = false, className = "" }: QROrchidProps) {
  const navigate = useNavigate();
  const isTouch = useIsTouch();
  const [morphActive, setMorphActive] = useState(false);
  const [morphComplete, setMorphComplete] = useState(false);
  const [orchidData, setOrchidData] = useState<{ grid: boolean[][]; cols: number; rows: number } | null>(null);
  const [qrData, setQrData] = useState<{ grid: boolean[][]; moduleCount: number } | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  // Preload grids on mount
  useEffect(() => {
    const qr = generateQRMatrix(DEEP_LINK_DATA);
    setQrData({ grid: qr.grid, moduleCount: qr.moduleCount });
    sampleOrchidGrid().then((result) => {
      setOrchidData({ grid: result.grid, cols: result.cols, rows: result.rows });
    });
  }, []);

  const handleClick = useCallback(() => {
    if (morphActive) {
      // Dismiss
      setMorphActive(false);
      setMorphComplete(false);
      return;
    }

    if (isTouch) {
      // Mobile: open Telegram deep link
      const start = Date.now();
      const handleVisibility = () => {
        if (document.hidden) {
          clearTimeout(timer);
          document.removeEventListener("visibilitychange", handleVisibility);
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);
      window.location.href = DEEP_LINK;
      const timer = setTimeout(() => {
        document.removeEventListener("visibilitychange", handleVisibility);
        if (!document.hidden && Date.now() - start >= 1800) {
          setShowFallback(true);
        }
      }, 2000);
    } else {
      // Desktop: morph to QR
      setMorphActive(true);
    }
  }, [morphActive, isTouch]);

  return (
    <div
      className={`inline-flex flex-col items-start gap-3 transition-opacity duration-700 ease-out ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        transitionDelay: visible ? "200ms" : "0ms",
        cursor: "pointer",
      }}
      onClick={handleClick}
    >
      {/* Orchid image — hidden when morph is active */}
      <div style={{
        position: "relative",
        width: MORPH_SIZE,
        height: MORPH_SIZE,
      }}>
        {/* B&W pixel orchid — default state */}
        <ImageWithFallback
          src="/plant_assets_art/T_phalaenopsis_orchid/phalaenopsis_orchid_pixel_bw_light.png"
          alt="Orchid"
          draggable={false}
          className="block"
          style={{
            width: MORPH_SIZE,
            height: MORPH_SIZE,
            imageRendering: "pixelated" as const,
            objectFit: "contain",
            opacity: morphActive ? 0 : 1,
            transition: "opacity 300ms ease-out",
          }}
        />

        {/* QR Morph canvas — overlays orchid on click */}
        {orchidData && qrData && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              opacity: morphActive ? 1 : 0,
              transition: "opacity 300ms ease-out",
              pointerEvents: morphActive ? "auto" : "none",
            }}
          >
            <QRMorphCanvas
              orchidGrid={orchidData.grid}
              orchidCols={orchidData.cols}
              orchidRows={orchidData.rows}
              qrGrid={qrData.grid}
              moduleCount={qrData.moduleCount}
              active={morphActive}
              size={MORPH_SIZE}
              theme="dark"
              onComplete={() => setMorphComplete(true)}
            />
          </div>
        )}
      </div>

      <div
        style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: "12px",
          color: "white",
          letterSpacing: "0.05em",
        }}
      >
        <div style={{ opacity: 0.4 }}>
          <div>{morphActive ? "scan with phone" : "tap to start"}</div>
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (morphActive) navigate("/signup");
            }}
            style={{
              opacity: morphActive ? 0.6 : 0,
              marginTop: 4,
              cursor: morphActive ? "pointer" : "default",
              pointerEvents: morphActive ? "auto" : "none",
            }}
            className={morphActive ? "hover:underline" : ""}
          >
            or continue on web
          </div>
        </div>
      </div>
    </div>
  );
}
