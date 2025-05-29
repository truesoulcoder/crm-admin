'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { useTheme } from '@/hooks/useTheme';

import Providers from './providers';

import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedTheme || 'night');
  }, [resolvedTheme]);

  const toggleMobileSidebar = () => {
    const drawerCheckbox = document.getElementById('sidebar-drawer-toggle') as HTMLInputElement | null;
    if (drawerCheckbox) {
      drawerCheckbox.checked = !drawerCheckbox.checked;
      setIsMobileSidebarOpen(drawerCheckbox.checked);
    }
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>CRM Admin</title>
        <meta name="description" content="CRM Admin Dashboard" />
      </head>
      <body>
        <Providers>
            <div className="drawer lg:drawer-open">
              <input 
                id="sidebar-drawer-toggle" 
                type="checkbox" 
                className="drawer-toggle" 
              />
              <div className="drawer-content flex flex-col">
                <Navbar 
                  toggleSidebar={toggleMobileSidebar} 
                  isSidebarOpen={isMobileSidebarOpen} 
                />
                <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-base-100">
                  {children}
                </main>
              </div>
              <div className="drawer-side z-30">
                <label 
                  htmlFor="sidebar-drawer-toggle" 
                  aria-label="close sidebar" 
                  className="drawer-overlay"
                ></label>
                <Sidebar />
              </div>
            </div>
        </Providers>
      </body>
    </html>
  );
}