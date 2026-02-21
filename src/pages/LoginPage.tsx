import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Login } from '@/components/Login';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, profile, signIn, loading: authLoading } = useAuth();
  
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Loading animation states
  const [showLoading, setShowLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isExpanding, setIsExpanding] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !authLoading) {
      if (profile) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/onboarding', { replace: true });
      }
    }
  }, [user, profile, authLoading, navigate]);

  // Loading animation effect
  useEffect(() => {
    if (!showLoading) return;

    const interval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsExpanding(true), 300);
          setTimeout(() => {
            if (profile) {
              navigate('/dashboard', { replace: true });
            } else {
              navigate('/onboarding', { replace: true });
            }
            setShowLoading(false);
            setLoadingProgress(0);
            setIsExpanding(false);
          }, 1400);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    return () => clearInterval(interval);
  }, [showLoading, navigate, profile]);

  const handleBack = () => {
    navigate('/');
  };

  const handleLogin = async (email: string, password: string) => {
    setError(null);
    setIsSubmitting(true);
    
    try {
      const result = await signIn(email, password);
      if (result.error) {
        throw result.error;
      }
      setShowLoading(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/login`,
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
      setIsSubmitting(false);
    }
  };

  const handleAppleAuth = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: `${window.location.origin}/login`,
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Apple');
      setIsSubmitting(false);
    }
  };

  const handleCreateAccount = () => {
    navigate('/begin');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="font-mono text-sm uppercase tracking-widest text-stone-600">
          INITIALIZING...
        </div>
      </div>
    );
  }

  return (
    <>
      <Login
        onBack={handleBack}
        onCreateAccount={handleCreateAccount}
        onLogin={handleLogin}
        onGoogleLogin={handleGoogleAuth}
        onAppleLogin={handleAppleAuth}
        isLoading={isSubmitting}
        error={error}
      />

      {/* Loading animation overlay */}
      <AnimatePresence>
        {showLoading && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {!isExpanding ? (
              <div className="relative">
                <div className="flex flex-col items-center gap-6">
                  <div className="w-64 h-1 border border-stone-800 bg-black">
                    <motion.div
                      className="h-full bg-white"
                      initial={{ width: 0 }}
                      animate={{ width: `${loadingProgress}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-stone-500">
                    AUTHENTICATING // {loadingProgress}%
                  </div>
                </div>
              </div>
            ) : (
              <motion.div
                className="bg-black"
                initial={{ width: '16rem', height: '1px' }}
                animate={{
                  width: '100vw',
                  height: '100vh',
                }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
