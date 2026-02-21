import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useIsTouch } from "@/hooks/use-mobile";
import { usePwaInstall } from "@/hooks/use-pwa-install";
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
  const { canInstall, isIos, isStandalone, triggerInstall } = usePwaInstall();
  const [morphActive, setMorphActive] = useState(false);
  const [morphComplete, setMorphComplete] = useState(false);
  const [orchidData, setOrchidData] = useState<{ grid: boolean[][]; cols: number; rows: number } | null>(null);
  const [qrData, setQrData] = useState<{ grid: boolean[][]; moduleCount: number } | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [showMobileSheet, setShowMobileSheet] = useState(false);

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
      setMorphActive(false);
      setMorphComplete(false);
      return;
    }

    if (isTouch) {
      // Mobile: show choice sheet instead of auto-opening Telegram
      setShowMobileSheet(true);
    } else {
      // Desktop: morph to QR
      setMorphActive(true);
    }
  }, [morphActive, isTouch]);

  const handleOpenTelegram = useCallback(() => {
    setShowMobileSheet(false);
    window.location.href = DEEP_LINK;
  }, []);

  const handleAddToHome = useCallback(async () => {
    if (canInstall) {
      await triggerInstall();
      setShowMobileSheet(false);
    }
    // iOS hint stays visible via the sheet
  }, [canInstall, triggerInstall]);

  const handleContinueWeb = useCallback(() => {
    setShowMobileSheet(false);
    navigate("/begin");
  }, [navigate]);

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

      {/* Mobile action sheet */}
      {showMobileSheet && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.7)",
          }}
        >
          {/* Backdrop dismiss */}
          <div
            style={{ position: "absolute", inset: 0 }}
            onClick={() => setShowMobileSheet(false)}
          />

          {/* Sheet */}
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 360,
              margin: "0 16px 32px",
              border: "1px solid rgba(255,255,255,0.12)",
              backgroundColor: "rgba(10,10,10,0.95)",
              padding: "20px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {/* Open Telegram */}
            <button
              onClick={handleOpenTelegram}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "1px solid rgba(255,255,255,0.2)",
                backgroundColor: "transparent",
                color: "white",
                fontFamily: "ui-monospace, monospace",
                fontSize: "12px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              open in telegram →
            </button>

            {/* Add to Home Screen — always visible on mobile */}
            {!isStandalone && (
              <button
                onClick={canInstall ? handleAddToHome : undefined}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  backgroundColor: "white",
                  color: "black",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "12px",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {canInstall ? (
                  <>add to home screen</>
                ) : isIos ? (
                  <>tap ⬆ share → "add to home screen"</>
                ) : (
                  <>menu (⋮) → add to home screen</>
                )}
              </button>
            )}

            {/* Continue on web */}
            <button
              onClick={handleContinueWeb}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "none",
                backgroundColor: "transparent",
                color: "rgba(255,255,255,0.4)",
                fontFamily: "ui-monospace, monospace",
                fontSize: "11px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              continue on web
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
