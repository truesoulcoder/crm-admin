// src/app/layout.tsx
'use client';

import './main.css';
import './globals.css';

import { 
  Users, 
  Settings, 
  Menu, 
  LayoutDashboard,
  Mailbox,
  FileText,
  Send
} from 'lucide-react';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState, useEffect } from 'react';

import AppLayout from '@/components/layout/AppLayout';
import ThemeToggle from '@/components/ThemeToggle';
import { useTheme } from '@/hooks/useTheme';

const inter = Inter({ subsets: ['latin'] });

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'CRM', href: '/crm', icon: Users },
  { name: 'Campaigns', href: '/campaigns', icon: Send },
  { name: 'Templates', href: '/templates', icon: FileText },
  { name: 'Senders', href: '/senders', icon: Mailbox },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const RootLayout = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { resolvedTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme) {
      root.setAttribute('data-theme', resolvedTheme);
    } else {
      // Fallback to night theme if resolvedTheme is not available yet
      root.setAttribute('data-theme', 'night');
    }
  }, [resolvedTheme]);

  // Close sidebar when route changes
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);


  return (
    <AppLayout>
      {children}
    </AppLayout>
  );
};

export default RootLayout;