import { useAuth } from '@/contexts/AuthContext';
import { PwaAuth } from '@/components/pwa/PwaAuth';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { Navigate, useLocation } from 'react-router-dom';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const returnTo = (location.state as any)?.from;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="font-mono text-sm uppercase tracking-widest text-stone-600">
          INITIALIZING...
        </div>
      </div>
    );
  }

  // Already authenticated — redirect to return URL or chat
  if (user) {
    const destination = returnTo && returnTo !== '/login' ? returnTo : '/chat';
    return <Navigate to={destination} replace />;
  }

  // Not authenticated — show auth
  return (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ overscrollBehaviorY: 'none' }}>
      <PwaAuth defaultMode="login" />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50 }}>
        <InstallPrompt />
      </div>
    </div>
  );
}
