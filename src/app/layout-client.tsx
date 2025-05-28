// src/app/layout-client.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/hooks/useTheme';
import { useUser } from '@/contexts/UserContext';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, role, isLoading } = useUser();

  useEffect(() => {
    const root = document.documentElement;
    root.removeAttribute('class');
    if (theme && theme !== 'system') {
      root.setAttribute('data-theme', theme);
    } else if (typeof window !== 'undefined') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.setAttribute('data-theme', systemTheme);
    }
  }, [theme]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  // For login page, don't show the full layout
  if (pathname === '/login') {
    return <div>{children}</div>;
  }

  // For authenticated users, show the full layout with sidebar and navbar
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 w-full max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}