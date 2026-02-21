import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Login } from '@/components/Login';
import { CreateAccount } from '@/components/CreateAccount';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, signIn, signUp, loading: authLoading } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(searchParams.get('signup') === 'true');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Loading animation states
  const [showLoading, setShowLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isExpanding, setIsExpanding] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !authLoading) {
      // User is authenticated - determine where to redirect
      // If profile exists, user has completed onboarding, go to dashboard
      // If no profile, user needs to complete onboarding
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
            // Navigate based on profile state
            // If profile exists, user has completed onboarding
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
        redirect_uri: `${window.location.origin}/auth`,
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
        redirect_uri: `${window.location.origin}/auth`,
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Apple');
      setIsSubmitting(false);
    }
  };

  const handleCreateAccount = () => {
    setError(null);
    setIsSignUp(true);
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

  const handleBackToLogin = () => {
    setError(null);
    setIsSignUp(false);
  };

  // Don't render auth forms if already loading or authenticated
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#ECE8E0] flex items-center justify-center">
        <div className="font-mono text-sm uppercase tracking-widest text-stone-600">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <>
      {isSignUp ? (
        <CreateAccount
          onBack={handleBackToLogin}
          onComplete={handleAccountCreated}
          onGoogleSignup={handleGoogleAuth}
          onAppleSignup={handleAppleAuth}
          isLoading={isSubmitting}
          error={error}
        />
      ) : (
        <Login
          onBack={handleBack}
          onCreateAccount={handleCreateAccount}
          onLogin={handleLogin}
          onGoogleLogin={handleGoogleAuth}
          onAppleLogin={handleAppleAuth}
          isLoading={isSubmitting}
          error={error}
        />
      )}

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
            {/* Top progress bar */}
            <div className="absolute top-0 left-0 w-full h-2 bg-stone-900">
              <motion.div
                className="h-full bg-white"
                initial={{ width: 0 }}
                animate={{ width: `${loadingProgress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>

            {!isExpanding ? (
              <div className="relative">
                <div className="flex flex-col items-center gap-4">
                  <div className="font-mono text-xs uppercase tracking-widest text-white/50">
                    AUTHENTICATING • {loadingProgress}%
                  </div>
                </div>
              </div>
            ) : (
              <motion.div
                className="bg-black"
                initial={{ width: '1px', height: '1px' }}
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
