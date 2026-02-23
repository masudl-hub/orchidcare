import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/** Page for setting a new password after clicking the recovery link */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsValidSession(true);
      }
      setChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setIsSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="font-mono text-sm uppercase tracking-widest text-stone-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10 px-8"
      >
        <div className="text-center mb-8">
          <h1 style={{ fontFamily: '"Press Start 2P", cursive' }} className="text-2xl sm:text-3xl text-white mb-2">
            /RESET
          </h1>
          <p className="font-mono text-sm text-white">
            {isSuccess ? 'Password updated successfully.' : 'Set your new password.'}
          </p>
        </div>

        <div className="bg-black border border-white p-8">
          {isSuccess ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
              <p className="font-mono text-xs uppercase tracking-wider text-green-400 mb-4">
                ✓ Password updated
              </p>
              <p className="font-mono text-xs text-stone-400">
                Redirecting to login...
              </p>
            </motion.div>
          ) : !isValidSession ? (
            <div className="text-center">
              <p className="font-mono text-xs uppercase tracking-wider text-stone-400 mb-4">
                Invalid or expired reset link.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="font-mono text-xs text-white hover:text-stone-300 transition-colors"
              >
                &larr; back to login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block font-mono text-xs uppercase tracking-wider text-white mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  id="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full border border-white bg-black px-4 py-3 font-mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 placeholder-stone-500"
                  placeholder="••••••••"
                  required
                />
              </div>
              <div>
                <label htmlFor="confirm-new-password" className="block font-mono text-xs uppercase tracking-wider text-white mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirm-new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full border border-white bg-black px-4 py-3 font-mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 placeholder-stone-500"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-red-950/20 border border-red-500">
                  <p className="font-mono text-xs text-red-500 uppercase tracking-wider">{error}</p>
                </motion.div>
              )}

              <motion.button
                whileHover={{ scale: isLoading ? 1 : 1.02 }}
                whileTap={{ scale: isLoading ? 1 : 0.98 }}
                type="submit"
                disabled={isLoading}
                className="w-full border border-white bg-white hover:bg-stone-100 text-black px-6 py-4 font-mono text-sm uppercase tracking-widest transition-colors mt-6 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
                ) : (
                  'Set New Password'
                )}
              </motion.button>
            </form>
          )}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-center mt-6">
          <button onClick={() => navigate('/login')} className="font-mono text-sm text-white hover:text-stone-300 transition-colors">
            &larr; back to login
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
