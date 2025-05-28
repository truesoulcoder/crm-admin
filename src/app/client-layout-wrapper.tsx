// app/client-layout-wrapper.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import type { Session } from '@supabase/supabase-js';
import { ReactNode } from 'react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { EngineProvider } from '@/contexts/EngineContext';
import { UserProvider } from '@/contexts/UserContext';
import { Database } from '@/types/supabase';

export default function ClientLayoutWrapper({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

 useEffect(() => {
   // Handle the session promise with error handling
   supabase.auth.getSession()
     .then(({ data: { session } }) => {
       setSession(session);
       setLoading(false);
     })
     .catch((error) => {
       console.error('Error getting session:', error);
       setLoading(false);
     });
 
   // Set up auth state change listener
   const {
     data: { subscription },
   } = supabase.auth.onAuthStateChange((_event, session) => {
     setSession(session);
     setLoading(false);
   });
 
   // Cleanup subscription on unmount
   return () => {
     subscription?.unsubscribe();
   };
 }, []);

  useEffect(() => {
    if (!loading) {
      if (!session) {
        if (!window.location.pathname.startsWith('/login')) {
          router.push('/login');
        }
      } else if (window.location.pathname === '/login') {
        const redirectUser = async () => {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
          
          if (error) {
            console.error('Error fetching profile:', error);
            return;
          }
          
          const role = profile?.role || 'guest';
          router.push(role === 'superadmin' ? '/dashboard' : '/crm');
        };
        
        redirectUser();
      }
    }
  }, [session, loading, router, supabase]);

  if (loading) {
    return <div>Loading...</div>;
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