// src/app/layout.tsx
'use client';

import { Inter } from 'next/font/google';
import { ReactNode, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import Providers from './providers';
import ClientLayoutWrapper from './client-layout-wrapper';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { resolvedTheme } = useTheme();

  // Apply theme class to HTML element
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement;
      // Remove any existing theme classes
      root.className = '';
      // Add the current theme class
      root.classList.add(resolvedTheme || 'night');
      // Also set data-theme attribute for DaisyUI
      root.setAttribute('data-theme', resolvedTheme || 'night');
    }
  }, [resolvedTheme]);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Add this to force dark mode on the browser UI if needed */}
        <meta name="color-scheme" content="dark light" />
      </head>
      <body className={inter.className}>
        <Providers>
          <ClientLayoutWrapper>
            {children}
          </ClientLayoutWrapper>
        </Providers>
      </body>
    </html>
  );
}