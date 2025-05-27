"use client";

import { useEffect } from 'react';

import MainAppShell from '@/components/layout/MainAppShell';
import { useTheme } from '@/hooks/useTheme';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

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

  return (
    <MainAppShell>
      <div className="p-4 md:p-6 w-full max-w-7xl mx-auto">
        {children}
      </div>
    </MainAppShell>
  );
}
