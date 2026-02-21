import { useAuth } from '@/contexts/AuthContext';
import { PwaAuth } from '@/components/pwa/PwaAuth';
import { PwaOnboarding } from '@/components/pwa/PwaOnboarding';
import { PwaChat } from '@/components/pwa/PwaChat';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { useState } from 'react';

export default function LoginPage() {
  const { user, profile, loading } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="font-mono text-sm uppercase tracking-widest text-stone-600">
          INITIALIZING...
        </div>
      </div>
    );
  }

  // Not authenticated — show auth (login/signup toggle built in)
  if (!user) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col" style={{ overscrollBehaviorY: 'none' }}>
        <PwaAuth />
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50 }}>
          <InstallPrompt />
        </div>
      </div>
    );
  }

  // Authenticated but no profile — onboarding
  if (!profile && !onboardingComplete) {
    return <PwaOnboarding onComplete={() => setOnboardingComplete(true)} />;
  }

  // Authenticated with profile — chat
  return <PwaChat />;
}
