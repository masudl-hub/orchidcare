import { useState } from 'react';
import { Plus, Loader2, Filter } from 'lucide-react';
import { usePlants } from '@/hooks/usePlants';
import { useInView, revealStyle, useDecryptText } from './DashboardShell';
import { useNavigate } from 'react-router-dom';

const mono = "ui-monospace, monospace";
const pressStart = '"Press Start 2P", cursive';

// 1-bit Pixel Leaf
const PixelLeaf = ({ size = 16, className = '', style = {} }: { size?: number, className?: string, style?: React.CSSProperties }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} style={{ shapeRendering: 'crispEdges', ...style }}>
        <path d="M8 1h2v1h1v1h1v1h1v2h1v4h-1v1h-1v1h-1v1h-1v1h-1v1H8v-2H7v-1H6v-1H5v-1H4V9H3V5h1V4h1V3h1V2h1V1h1zm1 2H8v1H7v1H6v1H5v3h1v1h1v1h1v1h1v-1h1V9h1V6h-1V5h-1V4h-1V3z" />
        <rect x="7" y="5" width="2" height="6" />
        <rect x="9" y="6" width="1" height="2" />
    </svg>
);

interface CollectionViewProps {
    onSelectPlant: (id: string) => void;
}

export function CollectionView({ onSelectPlant }: CollectionViewProps) {
    const { data: plants, isLoading } = usePlants();
    const { ref, visible } = useInView(0.1);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();

    const filteredPlants = plants?.filter((p: any) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (p.nickname || '').toLowerCase().includes(q) ||
            (p.name || '').toLowerCase().includes(q) ||
            (p.species || '').toLowerCase().includes(q) ||
            (p.location_in_home || '').toLowerCase().includes(q)
        );
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-24" style={{ fontFamily: mono }}>
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <span style={{ marginLeft: 12, fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>loading...</span>
            </div>
        );
    }

    return (
        <div ref={ref as React.RefObject<HTMLDivElement>} style={revealStyle(visible, 0)}>
            {/* Search + actions */}
            <div className="flex flex-col sm:flex-row gap-3 mb-8" style={revealStyle(visible, 100)}>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="search plants..."
                    style={{
                        flex: 1,
                        fontFamily: mono,
                        fontSize: '12px',
                        padding: '10px 14px',
                        backgroundColor: 'transparent',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'white',
                        outline: 'none',
                    }}
                />
            </div>

            {/* Count */}
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: '24px' }}>
                {filteredPlants?.length || 0} specimens
            </div>

            {/* Empty state */}
            {(!filteredPlants || filteredPlants.length === 0) && (
                <div className="text-center py-16" style={revealStyle(visible, 200)}>
                    <PixelLeaf size={32} style={{ margin: '0 auto 16px', color: 'rgba(255,255,255,0.15)' }} />
                    <p style={{ fontFamily: pressStart, fontSize: '11px', marginBottom: '8px' }}>
                        {searchQuery ? 'no matches' : 'no plants yet'}
                    </p>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginBottom: '24px' }}>
                        {searchQuery ? 'Try a different search' : (
                            <>Start building your collection via <button onClick={() => navigate('/chat')} className="underline hover:text-white transition-colors cursor-pointer bg-transparent border-none p-0 inline font-inherit text-inherit">chat</button></>
                        )}
                    </p>
                </div>
            )}

            {/* Plant grid */}
            {filteredPlants && filteredPlants.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPlants.map((plant: any, i: number) => (
                        <button
                            key={plant.id}
                            onClick={() => onSelectPlant(plant.id)}
                            className="text-left cursor-pointer group transition-all duration-200"
                            style={{
                                ...revealStyle(visible, 150 + i * 60),
                                border: '1px solid rgba(255,255,255,0.06)',
                                padding: '20px',
                                backgroundColor: 'transparent',
                                position: 'relative',
                                overflow: 'hidden',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                        >
                            <div className="relative z-10 flex gap-4">
                                {/* Thumbnail */}
                                <div className="w-12 h-12 shrink-0 border border-[rgba(255,255,255,0.1)] flex items-center justify-center bg-[rgba(255,255,255,0.02)] overflow-hidden">
                                    {plant.photo_url ? (
                                        <img src={plant.photo_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <PixelLeaf size={20} style={{ color: 'rgba(255,255,255,0.15)' }} />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    {/* Status + ID */}
                                    <div className="flex justify-between items-center mb-2">
                                        <span style={{
                                            fontSize: '9px',
                                            letterSpacing: '0.12em',
                                            textTransform: 'uppercase' as const,
                                            color: 'rgba(255,255,255,0.25)',
                                        }}>
                                            {plant.id.slice(0, 8)}
                                        </span>
                                        <span style={{
                                            fontSize: '9px',
                                            letterSpacing: '0.08em',
                                            textTransform: 'uppercase' as const,
                                            color: '#4ade80',
                                        }}>
                                            active
                                        </span>
                                    </div>

                                    {/* Name */}
                                    <div className="truncate" style={{ fontSize: '14px', color: 'white', marginBottom: '2px' }}>
                                        {plant.nickname || plant.name}
                                    </div>
                                    <div className="truncate" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                                        {plant.species || 'Unknown species'}
                                    </div>
                                </div>
                            </div>

                            {/* Meta row */}
                            <div className="grid grid-cols-3 gap-3 mt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                                <div>
                                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '4px' }}>location</div>
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{plant.location_in_home || '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '4px' }}>added</div>
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                                        {plant.created_at
                                            ? new Date(plant.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                            : '—'}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '4px' }}>care</div>
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{plant.nextReminder ? 'Due' : '—'}</div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
