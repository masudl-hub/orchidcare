import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Leaf, Activity, User, Terminal, MessageSquare, Phone } from 'lucide-react';

const mono = "ui-monospace, monospace";

interface NavItem {
    id: string;
    label: string;
    icon: React.ElementType;
    path: string;
    isGroupRight?: boolean; // Whether to place a visual separator before this item
}

export function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const path = location.pathname;

    // Do not show on the call screen
    if (path === '/call') return null;

    const navItems: NavItem[] = [
        { id: '/dashboard/collection', label: 'Col.', icon: Leaf, path: '/dashboard/collection' },
        { id: '/dashboard/activity', label: 'Act.', icon: Activity, path: '/dashboard/activity' },
        { id: '/dashboard/profile', label: 'Pro.', icon: User, path: '/dashboard/profile' },
        { id: '/developer', label: 'Dev.', icon: Terminal, path: '/developer', isGroupRight: true },
        { id: '/chat', label: 'Chat', icon: MessageSquare, path: '/chat' },
        { id: '/call', label: 'Call', icon: Phone, path: '/call' },
    ];

    // Determine active item, with fallback to collection if just on /dashboard
    let activePath = path;
    if (path === '/dashboard') activePath = '/dashboard/collection';

    return (
        <div className="fixed bottom-0 left-0 w-full z-50 md:hidden bg-black/95 backdrop-blur-md border-t border-white/10"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex items-center justify-around px-2 py-3">
                {navItems.map((item, index) => {
                    const isActive = activePath.startsWith(item.path);

                    return (
                        <React.Fragment key={item.id}>
                            {item.isGroupRight && (
                                <div className="w-[1px] h-8 bg-white/10 mx-1" />
                            )}
                            <button
                                onClick={() => navigate(item.path)}
                                className="flex flex-col items-center justify-center gap-1.5 flex-1 min-w-0"
                                style={{ WebkitTapHighlightColor: 'transparent' }}
                            >
                                <item.icon
                                    size={18}
                                    strokeWidth={isActive ? 2.5 : 1.5}
                                    className={`transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}
                                />
                                <span
                                    className={`text-[9px] tracking-wider transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}
                                    style={{ fontFamily: mono }}
                                >
                                    {item.label}
                                </span>
                            </button>
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}
