'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';

import Navbar from './Navbar';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname() || '';

  // Don't show layout on auth pages
  const isAuthPage = ['/login', '/auth/callback', '/'].includes(pathname);
  
  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-base-100 overflow-hidden">
      {/* Mobile sidebar */}
      <div className={`lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 z-40">
          <div className="fixed inset-0 bg-black/20" onClick={() => setSidebarOpen(false)} />
          <div className="relative flex w-72 max-w-xs flex-1 flex-col bg-base-200">
            <div className="h-0 flex-1 overflow-y-auto pb-4 pt-5">
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:pl-72">
        <Navbar />
        <main className="flex-1 overflow-y-auto bg-base-100 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
