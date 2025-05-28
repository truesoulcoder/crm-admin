// app/layout.tsx (Server Component - no 'use client')
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';

import { createClient } from '@/lib/supabase/server';

import ClientLayoutWrapper from './layout-client';

const inter = Inter({ subsets: ['latin'] });

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  const { data: { session } } = await supabase.auth.getSession();
  const pathname = '/'; // This should come from headers in a real implementation

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
        <ClientLayoutWrapper session={session}>
          {children}
        </ClientLayoutWrapper>
      </body>
    </html>
  );
}