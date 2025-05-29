// src/app/layout.tsx
'use client';

import { Inter } from 'next/font/google';
import { ReactNode, useState, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import Providers from './providers';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Mail, Settings, Menu, X } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const inter = Inter({ subsets: ['latin'] });

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Campaigns', href: '/campaigns', icon: Mail },
  { name: 'Templates', href: '/templates', icon: Mail },
  { name: 'Senders', href: '/senders', icon: Mail },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Apply theme
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = document.documentElement;
      root.className = resolvedTheme || 'night';
      root.setAttribute('data-theme', resolvedTheme || 'night');
    }
  }, [resolvedTheme]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="dark light" />
      </head>
      <body className={inter.className}>
        <Providers>
          <div className="app-container">
            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-xl font-bold">CRM Admin</h1>
                <button 
                  onClick={() => setSidebarOpen(false)} 
                  className="md:hidden p-1 hover:bg-base-200 rounded"
                >
                  <X size={20} />
                </button>
              </div>
              
              <nav className="nav-menu">
                {navItems.map((item) => {
                  const isActive = pathname?.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-link ${isActive ? 'active' : ''}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>

            {/* Mobile overlay */}
            {sidebarOpen && (
              <div 
                className="sidebar-overlay open" 
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* Main content */}
            <main className="main-content">
              <header className="header">
                <button 
                  onClick={() => setSidebarOpen(true)} 
                  className="md:hidden p-2 mr-2 hover:bg-base-200 rounded"
                >
                  <Menu size={20} />
                </button>
                <div className="flex-1" />
                <ThemeToggle />
              </header>
              
              <div className="content">
                {children}
              </div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}