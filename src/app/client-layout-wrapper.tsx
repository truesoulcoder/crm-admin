// app/client-layout-wrapper.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { ReactNode } from 'react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { EngineProvider } from '@/contexts/EngineContext';
import { UserProvider } from '@/contexts/UserContext';
import { createClient } from '@/lib/supabase/client';

export default function ClientLayoutWrapper({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error getting session:', error);
        setLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, [supabase.auth]);

  useEffect(() => {
    if (!loading) {
      const currentPath = window.location.pathname;
      
      if (!session) {
        // Redirect unauthenticated users to home (login page)
        if (currentPath !== '/') {
          router.push('/');
        }
      } else if (currentPath === '/') {
        // Authenticated user on login page - redirect based on role
        // UserContext will handle role fetching, so we can redirect to a default
        // and let the user context redirect again if needed
        router.push('/dashboard');
      }
    }
  }, [session, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="mt-4 text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <UserProvider initialSession={session}>
        <EngineProvider>
          {children}
        </EngineProvider>
      </UserProvider>
    </ErrorBoundary>
  );
}