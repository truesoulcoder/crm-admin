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
    const root = document.documentElement;
    root.setAttribute('data-theme', resolvedTheme);
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  return (
    <html lang="en" suppressHydrationWarning>
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