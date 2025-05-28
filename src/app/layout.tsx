// src/app/layout.tsx
import './globals.css';
import { Inter } from 'next/font/google';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { UserProvider } from '@/contexts/UserContext';
import { EngineProvider } from '@/contexts/EngineContext';
import ClientLayout from './layout-client';

const inter = Inter({ subsets: ['latin'] });

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  const { data: { session } } = await supabase.auth.getSession();
  const pathname = '/'; // Use actual pathname from next/navigation in client components

  // If no session and not on login page, redirect to login
  if (!session && pathname !== '/login') {
    redirect('/login');
  }

  // If session exists and on login page, redirect based on role
  if (session && pathname === '/login') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();
    
    const role = profile?.role || 'guest';
    redirect(role === 'superadmin' ? '/dashboard' : '/crm');
  }

  return (
    <html lang="en" data-theme="custom_crm_theme" suppressHydrationWarning>
      <body className={inter.className}>
        <ErrorBoundary>
          <UserProvider initialSession={session}>
            <EngineProvider>
              <ClientLayout>
                {children}
              </ClientLayout>
            </EngineProvider>
          </UserProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}