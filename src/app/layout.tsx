// src/app/layout.tsx
'use client';

import { Inter } from 'next/font/google';
import Background from '@/components/ui/Background';
import { UserProvider } from '@/contexts/UserContext';
import ClientLayout from './layout-client';
import { EngineProvider } from '@/contexts/EngineContext';
import './globals.css';
import type { Metadata } from 'next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CRM Admin',
  description: 'CRM Administration Panel',
  icons: {
    icon: 'https://oviiqouhtdajfwhpwbyq.supabase.co/storage/v1/object/public/media//favicon.ico',
    shortcut: 'https://oviiqouhtdajfwhpwbyq.supabase.co/storage/v1/object/public/media//favicon.ico',
    apple: 'https://oviiqouhtdajfwhpwbyq.supabase.co/storage/v1/object/public/media//favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Background
          fill={true}
          gradient={{ display: true, opacity: 0.8, x: 50, y: 30, colorStart: '#2e026d', colorEnd: '#15162c' }}
          lines={{ display: true, opacity: 0.07, size: 70, thickness: 2, angle: 45, color: '#fff' }}
          mask={{ x: 50, y: 50, radius: 0 }}
        >
          <UserProvider>
            <EngineProvider>
              <ClientLayout>{children}</ClientLayout>
            </EngineProvider>
          </UserProvider>
        </Background>
      </body>
    </html>
  );
}