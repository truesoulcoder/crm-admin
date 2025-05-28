// src/app/layout.tsx
'use client';

import { Session } from '@supabase/supabase-js';
import { Inter } from 'next/font/google';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { EngineProvider } from '@/contexts/EngineContext';
import { UserProvider } from '@/contexts/UserContext';
import { createClient } from '@/lib/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';

import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string>('guest');
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (session) {
          // Get user role
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
          
          setRole(profile?.role || 'guest');
        } else {
          setRole('guest');
        }
        
        setIsLoading(false);
      }
    );

    // Initial check
    const checkSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      
      if (currentSession) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentSession.user.id)
          .single();
        
        setRole(profile?.role || 'guest');
      }
      
      setIsLoading(false);
    };
    
    checkSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth, router]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <html lang="en" data-theme="custom_crm_theme">
        <body className={`${inter.className} bg-base-100`}>
          <div className="flex min-h-screen items-center justify-center">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </body>
      </html>
    );
  }

  // If no session and not on login page, show login
  if (!session && pathname !== '/login') {
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

  // For authenticated users, show the full layout with sidebar and navbar
  return (
    <html lang="en" data-theme="custom_crm_theme">
      <body className={`${inter.className} bg-base-100`}>
        <ErrorBoundary>
          <UserProvider initialSession={session}>
            <EngineProvider>
              <div className="flex min-h-screen">
                <Sidebar role={role} />
                <div className="flex-1 flex flex-col">
                  <Navbar user={session?.user} role={role} />
                  <main className="flex-1 p-6 overflow-auto">
                    {children}
                  </main>
                </div>
              </div>
            </EngineProvider>
          </UserProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}