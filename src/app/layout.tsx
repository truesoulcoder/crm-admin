// src/app/layout.tsx
'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { UserProvider } from '@/contexts/UserContext';
import { EngineProvider } from '@/contexts/EngineContext';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <UserProvider>
          <EngineProvider>
            {children}
          </EngineProvider>
        </UserProvider>
      </body>
    </html>
  );
}