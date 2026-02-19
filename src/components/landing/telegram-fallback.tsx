interface TelegramFallbackProps {
  visible: boolean;
  onClose: () => void;
  onWebSignup: () => void;
}

export function TelegramFallback({ visible, onClose, onWebSignup }: TelegramFallbackProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Card */}
      <div
        className="relative bg-white border-2 border-black p-8 max-w-[320px] w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: "ui-monospace, monospace" }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-black/40 hover:text-black text-lg cursor-pointer"
        >
          &times;
        </button>

        <div
          className="mb-6"
          style={{
            fontFamily: '"Press Start 2P", cursive',
            fontSize: "14px",
            lineHeight: 1.6,
          }}
        >
          telegram not found
        </div>

        <p className="text-sm mb-6 text-black/60 leading-relaxed">
          Orchid lives on Telegram. Install it to get started, or sign up on the web.
        </p>

        <div className="flex flex-col gap-3">
          <a
            href="https://telegram.org/dl"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full border-2 border-black py-3 text-center text-sm hover:bg-black hover:text-white transition-colors"
          >
            get telegram
          </a>

          <button
            onClick={onWebSignup}
            className="w-full py-3 text-center text-sm text-black/50 hover:text-black transition-colors cursor-pointer"
          >
            sign up on web instead
          </button>
        </div>
      </div>
    </div>
  );
}
