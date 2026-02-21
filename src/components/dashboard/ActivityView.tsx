import { useState } from 'react';
import { Leaf, Activity, User, Terminal } from 'lucide-react';
import { useActivityFeed } from '@/hooks/useActivity';
import { useInView, revealStyle } from './DashboardShell';

const mono = "ui-monospace, monospace";

type FilterId = 'all' | 'user' | 'agent' | 'system';

export function ActivityView() {
    const [filter, setFilter] = useState<FilterId>('all');
    const { activities, isLoading } = useActivityFeed();
    const { ref, visible } = useInView(0.1);

    const getCategory = (activity: any): string => {
        if (activity.type === 'care') return 'user';
        if (activity.type === 'conversation') return activity.subtype === 'inbound' ? 'user' : 'agent';
        return 'system';
    };

    const filtered = filter === 'all'
        ? activities
        : activities.filter((a: any) => getCategory(a) === filter);

    const filters: { id: FilterId; label: string }[] = [
        { id: 'all', label: 'all' },
        { id: 'user', label: 'user' },
        { id: 'agent', label: 'agent' },
        { id: 'system', label: 'system' },
    ];

    return (
        <div ref={ref as React.RefObject<HTMLDivElement>} style={revealStyle(visible, 0)}>
            {/* Filters */}
            <div className="flex gap-2 mb-8" style={revealStyle(visible, 100)}>
                {filters.map((f) => (
                    <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        className="cursor-pointer transition-all duration-200"
                        style={{
                            fontFamily: mono,
                            fontSize: '10px',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase' as const,
                            padding: '6px 14px',
                            border: '1px solid',
                            borderColor: filter === f.id ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.06)',
                            backgroundColor: filter === f.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                            color: filter === f.id ? 'white' : 'rgba(255,255,255,0.3)',
                        }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-5 w-5" style={{ border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'rgba(255,255,255,0.4)' }} />
                </div>
            )}

            {/* Empty */}
            {!isLoading && filtered.length === 0 && (
                <div className="text-center py-16" style={revealStyle(visible, 200)}>
                    <Activity size={28} style={{ margin: '0 auto 12px', color: 'rgba(255,255,255,0.15)' }} />
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>No activity yet</p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', marginTop: '4px' }}>Care events and messages will appear here</p>
                </div>
            )}

            {/* Timeline */}
            {!isLoading && filtered.length > 0 && (
                <div className="relative" style={{ paddingLeft: '28px' }}>
                    {/* Vertical line */}
                    <div
                        className="absolute top-0 bottom-0"
                        style={{ left: '8px', width: '1px', backgroundColor: 'rgba(255,255,255,0.06)' }}
                    />

                    <div className="flex flex-col gap-6">
                        {filtered.map((activity: any, i: number) => {
                            const category = getCategory(activity);
                            const isAgent = category === 'agent';

                            return (
                                <div
                                    key={activity.id}
                                    className="relative"
                                    style={revealStyle(visible, 200 + i * 40)}
                                >
                                    {/* Timeline dot */}
                                    <div
                                        className="absolute"
                                        style={{
                                            left: '-24px',
                                            top: '4px',
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            backgroundColor: isAgent ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                        }}
                                    />

                                    {/* Card */}
                                    <div
                                        style={{
                                            border: '1px solid rgba(255,255,255,0.06)',
                                            padding: '14px 16px',
                                        }}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                {category === 'user' && <User size={12} style={{ color: 'rgba(255,255,255,0.35)' }} />}
                                                {category === 'agent' && <Terminal size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />}
                                                {category === 'system' && <Activity size={12} style={{ color: 'rgba(255,255,255,0.25)' }} />}
                                                <span style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.3)', fontWeight: 'bold' }}>
                                                    {activity.type}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', textAlign: 'right' as const }}>
                                                <div>{new Date(activity.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                                                <div>{new Date(activity.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                                            </div>
                                        </div>

                                        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>
                                            {activity.title}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: '1.6' }}>
                                            {activity.description}
                                        </div>

                                        {activity.plantName && (
                                            <div className="flex items-center gap-1 mt-2" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
                                                <Leaf size={11} />
                                                <span>{activity.plantName}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
