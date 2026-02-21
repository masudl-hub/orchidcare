import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Leaf, Activity, User, Terminal, MessageSquare, Phone, LayoutDashboard, FileText } from 'lucide-react';

interface NavItem {
    id: string;
    icon: React.ElementType;
    path: string;
    isGroupRight?: boolean;
}

export function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const path = location.pathname;

    if (path === '/call') return null;

    const isDeveloperContext = path.startsWith('/developer');

    const navItems: NavItem[] = isDeveloperContext
        ? [
            { id: '/dashboard', icon: LayoutDashboard, path: '/dashboard/collection' },
            { id: '/developer', icon: Terminal, path: '/developer' },
            { id: '/developer/docs', icon: FileText, path: '/developer/docs', isGroupRight: true },
            { id: '/dashboard/collection', icon: Leaf, path: '/dashboard/collection' },
            { id: '/chat', icon: MessageSquare, path: '/chat' },
            { id: '/call', icon: Phone, path: '/call' },
          ]
        : [
            { id: '/dashboard/collection', icon: Leaf, path: '/dashboard/collection' },
            { id: '/dashboard/activity', icon: Activity, path: '/dashboard/activity' },
            { id: '/dashboard/profile', icon: User, path: '/dashboard/profile' },
            { id: '/developer', icon: Terminal, path: '/developer', isGroupRight: true },
            { id: '/chat', icon: MessageSquare, path: '/chat' },
            { id: '/call', icon: Phone, path: '/call' },
          ];

    let activePath = path;
    if (path === '/dashboard') activePath = '/dashboard/collection';

    return (
        <div className="fixed bottom-0 left-0 w-full z-50 md:hidden bg-black/95 backdrop-blur-md border-t border-white/10"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex items-center justify-around px-2 py-3">
                {navItems.map((item) => {
                    const isActive = activePath.startsWith(item.path) || 
                        (item.id === '/developer' && isDeveloperContext && item.path === '/developer');

                    return (
                        <React.Fragment key={item.id}>
                            {item.isGroupRight && (
                                <div className="w-[1px] h-6 bg-white/10 mx-1" />
                            )}
                            <button
                                onClick={() => navigate(item.path)}
                                className="flex items-center justify-center flex-1 min-w-0"
                                style={{ WebkitTapHighlightColor: 'transparent' }}
                            >
                                <item.icon
                                    size={18}
                                    strokeWidth={isActive ? 2.5 : 1.5}
                                    className={`transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}
                                />
                            </button>
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}
