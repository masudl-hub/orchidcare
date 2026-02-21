import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MapPin, Phone, Edit2, Save, X, Loader2, LogOut, Key, Download, ChevronRight,
    Dog, Cat, Bird, Fish, Rabbit, Sun, Zap, Lightbulb, Microscope,
    Droplets, Brain, Calendar, Trash2, Database, Leaf
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SystemProtocols } from './SystemProtocols';
import { useSystemSettings, useUpdateQuietHours, useTogglePreference, useToggleAgentPermission, useInitializeSettings } from '@/hooks/useSettings';
import { useUserInsights, useDeleteInsight } from '@/hooks/useInsights';
import { useInView, revealStyle } from './DashboardShell';

const mono = "ui-monospace, monospace";
const pressStart = '"Press Start 2P", cursive';

// ── QuietHoursClock (dark reskin) ───────────────────────────────────────────

function QuietHoursClock({
    startHour, endHour, onStartChange, onEndChange, disabled
}: {
    startHour: number; endHour: number;
    onStartChange: (h: number) => void; onEndChange: (h: number) => void;
    disabled?: boolean;
}) {
    const [isDraggingStart, setIsDraggingStart] = useState(false);
    const [isDraggingEnd, setIsDraggingEnd] = useState(false);
    const clockRef = useRef<HTMLDivElement>(null);

    const hourToAngle = (h: number) => ((h % 12) * 30) - 90;
    const angleToHour = (angle: number, current: number) => {
        const n = ((angle + 90) % 360 + 360) % 360;
        const h12 = Math.round(n / 30) % 12;
        return current >= 12 ? (h12 === 0 ? 12 : h12 + 12) : (h12 === 0 ? 0 : h12);
    };

    const handleMouseDown = (e: React.MouseEvent, isStart: boolean) => {
        if (disabled) return;
        e.preventDefault(); e.stopPropagation();
        isStart ? setIsDraggingStart(true) : setIsDraggingEnd(true);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!clockRef.current || (!isDraggingStart && !isDraggingEnd)) return;
        const rect = clockRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
        if (isDraggingStart) onStartChange(angleToHour(angle, startHour));
        else if (isDraggingEnd) onEndChange(angleToHour(angle, endHour));
    };

    const handleMouseUp = () => { setIsDraggingStart(false); setIsDraggingEnd(false); };

    useEffect(() => {
        if (isDraggingStart || isDraggingEnd) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
        }
    }, [isDraggingStart, isDraggingEnd, startHour, endHour]);

    const getArcPath = () => {
        const r = 45, cx = 50, cy = 50;
        const sa = hourToAngle(startHour), ea = hourToAngle(endHour);
        const sr = (sa * Math.PI) / 180, er = (ea * Math.PI) / 180;
        const x1 = cx + r * Math.cos(sr), y1 = cy + r * Math.sin(sr);
        const x2 = cx + r * Math.cos(er), y2 = cy + r * Math.sin(er);
        let diff = endHour - startHour; if (diff < 0) diff += 24;
        return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${diff > 12 ? 1 : 0} 1 ${x2} ${y2} Z`;
    };

    const formatHour = (h: number) => `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;

    return (
        <div className="flex flex-col items-center">
            <div ref={clockRef} className="relative w-36 h-36 select-none">
                <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
                    <circle cx="50" cy="50" r="48" fill="transparent" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                    {[...Array(12)].map((_, i) => {
                        const angle = (i * 30) - 90;
                        const rad = (angle * Math.PI) / 180;
                        const isMain = i % 3 === 0;
                        const r1 = isMain ? 38 : 42, r2 = 45;
                        return <line key={i} x1={50 + r1 * Math.cos(rad)} y1={50 + r1 * Math.sin(rad)} x2={50 + r2 * Math.cos(rad)} y2={50 + r2 * Math.sin(rad)} stroke={isMain ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'} strokeWidth={isMain ? '1' : '0.5'} />;
                    })}
                    {[12, 3, 6, 9].map((h) => {
                        const idx = h === 12 ? 0 : h;
                        const angle = (idx * 30) - 90;
                        const rad = (angle * Math.PI) / 180;
                        return <text key={h} x={50 + 32 * Math.cos(rad)} y={50 + 32 * Math.sin(rad)} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.5)" style={{ fontFamily: mono, fontSize: '7px', fontWeight: 'bold' }}>{h}</text>;
                    })}
                    <path d={getArcPath()} fill="rgba(255,255,255,0.08)" />
                    {/* Start hand */}
                    <g transform={`rotate(${hourToAngle(startHour)} 50 50)`} style={{ cursor: disabled ? 'default' : 'grab' }} onMouseDown={(e) => handleMouseDown(e, true)}>
                        <line x1="50" y1="50" x2="50" y2="10" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="50" cy="50" r="3" fill="rgba(255,255,255,0.7)" />
                        <circle cx="50" cy="10" r="2.5" fill="rgba(255,255,255,0.7)" />
                    </g>
                    {/* End hand */}
                    <g transform={`rotate(${hourToAngle(endHour)} 50 50)`} style={{ cursor: disabled ? 'default' : 'grab' }} onMouseDown={(e) => handleMouseDown(e, false)}>
                        <line x1="50" y1="50" x2="50" y2="10" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
                        <circle cx="50" cy="50" r="3" fill="rgba(255,255,255,0.4)" />
                        <circle cx="50" cy="10" r="2.5" fill="rgba(255,255,255,0.4)" />
                    </g>
                </svg>
            </div>
            <div style={{ marginTop: '10px', fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                {formatHour(startHour)} — {formatHour(endHour)}
            </div>
            {!disabled && <div style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.2)', marginTop: '4px' }}>drag hands to adjust</div>}
        </div>
    );
}

// ── Profile View ────────────────────────────────────────────────────────────

export function ProfileView() {
    const { user, profile: authProfile, updateProfile, signOut } = useAuth();
    const navigate = useNavigate();
    const { ref, visible } = useInView(0.1);

    type PersonalityType = 'warm' | 'expert' | 'philosophical' | 'playful';
    type ExperienceLevelType = 'beginner' | 'intermediate' | 'expert';

    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const [editableProfile, setEditableProfile] = useState<{
        display_name: string; location: string; experience_level: ExperienceLevelType;
        pets: string[]; personality: PersonalityType; primary_concerns: string[];
    }>({
        display_name: authProfile?.display_name || '',
        location: authProfile?.location || '',
        experience_level: (authProfile?.experience_level as ExperienceLevelType) || 'beginner',
        pets: authProfile?.pets || [],
        personality: authProfile?.personality || 'warm',
        primary_concerns: authProfile?.primary_concerns || [],
    });

    useEffect(() => {
        if (authProfile) {
            setEditableProfile({
                display_name: authProfile.display_name || '',
                location: authProfile.location || '',
                experience_level: (authProfile.experience_level as ExperienceLevelType) || 'beginner',
                pets: authProfile.pets || [],
                personality: authProfile.personality || 'warm',
                primary_concerns: authProfile.primary_concerns || [],
            });
        }
    }, [authProfile]);

    const handleSaveProfile = async () => {
        setIsSaving(true); setSaveError(null);
        const { error } = await updateProfile({
            display_name: editableProfile.display_name || null,
            location: editableProfile.location || null,
            experience_level: editableProfile.experience_level,
            pets: editableProfile.pets,
            personality: editableProfile.personality,
            primary_concerns: editableProfile.primary_concerns,
        });
        setIsSaving(false);
        if (error) setSaveError(error.message); else setIsEditingProfile(false);
    };

    const handleCancelEdit = () => {
        if (authProfile) {
            setEditableProfile({
                display_name: authProfile.display_name || '',
                location: authProfile.location || '',
                experience_level: authProfile.experience_level || 'beginner',
                pets: authProfile.pets || [],
                personality: authProfile.personality || 'warm',
                primary_concerns: authProfile.primary_concerns || [],
            });
        }
        setIsEditingProfile(false); setSaveError(null);
    };

    const handleSignOut = async () => { await signOut(); navigate('/login'); };

    const togglePet = (petId: string) => {
        if (!isEditingProfile) return;
        setEditableProfile(prev => ({
            ...prev,
            pets: prev.pets.includes(petId) ? prev.pets.filter(p => p !== petId) : [...prev.pets, petId],
        }));
    };

    const updatePersonality = (mode: PersonalityType) => {
        if (!isEditingProfile) return;
        setEditableProfile(prev => ({ ...prev, personality: mode }));
    };

    // ── System settings ──
    const { data: systemSettings, needsInitialization } = useSystemSettings();
    const updateQuietHours = useUpdateQuietHours();
    const togglePreference = useTogglePreference();
    const toggleAgentPermission = useToggleAgentPermission();
    const initializeSettings = useInitializeSettings();
    const initializationAttempted = useRef(false);

    useEffect(() => {
        if (needsInitialization && !initializationAttempted.current && !initializeSettings.isPending) {
            initializationAttempted.current = true;
            initializeSettings.mutate();
        }
    }, [needsInitialization, initializeSettings]);

    const [isEditingProtocols, setIsEditingProtocols] = useState(false);

    const protocols = (systemSettings && !needsInitialization) ? {
        quietHoursStart: parseInt(systemSettings.quiet_hours_start?.split(':')[0] || '22'),
        quietHoursEnd: parseInt(systemSettings.quiet_hours_end?.split(':')[0] || '7'),
        careReminders: systemSettings.care_reminders_enabled ?? true,
        observations: systemSettings.observations_enabled ?? true,
        seasonalTips: systemSettings.seasonal_tips_enabled ?? true,
        healthFollowups: systemSettings.health_followups_enabled ?? true,
        canDeletePlants: systemSettings.can_delete_plants ?? false,
        canDeleteNotes: systemSettings.can_delete_notes ?? false,
        canDeleteInsights: systemSettings.can_delete_insights ?? false,
        canSendReminders: systemSettings.can_send_reminders ?? true,
        canSendInsights: systemSettings.can_send_insights ?? true,
        canCreateReminders: systemSettings.can_create_reminders ?? true,
    } : null;

    const [tempProtocols, setTempProtocols] = useState(protocols);

    useEffect(() => {
        if (systemSettings && !isEditingProtocols) {
            setTempProtocols({
                quietHoursStart: parseInt(systemSettings.quiet_hours_start?.split(':')[0] || '22'),
                quietHoursEnd: parseInt(systemSettings.quiet_hours_end?.split(':')[0] || '7'),
                careReminders: systemSettings.care_reminders_enabled ?? true,
                observations: systemSettings.observations_enabled ?? true,
                seasonalTips: systemSettings.seasonal_tips_enabled ?? true,
                healthFollowups: systemSettings.health_followups_enabled ?? true,
                canDeletePlants: systemSettings.can_delete_plants ?? false,
                canDeleteNotes: systemSettings.can_delete_notes ?? false,
                canDeleteInsights: systemSettings.can_delete_insights ?? false,
                canSendReminders: systemSettings.can_send_reminders ?? true,
                canSendInsights: systemSettings.can_send_insights ?? true,
                canCreateReminders: systemSettings.can_create_reminders ?? true,
            });
        }
    }, [systemSettings, isEditingProtocols]);

    const handleEditProtocols = () => { setTempProtocols(protocols); setIsEditingProtocols(true); };
    const handleSaveProtocols = async () => {
        const s = `${String(tempProtocols!.quietHoursStart).padStart(2, '0')}:00`;
        const e = `${String(tempProtocols!.quietHoursEnd).padStart(2, '0')}:00`;
        try {
            await updateQuietHours.mutateAsync({ start: s, end: e });
            if (tempProtocols!.careReminders !== protocols!.careReminders) await togglePreference.mutateAsync({ topic: 'care_reminders', enabled: tempProtocols!.careReminders });
            if (tempProtocols!.observations !== protocols!.observations) await togglePreference.mutateAsync({ topic: 'observations', enabled: tempProtocols!.observations });
            if (tempProtocols!.seasonalTips !== protocols!.seasonalTips) await togglePreference.mutateAsync({ topic: 'seasonal_tips', enabled: tempProtocols!.seasonalTips });
            if (tempProtocols!.healthFollowups !== protocols!.healthFollowups) await togglePreference.mutateAsync({ topic: 'health_followups', enabled: tempProtocols!.healthFollowups });
            if (tempProtocols!.canDeletePlants !== protocols!.canDeletePlants) await toggleAgentPermission.mutateAsync({ capability: 'delete_plants', enabled: tempProtocols!.canDeletePlants });
            if (tempProtocols!.canDeleteNotes !== protocols!.canDeleteNotes) await toggleAgentPermission.mutateAsync({ capability: 'delete_notes', enabled: tempProtocols!.canDeleteNotes });
            if (tempProtocols!.canDeleteInsights !== protocols!.canDeleteInsights) await toggleAgentPermission.mutateAsync({ capability: 'delete_insights', enabled: tempProtocols!.canDeleteInsights });
            if (tempProtocols!.canSendReminders !== protocols!.canSendReminders) await toggleAgentPermission.mutateAsync({ capability: 'send_reminders', enabled: tempProtocols!.canSendReminders });
            if (tempProtocols!.canSendInsights !== protocols!.canSendInsights) await toggleAgentPermission.mutateAsync({ capability: 'send_insights', enabled: tempProtocols!.canSendInsights });
            if (tempProtocols!.canCreateReminders !== protocols!.canCreateReminders) await toggleAgentPermission.mutateAsync({ capability: 'create_reminders', enabled: tempProtocols!.canCreateReminders });
        } catch (err) { console.error('Failed to save protocols:', err); }
        setIsEditingProtocols(false);
    };
    const handleCancelProtocols = () => { setTempProtocols(protocols); setIsEditingProtocols(false); };
    const updateTempProtocol = (key: string, value: any) => { if (!isEditingProtocols) return; setTempProtocols(prev => ({ ...prev!, [key]: value })); };
    const toggleTempProtocol = (key: string) => { if (!isEditingProtocols) return; setTempProtocols(prev => ({ ...prev!, [key]: !prev![key as keyof typeof prev] })); };

    // ── Insights ──
    const { data: userInsights = [], isLoading: insightsLoading } = useUserInsights();
    const deleteInsight = useDeleteInsight();

    // ── Styles ──
    const cardStyle: React.CSSProperties = {
        border: '1px solid rgba(255,255,255,0.06)',
        padding: '24px',
    };

    const labelStyle: React.CSSProperties = {
        fontFamily: mono, fontSize: '9px', textTransform: 'uppercase',
        letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', marginBottom: '6px',
    };

    const inputStyle: React.CSSProperties = {
        fontFamily: mono, fontSize: '13px', width: '100%',
        backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
        color: 'white', padding: '8px 10px', outline: 'none',
    };

    const valueStyle: React.CSSProperties = {
        fontFamily: mono, fontSize: '13px', color: 'rgba(255,255,255,0.6)',
    };

    return (
        <div ref={ref as React.RefObject<HTMLDivElement>} className="flex flex-col gap-8">

            {/* ── Profile card ── */}
            <div style={{ ...cardStyle, ...revealStyle(visible, 0) }}>
                {/* ID badge */}
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '20px' }}>
                    {authProfile?.id ? `user_id: ${authProfile.id.slice(0, 8)}` : 'user_id: ---'}
                </div>

                {saveError && (
                    <div style={{ padding: '8px 12px', border: '1px solid rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.06)', marginBottom: '16px', fontSize: '12px', color: '#ef4444' }}>
                        {saveError}
                    </div>
                )}

                {/* Name + edit controls */}
                <div className="flex justify-between items-start mb-6">
                    <div className="flex-1">
                        <div style={labelStyle}>display name</div>
                        {isEditingProfile ? (
                            <input
                                type="text"
                                value={editableProfile.display_name}
                                onChange={(e) => setEditableProfile({ ...editableProfile, display_name: e.target.value })}
                                style={{ ...inputStyle, fontSize: '18px' }}
                                placeholder="Your name"
                            />
                        ) : (
                            <div style={{ fontSize: '20px', color: 'white' }}>{editableProfile.display_name || 'Not set'}</div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {isEditingProfile ? (
                            <>
                                <button onClick={handleCancelEdit} disabled={isSaving} className="cursor-pointer" style={{ padding: '6px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.4)' }}>
                                    <X size={14} />
                                </button>
                                <button onClick={handleSaveProfile} disabled={isSaving} className="cursor-pointer" style={{ padding: '6px', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white' }}>
                                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                </button>
                            </>
                        ) : (
                            <button onClick={() => setIsEditingProfile(true)} className="cursor-pointer" style={{ padding: '6px', border: '1px solid transparent', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.3)' }}>
                                <Edit2 size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Fields grid */}
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <div style={labelStyle}>experience level</div>
                        {isEditingProfile ? (
                            <select
                                value={editableProfile.experience_level}
                                onChange={(e) => setEditableProfile({ ...editableProfile, experience_level: e.target.value as ExperienceLevelType })}
                                style={{ ...inputStyle, appearance: 'none' }}
                            >
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="expert">Expert</option>
                            </select>
                        ) : (
                            <div style={valueStyle} className="capitalize">{editableProfile.experience_level || 'Not set'}</div>
                        )}
                    </div>
                    <div>
                        <div style={labelStyle}>location</div>
                        {isEditingProfile ? (
                            <input type="text" value={editableProfile.location} onChange={(e) => setEditableProfile({ ...editableProfile, location: e.target.value })} style={inputStyle} placeholder="City or ZIP" />
                        ) : (
                            <div style={valueStyle} className="flex items-center gap-2"><MapPin size={12} /> {editableProfile.location || 'Not set'}</div>
                        )}
                    </div>
                    <div>
                        <div style={labelStyle}>email</div>
                        <div style={valueStyle} className="truncate">{user?.email || 'Not available'}</div>
                    </div>
                    <div>
                        <div style={labelStyle}>phone</div>
                        <div style={valueStyle} className="flex items-center gap-2 truncate"><Phone size={12} /> {authProfile?.phone_number || 'Not linked'}</div>
                    </div>

                    {/* Pets */}
                    <div>
                        <div style={labelStyle}>pets</div>
                        <div className="flex gap-2 flex-wrap">
                            {[
                                { id: 'dog', icon: Dog }, { id: 'cat', icon: Cat }, { id: 'bird', icon: Bird },
                                { id: 'fish', icon: Fish }, { id: 'rabbit', icon: Rabbit },
                            ].map((pet) => {
                                const sel = editableProfile.pets.includes(pet.id);
                                return (
                                    <button key={pet.id} onClick={() => togglePet(pet.id)} disabled={!isEditingProfile}
                                        className={`transition-all duration-200 ${isEditingProfile ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
                                        style={{ background: 'none', border: 'none', padding: 0 }}>
                                        <pet.icon size={24} fill={sel ? 'currentColor' : 'none'} strokeWidth={1.5} style={{ color: sel ? 'white' : 'rgba(255,255,255,0.15)' }} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Agent personality */}
                    <div>
                        <div style={labelStyle}>agent personality</div>
                        <div className="flex gap-2 flex-wrap">
                            {[
                                { id: 'warm', icon: Sun }, { id: 'playful', icon: Zap },
                                { id: 'philosophical', icon: Lightbulb }, { id: 'expert', icon: Microscope },
                            ].map((mode) => {
                                const sel = editableProfile.personality === mode.id;
                                return (
                                    <button key={mode.id} onClick={() => updatePersonality(mode.id as PersonalityType)} disabled={!isEditingProfile}
                                        className={`transition-all duration-200 ${isEditingProfile ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
                                        style={{ background: 'none', border: 'none', padding: 0 }}>
                                        <mode.icon size={24} fill={sel ? 'currentColor' : 'none'} strokeWidth={1.5} style={{ color: sel ? 'white' : 'rgba(255,255,255,0.15)' }} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Interests */}
                    <div className="col-span-2">
                        <div style={labelStyle}>interests</div>
                        {isEditingProfile ? (
                            <input type="text" value={editableProfile.primary_concerns.join(', ')}
                                onChange={(e) => setEditableProfile({ ...editableProfile, primary_concerns: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                style={inputStyle} placeholder="Houseplants, Succulents, etc." />
                        ) : (
                            <div style={valueStyle}>{editableProfile.primary_concerns.length > 0 ? editableProfile.primary_concerns.join(', ') : 'Not set'}</div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── System protocols ── */}
            <div style={revealStyle(visible, 200)}>
                <SystemProtocols
                    protocols={protocols}
                    tempProtocols={tempProtocols}
                    isEditingProtocols={isEditingProtocols}
                    onEdit={handleEditProtocols}
                    onSave={handleSaveProtocols}
                    onCancel={handleCancelProtocols}
                    updateTempProtocol={updateTempProtocol}
                    toggleTempProtocol={toggleTempProtocol}
                    QuietHoursClock={QuietHoursClock}
                />
            </div>

            {/* ── AI Insights ── */}
            <div style={{ ...cardStyle, ...revealStyle(visible, 400) }}>
                <div className="flex items-center gap-2 mb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                    <div style={{ width: 16, height: 16, backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 'bold' }}>AI</div>
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>behavioral insights</span>
                </div>
                <div className="flex flex-col gap-2">
                    {insightsLoading ? (
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', padding: '8px 0' }} className="flex items-center gap-2">
                            <Loader2 size={12} className="animate-spin" /> loading...
                        </div>
                    ) : userInsights.length > 0 ? (
                        userInsights.map((insight: any) => {
                            const getIcon = (key: string) => {
                                if (key.includes('water')) return Droplets;
                                if (key.includes('light')) return Lightbulb;
                                if (key.includes('care')) return Brain;
                                if (key.includes('schedule')) return Calendar;
                                return Microscope;
                            };
                            const Icon = getIcon(insight.insight_key);
                            return (
                                <div key={insight.id} className="flex items-start gap-2 group" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', padding: '6px 8px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                                    <Icon size={12} className="mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }} />
                                    <span className="flex-1">{insight.insight_value}</span>
                                    <button onClick={() => deleteInsight.mutate(insight.id)} disabled={deleteInsight.isPending} className="cursor-pointer transition-colors" style={{ color: 'rgba(255,255,255,0.15)', background: 'none', border: 'none' }}>
                                        {deleteInsight.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                    </button>
                                </div>
                            );
                        })
                    ) : (
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', padding: '8px 0' }}>no insights generated yet</div>
                    )}
                </div>
            </div>

            {/* ── Security (Hidden for now) ── */}
            {/* ── Account actions (Hidden for now) ── */}
            <div style={{ ...revealStyle(visible, 800), border: '1px solid rgba(255,255,255,0.08)', padding: '24px' }}>
                <div className="flex flex-col gap-3">
                    <button onClick={handleSignOut} className="focus:outline-none cursor-pointer flex items-center justify-center gap-2 transition-all" style={{
                        width: '100%', padding: '10px', fontFamily: mono, fontSize: '11px', letterSpacing: '0.06em',
                        border: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'transparent', color: 'rgba(255,255,255,0.5)',
                    }}>
                        <LogOut size={12} /> sign out
                    </button>
                </div>
            </div>
        </div>
    );
}
