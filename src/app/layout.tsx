'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import { useTheme } from '@/hooks/useTheme';

import Providers from './providers';
import './main.css';
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
      <body className="min-h-screen">
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <Navbar 
                toggleSidebar={toggleMobileSidebar} 
                isSidebarOpen={isMobileSidebarOpen} 
              />
              <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 bg-base-100">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}