'use client';

import { ReactNode } from 'react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { EngineProvider } from '@/contexts/EngineContext';

import ClientLayout from './client-layout-wrapper';

export default function ClientLayoutWrapper({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ErrorBoundary>
      <EngineProvider>
        <ClientLayout>
          {children}
        </ClientLayout>
      </EngineProvider>
    </ErrorBoundary>
  );
}