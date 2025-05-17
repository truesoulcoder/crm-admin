'use client';

import { useEffect } from 'react';

import { useTheme } from '@/hooks/useTheme';
import MainAppShell from '@/components/layout/MainAppShell';

import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  // Set theme class on html element
  useEffect(() => {
    const root = document.documentElement;
    // Remove any existing theme classes first
    root.removeAttribute('class');
    // Add the current theme class
    if (theme && theme !== 'system') {
      root.setAttribute('data-theme', theme);
    } else if (typeof window !== 'undefined') {
      // For system theme, set the current system theme
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.setAttribute('data-theme', systemTheme);
    }
  }, [theme]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-base-100">
        <MainAppShell>{children}</MainAppShell>
      </body>
    </html>
  );
}
