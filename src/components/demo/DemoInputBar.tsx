import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Phone, Mic, MicOff } from 'lucide-react';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

const mono = 'ui-monospace, monospace';

interface DemoInputBarProps {
  onSend: (text: string, media?: { type: string; data: string }[]) => void;
  onGoLive: () => void;
  isLoading: boolean;
  disabled: boolean;
}

interface PendingMedia {
  id: string;
  preview: string;
  type: string;
  data: string;
}

async function compressImage(file: File, maxDim: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = (height / width) * maxDim;
          width = maxDim;
        } else {
          width = (width / height) * maxDim;
          height = maxDim;
        }
      }
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to compress image'));
        },
        'image/jpeg',
        quality,
      );
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Shared ease for enter/exit
const ease = [0.22, 1, 0.36, 1] as const;

export function DemoInputBar({ onSend, onGoLive, isLoading, disabled }: DemoInputBarProps) {
  const [text, setText] = useState('');
  const [mediaFiles, setMediaFiles] = useState<PendingMedia[]>([]);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Text captured before the current STT session started, so interim results append cleanly
  const preSTTTextRef = useRef('');

  const speechSupported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!speechSupported) return;
    const SRConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SRConstructor();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;

    preSTTTextRef.current = text;

    recognition.addEventListener('result', ((e: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      const prefix = preSTTTextRef.current;
      const separator = prefix.length > 0 && !prefix.endsWith(' ') ? ' ' : '';
      setText(prefix + separator + transcript);
    }) as EventListener);

    recognition.addEventListener('end', () => {
      setIsListening(false);
      recognitionRef.current = null;
    });

    recognition.addEventListener('error', () => {
      setIsListening(false);
      recognitionRef.current = null;
    });

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [speechSupported, text]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, stopListening, startListening]);

  // Clean up recognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && mediaFiles.length === 0) return;

    const media = mediaFiles.length > 0
      ? mediaFiles.map(m => ({ type: m.type, data: m.data }))
      : undefined;

    onSend(trimmed || '(photo)', media);
    setText('');
    setMediaFiles([]);
  }, [text, mediaFiles, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const compressed = await compressImage(file, 1536, 0.8);
        const dataUrl = await blobToDataUrl(compressed);
        const base64 = dataUrl.split(',')[1];
        setMediaFiles(prev => [...prev, {
          id: `${Date.now()}-${Math.random()}`,
          preview: dataUrl,
          type: 'image/jpeg',
          data: base64,
        }]);
      } catch (err) {
        console.error('[DemoInputBar] photo compression failed:', err);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [],
  );

  const removeMedia = useCallback((id: string) => {
    setMediaFiles(prev => prev.filter(m => m.id !== id));
  }, []);

  const isDisabled = isLoading || disabled;
  const canSend = text.trim() !== '' || mediaFiles.length > 0;

  return (
    <div
      style={{
        flexShrink: 0,
        padding: '8px 16px',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        backgroundColor: '#000',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <style>{`.demo-input-field::placeholder { color: rgba(255,255,255,0.5); opacity: 1; }`}</style>
      <div style={{ width: '100%', maxWidth: 600 }}>
        {/* Media preview row — animates height on enter/exit */}
        <AnimatePresence>
          {mediaFiles.length > 0 && (
            <motion.div
              key="media-row"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease }}
              style={{ overflow: 'hidden' }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '8px',
                  overflowX: 'auto',
                  paddingBottom: '4px',
                  paddingTop: '4px',
                }}
              >
                {/* Individual thumbnails — animate in/out */}
                <AnimatePresence mode="popLayout">
                  {mediaFiles.map(media => (
                    <motion.div
                      key={media.id}
                      layout
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      transition={{ duration: 0.2, ease }}
                      style={{ position: 'relative', flexShrink: 0 }}
                    >
                      <img
                        src={media.preview}
                        alt="Upload preview"
                        style={{
                          width: 80,
                          height: 80,
                          objectFit: 'cover',
                          border: '1px solid rgba(255,255,255,0.15)',
                          display: 'block',
                        }}
                      />
                      <button
                        onClick={() => removeMedia(media.id)}
                        style={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          width: 20,
                          height: 20,
                          backgroundColor: 'white',
                          color: 'black',
                          border: '1px solid rgba(255,255,255,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          lineHeight: 1,
                          padding: 0,
                          transition: 'background-color 150ms ease-out, color 150ms ease-out',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ff4444';
                          (e.currentTarget as HTMLButtonElement).style.color = 'white';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'white';
                          (e.currentTarget as HTMLButtonElement).style.color = 'black';
                        }}
                      >
                        x
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            className="transition-colors duration-150 hover:bg-white hover:text-black"
            style={{
              height: '36px',
              width: '36px',
              border: '1px solid rgba(255,255,255,0.15)',
              backgroundColor: 'transparent',
              color: 'white',
              cursor: isDisabled ? 'default' : 'pointer',
              opacity: isDisabled ? 0.3 : 1,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 200ms ease-out, background-color 150ms ease-out, color 150ms ease-out',
            }}
            aria-label="Upload photo"
          >
            <ImageIcon size={16} />
          </button>

          {/* Text input */}
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            placeholder="what's wrong with my monstera?"
            className="demo-input-field"
            style={{
              flex: 1,
              height: '36px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              padding: '0 12px',
              fontFamily: mono,
              fontSize: '16px',
              color: 'white',
              outline: 'none',
              minWidth: 0,
              transition: 'border-color 200ms ease-out',
            }}
          />

          {/* Voice call button */}
          <button
            onClick={onGoLive}
            disabled={isDisabled}
            className="transition-colors duration-150 hover:bg-white hover:text-black"
            style={{
              height: '36px',
              width: '36px',
              border: '1px solid rgba(255,255,255,0.15)',
              backgroundColor: 'transparent',
              color: 'white',
              cursor: isDisabled ? 'default' : 'pointer',
              opacity: isDisabled ? 0.3 : 1,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 200ms ease-out, background-color 150ms ease-out, color 150ms ease-out',
            }}
            aria-label="Start voice call"
          >
            <Phone size={16} />
          </button>

          {/* Speech-to-text mic button */}
          {speechSupported && (
            <>
              <style>{`
                @keyframes mic-pulse {
                  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
                  50% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
                }
              `}</style>
              <button
                onClick={toggleListening}
                disabled={isDisabled}
                className="transition-colors duration-150 hover:bg-white hover:text-black"
                style={{
                  height: '36px',
                  width: '36px',
                  border: isListening
                    ? '1px solid rgba(239,68,68,0.6)'
                    : '1px solid rgba(255,255,255,0.15)',
                  backgroundColor: isListening ? 'rgba(239,68,68,0.15)' : 'transparent',
                  color: isListening ? '#ef4444' : 'white',
                  cursor: isDisabled ? 'default' : 'pointer',
                  opacity: isDisabled ? 0.3 : 1,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'opacity 200ms ease-out, background-color 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out',
                  animation: isListening ? 'mic-pulse 1.5s ease-in-out infinite' : 'none',
                }}
                aria-label={isListening ? 'Stop speech input' : 'Start speech input'}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            </>
          )}

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={isDisabled || !canSend}
            className="transition-colors duration-150 hover:bg-white hover:text-black"
            style={{
              height: '36px',
              fontFamily: mono,
              fontSize: '14px',
              color: 'white',
              letterSpacing: '0.06em',
              padding: '0 14px',
              border: '1px solid rgba(255,255,255,0.15)',
              backgroundColor: 'transparent',
              whiteSpace: 'nowrap',
              cursor: isDisabled || !canSend ? 'default' : 'pointer',
              opacity: isDisabled || !canSend ? 0.3 : 1,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 200ms ease-out, background-color 150ms ease-out, color 150ms ease-out',
            }}
          >
            {'SEND \u2192'}
          </button>
        </div>
      </div>
    </div>
  );
}
