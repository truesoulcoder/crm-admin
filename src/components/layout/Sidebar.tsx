'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, FileText, Send, UserCog, Settings, Briefcase } from 'lucide-react';
import { CrmView } from '@/types';
import clsx from 'clsx';
import { LetterFx } from '../../once-ui/components';

interface MenuItem {
  view: CrmView;
  icon: React.ReactElement;
  label: string;
}

const menuItems: MenuItem[] = [
  { view: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
  { view: 'leads', icon: <Users size={20} />, label: 'Lead Management' },
  { view: 'campaigns', icon: <Send size={20} />, label: 'Campaigns' },
  { view: 'templates', icon: <FileText size={20} />, label: 'Templates' },
  { view: 'senders', icon: <UserCog size={20} />, label: 'Senders' },
  { view: 'settings', icon: <Settings size={20} />, label: 'Settings' },
];

const Sidebar: React.FC = () => {
  const pathname = usePathname();

  // Map CrmView to route paths
  const viewToPath: Record<CrmView, string> = {
    dashboard: '/dashboard',
    leads: '/leads',
    campaigns: '/campaigns',
    templates: '/templates',
    senders: '/senders',
    settings: '/settings',
  };

  return (
    <aside className="bg-base-200 text-base-content w-64 min-h-screen p-4 flex flex-col">
      <div className="flex items-center mb-8">
        <Briefcase size={32} className="text-primary mr-2" />
        <h1 className="text-2xl font-bold text-primary">CRM SPA</h1>
      </div>
      <ul className="menu space-y-2 flex-1">
        {menuItems.map((item) => (
          <li key={item.view}>
            <Link
              href={viewToPath[item.view]}
              className={clsx(
                'flex items-center p-2 rounded-lg hover:bg-primary hover:text-primary-content transition-colors duration-200 w-full',
                pathname === viewToPath[item.view] ? 'bg-primary text-primary-content font-semibold' : 'text-base-content'
              )}
            >
              {item.icon}
              <LetterFx trigger="hover" speed="fast" className="ml-3">
                {item.label}
              </LetterFx>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-auto">
        <p className="text-xs text-center text-base-content/70">
          &copy; {new Date().getFullYear()} Your Company
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
