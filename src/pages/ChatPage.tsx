import { useAuth } from '@/contexts/AuthContext';
import { PwaOnboarding } from '@/components/pwa/PwaOnboarding';
import { PwaChat } from '@/components/pwa/PwaChat';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const mono = 'ui-monospace, monospace';

export default function ChatPage() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [onboardingComplete, setOnboardingComplete] = useState(false);

    // No profile yet — onboarding
    if (!profile && !onboardingComplete) {
        return <PwaOnboarding onComplete={() => setOnboardingComplete(true)} />;
    }

    return (
        <div className="fixed inset-0">
            {/* Nav — top right: /dashboard /developer /home */}
            <div
                className="absolute z-40 flex gap-1"
                style={{
                    top: 'max(12px, env(safe-area-inset-top, 12px))',
                    right: 16,
                }}
            >
                {[
                    { label: "/dashboard", href: "/dashboard" },
                    { label: "/developer", href: "/developer" },
                    { label: "/home", href: "/" },
                ].map((item) => (
                    <button
                        key={item.label}
                        onClick={() => navigate(item.href)}
                        className="cursor-pointer transition-colors duration-200"
                        style={{
                            fontFamily: mono,
                            fontSize: '11px',
                            letterSpacing: '0.06em',
                            color: 'rgba(255,255,255,0.3)',
                            backgroundColor: 'transparent',
                            border: 'none',
                            padding: '6px 10px',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <PwaChat />
        </div>
    );
}
