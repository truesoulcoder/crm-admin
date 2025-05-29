'use client';

import { LayoutDashboard, Users, Mail, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/lib/utils';

// Dynamically import PigAnimation with no SSR to avoid window is not defined errors
const PigAnimation = dynamic(() => import('@/styles/PigAnimation').then(mod => mod.default), {
  ssr: false,
  loading: () => <div className="w-full h-32 flex items-center justify-center">Loading animation...</div>
});

interface MenuItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

const menuItems: MenuItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard size={20} />,
  },
  {
    name: 'Leads',
    href: '/leads',
    icon: <Users size={20} />,
  },
  {
    name: 'Senders',
    href: '/Senders',
    icon: <Mail size={20} />,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: <Settings size={20} />,
  },
  {
    name: 'Crondonkey',
    href: '/Crondonkey',
    icon: <Settings size={20} />,
  }
];

interface SidebarProps {
  onClose?: () => void;
}

export default function Sidebar({ onClose }: SidebarProps = {}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside className={cn(
      'bg-base-200 text-base-content transition-all duration-300 ease-in-out',
      isCollapsed ? 'w-16' : 'w-64',
      'flex flex-col h-screen sticky top-0'
    )}>
      <div className="p-4 flex items-center justify-between">
        {!isCollapsed && (
          <div className="font-bold text-xl">CRM Admin</div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="btn btn-ghost btn-sm"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
      
      <nav className="flex-1 overflow-y-auto">
        <ul className="menu p-2">
          {menuItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center p-2 rounded-lg',
                    isActive
                      ? 'bg-primary text-primary-content'
                      : 'hover:bg-base-300'
                  )}
                >
                  {item.icon}
                  {!isCollapsed && <span className="ml-3">{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-4 bg-base-200 rounded-full p-1 shadow-md hover:bg-base-300 transition-colors"
      >
        <ChevronLeft className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
      </button>
      
      {!isCollapsed && (
        <div className="p-4 border-t border-base-300">
          <div className="mb-4">
            <PigAnimation />
          </div>
        </div>
      )}
    </aside>
  );
}
