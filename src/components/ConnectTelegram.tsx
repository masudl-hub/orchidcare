import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ConnectTelegramProps {
  onComplete: () => void;
  onSkip: () => void;
}

function generateCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (100000 + (buf[0] % 900000)).toString();
}

export function ConnectTelegram({ onComplete, onSkip }: ConnectTelegramProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  // Generate linking code on mount
  useEffect(() => {
    if (!user) return;

    const createCode = async () => {
      const newCode = generateCode();

      const { error: insertError } = await supabase
        .from('linking_codes')
        .insert({
          user_id: user.id,
          code: newCode,
        });

      if (insertError) {
        // Code collision — retry once
        const retryCode = generateCode();
        const { error: retryError } = await supabase
          .from('linking_codes')
          .insert({
            user_id: user.id,
            code: retryCode,
          });

        if (retryError) {
          setError('Could not generate a linking code. Please try again.');
          return;
        }
        setCode(retryCode);
      } else {
        setCode(newCode);
      }
    };

    createCode();
  }, [user]);

  // Poll for telegram_chat_id to detect when linking completes
  useEffect(() => {
    if (!user || !code) return;

    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('telegram_chat_id')
        .eq('user_id', user.id)
        .single();

      if (data?.telegram_chat_id) {
        clearInterval(pollRef.current);
        setIsConnected(true);
        await refreshProfile();
        setTimeout(onComplete, 1500);
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user, code, onComplete, refreshProfile]);

  const deepLink = code ? `https://t.me/orchidcare_bot?start=${code}` : null;

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden px-8">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Title */}
        <div className="text-center mb-10">
          <h1
            style={{ fontFamily: '"Press Start 2P", cursive' }}
            className="text-2xl text-white mb-4"
          >
            /CONNECT
          </h1>
          <p className="font-mono text-sm text-white/70 leading-relaxed">
            Link your Telegram to complete setup.<br />
            This is how Orchid talks to you.
          </p>
        </div>

        {isConnected ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="border border-white/30 p-8 mb-6">
              <div className="font-mono text-lg text-white mb-2">Connected</div>
              <p className="font-mono text-xs text-white/50 uppercase tracking-widest">
                Telegram linked successfully
              </p>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Deep link button */}
            {deepLink && (
              <motion.a
                href={deepLink}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="block w-full border border-white bg-white hover:bg-stone-100 text-black px-6 py-4 font-mono text-sm uppercase tracking-widest text-center transition-colors mb-6"
              >
                Open Orchid on Telegram
              </motion.a>
            )}

            {/* Fallback code */}
            {code && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="border border-white/20 p-6 mb-6"
              >
                <p className="font-mono text-xs text-white/50 uppercase tracking-widest mb-3 text-center">
                  Or send this code to @orchidcare_bot
                </p>
                <div className="text-center">
                  <span
                    style={{ fontFamily: '"Press Start 2P", cursive' }}
                    className="text-3xl text-white tracking-[0.3em]"
                  >
                    {code}
                  </span>
                </div>
              </motion.div>
            )}

            {/* Waiting indicator */}
            {code && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-center mb-8"
              >
                <div className="flex items-center justify-center gap-2">
                  <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse" />
                  <p className="font-mono text-xs text-white/40 uppercase tracking-widest">
                    Waiting for connection...
                  </p>
                </div>
              </motion.div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border border-red-500 p-3 mb-6"
              >
                <p className="font-mono text-xs text-red-500 uppercase tracking-wider text-center">
                  {error}
                </p>
              </motion.div>
            )}

            {/* Skip */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
              onClick={onSkip}
              className="block w-full text-center font-mono text-xs text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors cursor-pointer"
            >
              Skip for now
            </motion.button>
          </>
        )}
      </motion.div>
    </div>
  );
}
