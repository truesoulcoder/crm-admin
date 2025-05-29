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
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="dark light" />
        <title>CRM Admin</title>
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <div className="drawer lg:drawer-open">
          <input 
            id="sidebar-drawer" 
            type="checkbox" 
            className="drawer-toggle"
            checked={sidebarOpen}
            onChange={(e) => setSidebarOpen(e.target.checked)}
          />
          
          {/* Main content */}
          <div className="drawer-content flex flex-col bg-base-200">
            {/* Navbar */}
            <div className="navbar bg-base-100 shadow-sm">
              <div className="flex-none lg:hidden">
                <label 
                  htmlFor="sidebar-drawer" 
                  className="btn btn-square btn-ghost"
                >
                  <Menu className="h-5 w-5" />
                </label>
              </div>
              <div className="flex-1 px-2 mx-2 font-semibold text-lg">
                CRM Admin
              </div>
              <div className="flex-none">
                <ThemeToggle />
              </div>
            </div>
            
            {/* Page content */}
            <main className="flex-1 p-4 md:p-6 overflow-auto">
              {children}
            </main>
          </div>
          
          {/* Sidebar */}
          <div className="drawer-side z-30">
            <label 
              htmlFor="sidebar-drawer" 
              className="drawer-overlay"
              aria-label="close sidebar"
            />
            <div className="bg-base-100 w-64 min-h-full flex flex-col">
              <div className="p-4 border-b border-base-300">
                <h1 className="text-xl font-bold">CRM Admin</h1>
              </div>
              <nav className="menu p-4 w-64 flex-1">
                <ul className="space-y-1">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-3 ${isActive ? 'active' : ''}`}
                        >
                          <Icon className="h-5 w-5" />
                          {item.name}
                          {isActive && (
                            <span className="absolute inset-y-0 right-4 flex items-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <div className="p-4 border-t border-base-300">
                <div className="flex items-center gap-3">
                  <div className="avatar placeholder">
                    <div className="bg-neutral text-neutral-content rounded-full w-10">
                      <span>U</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">Admin User</p>
                    <p className="text-xs opacity-70">admin@example.com</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
};

export default RootLayout;