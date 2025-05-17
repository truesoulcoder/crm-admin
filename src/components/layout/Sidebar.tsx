'use client';

import clsx from 'clsx';
import { LayoutDashboard, Users, FileText, Send, UserCog, Settings, Briefcase, Contact } from 'lucide-react';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { LetterFx } from '@/once-ui/components';

import type { CrmView } from '@/types/index';

type ViewPath = {
  [K in CrmView]: string;
};

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
  { view: 'crm', icon: <Contact size={20} />, label: 'CRM' },
  { view: 'settings', icon: <Settings size={20} />, label: 'Settings' },
];

const Sidebar: React.FC = () => {
  // TODO: Replace this with actual logic to fetch/get companyLogoUrl from settings
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  // TODO: Replace this with actual logic to fetch/get companyName from settings
  const [companyName, setCompanyName] = useState<string | null>(null);

  // Example: Fetch settings on component mount (you'll need to adapt this)
  // useEffect(() => {
  //   const fetchSettings = async () => {
  //     // Replace with your actual settings fetching logic
  //     // const settings = await getAppSettings(); 
  //     // if (settings && settings.logoUrl) {
  //     //   setCompanyLogoUrl(settings.logoUrl);
  //     // }
  //   };
  //   fetchSettings();
  // }, []);
  const pathname = usePathname();

  // Map CrmView to route paths
  const viewToPath: ViewPath = {
    dashboard: '/dashboard',
    leads: '/leads',
    campaigns: '/campaigns',
    templates: '/templates',
    senders: '/email-senders',
    crm: '/crm',
    settings: '/settings'
  };

  return (
    <aside className="bg-base-200 text-base-content w-64 min-h-screen p-4 flex flex-col">
      <div className="flex items-center justify-center mb-8">
        <img 
          src={companyLogoUrl || 'https://oviiqouhtdajfwhpwbyq.supabase.co/storage/v1/object/public/media//logo.png'} 
          alt="Company Logo" 
          width="180" 
          height="45" 
          className="object-contain" 
        />
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
          &copy; {new Date().getFullYear()} {companyName || 'True Soul Partners'}
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
