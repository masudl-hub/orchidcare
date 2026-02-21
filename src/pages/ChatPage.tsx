import { useAuth } from '@/contexts/AuthContext';
import { PwaOnboarding } from '@/components/pwa/PwaOnboarding';
import { PwaChat } from '@/components/pwa/PwaChat';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/navigation/BottomNav';

const mono = 'ui-monospace, monospace';
const pressStart = '"Press Start 2P", cursive';
const DENSITY_STEPS = ["█", "▓", "▒", "░", ""];

const ScrambleButton = ({ text, onClick }: { text: string, onClick: () => void }) => {
    const [displayText, setDisplayText] = useState(text);

    const handleClick = () => {
        let iterations = 0;
        const interval = setInterval(() => {
            iterations++;
            setDisplayText(text.split('').map((char) => {
                if (char === ' ') return ' ';
                return DENSITY_STEPS[Math.floor(Math.random() * (DENSITY_STEPS.length - 1))] || '█';
            }).join(''));

            if (iterations > 8) {
                clearInterval(interval);
                setDisplayText(text);
                onClick();
            }
        }, 50);
    };

    return (
        <button
            onClick={handleClick}
            className="cursor-pointer transition-colors duration-200 hover:text-white"
            style={{
                fontFamily: pressStart,
                fontSize: '11px',
                letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.7)',
                backgroundColor: 'transparent',
                border: 'none',
                padding: '6px 10px',
                marginTop: '1px',
            }}
        >
            {displayText}
        </button>
    );
};

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
            {/* Nav — top wide */}
            <div
                className="fixed z-40 flex justify-between w-full px-4 pb-3 bg-black/80 backdrop-blur-md"
                style={{
                    top: 0,
                    paddingTop: 'max(12px, env(safe-area-inset-top, 12px))',
                }}
            >
                <div className="flex items-center">
                    <ScrambleButton text="ORCHID" onClick={() => navigate('/')} />
                </div>

                <div className="hidden md:flex gap-1 items-center">
                    {[
                        { label: "/collection", href: "/dashboard/collection" },
                        { label: "/activity", href: "/dashboard/activity" },
                        { label: "/profile", href: "/dashboard/profile" },
                        { label: "|", href: "" },
                        { label: "/developer", href: "/developer" },
                        { label: "|", href: "" },
                        { label: "/chat", href: "/chat" },
                        { label: "/call", href: "/call" },
                    ].map((item, i) => {
                        if (item.label === '|') {
                            return <div key={`divider-${i}`} style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center', margin: '0 4px' }} />;
                        }
                        const isAction = item.label === '/chat' || item.label === '/call';
                        return (
                            <button
                                key={item.label}
                                onClick={() => navigate(item.href)}
                                className="cursor-pointer transition-colors duration-200"
                                style={{
                                    fontFamily: mono,
                                    fontSize: '11px',
                                    letterSpacing: '0.06em',
                                    color: (isAction || item.label === '/chat') ? 'white' : 'rgba(255,255,255,0.3)',
                                    fontWeight: isAction ? 'bold' : 'normal',
                                    backgroundColor: isAction ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    border: isAction ? '1px solid rgba(255,255,255,0.5)' : 'none',
                                    borderBottom: isAction ? '1px solid rgba(255,255,255,0.5)' : (item.label === '/chat' ? '1px solid white' : '1px solid transparent'),
                                    padding: '6px 10px',
                                    borderRadius: '0',
                                }}
                                onMouseEnter={(e) => { if (!isAction && item.label !== '/chat') e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                                onMouseLeave={(e) => { if (!isAction && item.label !== '/chat') e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                            >
                                {item.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <PwaChat />

            <BottomNav />
        </div>
    );
}
