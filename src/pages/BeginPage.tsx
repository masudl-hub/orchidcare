import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CreateAccount } from '@/components/CreateAccount';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function BeginPage() {
  const navigate = useNavigate();
  const { user, profile, signUp, loading: authLoading } = useAuth();
  
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

  const handleLogin = () => {
    navigate('/login');
  };

  const handleAccountCreated = async (email: string, password: string) => {
    setError(null);
    setIsSubmitting(true);
    
    try {
      const result = await signUp(email, password);
      if (result.error) {
        throw result.error;
      }
      setShowLoading(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/begin`,
        },
      });
      
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up with Google');
      setIsSubmitting(false);
    }
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
      <CreateAccount
        onBack={handleBack}
        onComplete={handleAccountCreated}
        onGoogleSignup={handleGoogleAuth}
        onLogin={handleLogin}
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
                    AUTHORIZING ACCESS // {loadingProgress}%
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
