// src/app/layout.tsx
'use client';

import { Session } from '@supabase/supabase-js';
import { Inter } from 'next/font/google';
import { useEffect, useState } from 'react';

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
  const [session, setSession] = useState<Session | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  return (
    <html lang="en" data-theme="custom_crm_theme">
      <body className={`${inter.className} bg-base-100`}>
        <UserProvider initialSession={session}>
          <EngineProvider>
            {children}
          </EngineProvider>
        </UserProvider>
      </body>
    </html>
  );
}