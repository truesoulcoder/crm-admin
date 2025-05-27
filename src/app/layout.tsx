// src/app/layout.tsx
'use client';

import { Inter } from 'next/font/google';

import { EngineProvider } from '@/contexts/EngineContext';
import { UserProvider } from '@/contexts/UserContext';
import { createClient } from '@/lib/supabase/client';

import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="custom_crm_theme">
      <body className={`${inter.className} bg-base-100`}>
        <UserProvider>
          <EngineProvider>
            {children}
          </EngineProvider>
        </UserProvider>
      </body>
    </html>
  );
}