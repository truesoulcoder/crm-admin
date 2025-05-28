// src/app/layout.tsx
'use client';

import { Session } from '@supabase/supabase-js';
import { Inter } from 'next/font/google';
import { useEffect, useState } from 'react';

import { ErrorBoundary } from '@/components/ErrorBoundary';
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
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;
    
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(initialSession);
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        if (mounted) {
          setError('Failed to initialize authentication. Please refresh the page.');
        }
      }
    };

    // Use void to explicitly mark the promise as intentionally not awaited
    void initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  const handleError = (error: Error, errorInfo: any) => {
    console.error('Root boundary caught error:', error, errorInfo);
    setError(error.message);
  };

  if (error) {
    return (
      <html lang="en" data-theme="custom_crm_theme">
        <body className={`${inter.className} bg-base-100`}>
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className="card bg-base-200 shadow-xl max-w-2xl w-full">
              <div className="card-body">
                <h2 className="card-title text-error text-2xl mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Application Error
                </h2>
                <div className="bg-base-300 rounded-lg p-4 mb-4">
                  <p className="font-semibold">{error}</p>
                  <p className="text-sm mt-2">Please try refreshing the page or contact support if the problem persists.</p>
                </div>
                <div className="card-actions justify-end">
                  <button 
                    className="btn btn-primary"
                    onClick={() => window.location.reload()}
                  >
                    Refresh Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en" data-theme="custom_crm_theme">
      <body className={`${inter.className} bg-base-100`}>
        <ErrorBoundary>
          <UserProvider initialSession={session}>
            <EngineProvider>
              {children}
            </EngineProvider>
          </UserProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}