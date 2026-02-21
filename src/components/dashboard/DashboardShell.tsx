import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlant, useCareEvents, usePlantReminders, usePlantIdentifications } from '@/hooks/usePlants';
import { PlantDetail } from '@/components/plants/PlantDetail';
import { ProfileView } from './ProfileView';
import { CollectionView } from './CollectionView';
import { ActivityView } from './ActivityView';

const mono = "ui-monospace, monospace";
const pressStart = '"Press Start 2P", cursive';
const DENSITY_STEPS = ["█", "▓", "▒", "░", ""];
const DECRYPT_SPEED = 3;

// ── Shared hooks ────────────────────────────────────────────────────────────

export function useDecryptText(text: string, visible: boolean, charDelay = 1.5) {
    const [decrypted, setDecrypted] = useState(text);
    const frameRef = useRef(0);

    useEffect(() => {
        if (!visible) { setDecrypted(text); return; }
        const chars = text.split('');
        let animationId: number;

        const animate = () => {
            frameRef.current++;
            const frame = frameRef.current;
            let allDone = true;
            const newText = chars.map((char, i) => {
                if (char === ' ') return ' ';
                const charFrames = frame - i * charDelay;
                if (charFrames < 0) { allDone = false; return DENSITY_STEPS[0]; }
                const cycles = Math.floor(charFrames / DECRYPT_SPEED);
                if (cycles >= DENSITY_STEPS.length) return char;
                allDone = false;
                return DENSITY_STEPS[Math.min(cycles, DENSITY_STEPS.length - 1)];
            }).join('');
            setDecrypted(newText);
            if (!allDone) animationId = requestAnimationFrame(animate);
        };

        frameRef.current = 0;
        animationId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationId);
    }, [visible, text, charDelay]);

    return decrypted;
}

export function useInView(threshold = 0.15) {
    const [el, setEl] = useState<HTMLElement | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setVisible(true); },
            { threshold }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [el, threshold]);

    return { ref: setEl as any, visible };
}

export function revealStyle(visible: boolean, delay: number): React.CSSProperties {
    return {
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 800ms ease-out',
        transitionDelay: visible ? `${delay}ms` : '0ms',
    };
}

// ── Grain overlay ───────────────────────────────────────────────────────────

function GrainOverlay() {
    return (
        <div className="fixed inset-0 pointer-events-none opacity-[0.04] mix-blend-screen z-40">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <filter id="grain-dashboard">
                    <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
                    <feColorMatrix type="saturate" values="0" />
                </filter>
                <rect width="100%" height="100%" filter="url(#grain-dashboard)" />
            </svg>
        </div>
    );
}

// ── Main shell ──────────────────────────────────────────────────────────────

type TabId = 'collection' | 'activity' | 'profile';

export default function DashboardShell() {
    const navigate = useNavigate();
    const location = window.location.pathname;

    const getTab = (): TabId => {
        if (location.includes('/profile')) return 'profile';
        if (location.includes('/activity')) return 'activity';
        return 'collection';
    };

    const [activeTab, setActiveTab] = useState<TabId>(getTab());
    const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
    const [viewState, setViewState] = useState<'list' | 'detail'>('list');
    const [visible, setVisible] = useState(false);

    useEffect(() => { setActiveTab(getTab()); }, [location]);
    useEffect(() => { const t = setTimeout(() => setVisible(true), 100); return () => clearTimeout(t); }, []);

    // Plant detail data
    const { data: selectedPlant, isLoading: plantLoading } = usePlant(selectedPlantId);
    const { data: careEvents = [], isLoading: careLoading } = useCareEvents(selectedPlantId);
    const { data: reminders = [], isLoading: remindersLoading } = usePlantReminders(selectedPlantId);
    const { data: identifications = [], isLoading: idsLoading } = usePlantIdentifications(selectedPlantId);

    const titleText = useDecryptText(
        activeTab === 'collection' ? 'collection' : activeTab === 'activity' ? 'activity' : 'profile',
        visible
    );

    const handleTabChange = (tab: TabId) => {
        const paths: Record<TabId, string> = {
            collection: '/dashboard/collection',
            activity: '/dashboard/activity',
            profile: '/dashboard/profile',
        };
        navigate(paths[tab]);
        setActiveTab(tab);
        if (tab === 'collection') setViewState('list');
    };

    const handlePlantSelect = (id: string) => {
        setSelectedPlantId(id);
        setViewState('detail');
    };

    const tabs: { id: TabId; label: string }[] = [
        { id: 'collection', label: '/collection' },
        { id: 'activity', label: '/activity' },
        { id: 'profile', label: '/profile' },
    ];

    const navLinks = [
        { label: '/home', action: () => navigate('/') },
        { label: '/chat', action: () => navigate('/chat') },
        { label: '/developer', action: () => navigate('/developer') },
    ];

    return (
        <div className="fixed inset-0 bg-black text-white overflow-hidden" style={{ fontFamily: mono }}>
            <GrainOverlay />

            {/* Navigation — top right */}
            <div
                className="absolute z-50 flex gap-1"
                style={{
                    top: 'max(12px, env(safe-area-inset-top, 12px))',
                    right: 16,
                }}
            >
                {/* Dashboard tabs */}
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className="cursor-pointer transition-colors duration-200"
                        style={{
                            fontFamily: mono,
                            fontSize: '11px',
                            letterSpacing: '0.06em',
                            color: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.3)',
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '1px solid white' : '1px solid transparent',
                            padding: '6px 10px',
                        }}
                        onMouseEnter={(e) => { if (activeTab !== tab.id) e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                        onMouseLeave={(e) => { if (activeTab !== tab.id) e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                    >
                        {tab.label}
                    </button>
                ))}

                {/* Divider */}
                <div style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center', margin: '0 4px' }} />

                {/* External nav */}
                {navLinks.map((link) => (
                    <button
                        key={link.label}
                        onClick={link.action}
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
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
                    >
                        {link.label}
                    </button>
                ))}
            </div>

            {/* Content area */}
            <div className="h-full w-full overflow-y-auto pt-16 pb-12 px-6 md:px-16" style={{ scrollbarWidth: 'none' }}>
                <div className="max-w-[900px] mx-auto">
                    {/* Section title */}
                    <h1
                        style={{
                            ...revealStyle(visible, 0),
                            fontFamily: pressStart,
                            fontSize: 'clamp(14px, 3vw, 18px)',
                            marginBottom: '32px',
                        }}
                    >
                        {titleText}
                    </h1>

                    {/* Active view */}
                    {activeTab === 'collection' && viewState === 'list' && (
                        <CollectionView onSelectPlant={handlePlantSelect} />
                    )}

                    {activeTab === 'collection' && viewState === 'detail' && selectedPlant && (
                        <PlantDetail
                            plant={selectedPlant}
                            careEvents={careEvents}
                            reminders={reminders}
                            identifications={identifications}
                            onBack={() => { setViewState('list'); setSelectedPlantId(null); }}
                            isLoading={plantLoading || careLoading || remindersLoading || idsLoading}
                        />
                    )}

                    {activeTab === 'activity' && <ActivityView />}
                    {activeTab === 'profile' && <ProfileView />}
                </div>
            </div>
        </div>
    );
}
