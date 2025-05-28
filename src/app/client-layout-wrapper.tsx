
// app/client-layout-wrapper.tsx
'use client';

import { Session } from '@supabase/supabase-js';
import { ReactNode } from 'react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { EngineProvider } from '@/contexts/EngineContext';
import { UserProvider } from '@/contexts/UserContext';

import ClientLayout from './layout-client';

export default function ClientLayoutWrapper({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  return (
    <ErrorBoundary>
      <UserProvider initialSession={session}>
        <EngineProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </EngineProvider>
      </UserProvider>
    </ErrorBoundary>
  );
}