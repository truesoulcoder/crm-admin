"use client";

import { Session, User } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

import { getSupabaseSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase/client';

interface UserContextType {
  user: User | null;
  session: Session | null;
  role: string | null;
  isLoading: boolean;
  error: string | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const getUserRole = (user: User | null): string => {
  if (!user) {
    console.log("[getUserRole] No user object, returning 'guest'.");
    return 'guest';
  }

  const userEmail = user.email?.toLowerCase() || '';
  const allowedDomain = '@truesoulpartners.com';
  
  if (!userEmail.endsWith(allowedDomain)) {
    console.log(`[getUserRole] Unauthorized email domain for user: ${userEmail}`);
    return 'guest';
  }

  if (user.app_metadata?.role) {
    const roleFromMeta = user.app_metadata.role as string;
    console.log(`[getUserRole] Found role in app_metadata: '${roleFromMeta}'`);
    
    if (['superadmin', 'user', 'guest'].includes(roleFromMeta)) {
      return roleFromMeta;
    }
  }
  
  console.log("[getUserRole] No valid role found. Defaulting to 'user' for domain user.");
  return 'user'; // Default to 'user' for valid domain users
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname() || '';

  useEffect(() => {
    let isMounted = true;
    console.log("[UserProvider] Initializing. Current path:", pathname);

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;
      
      console.log('[UserProvider] Auth state changed:', event);
      
      try {
        switch (event) {
          case 'SIGNED_IN':
            if (newSession?.user) {
              const userRole = getUserRole(newSession.user);
              setSession(newSession);
              setUser(newSession.user);
              setRole(userRole);
              setIsLoading(false);
              setError(null);
            }
            break;
            
          case 'SIGNED_OUT':
            setSession(null);
            setUser(null);
            setRole('guest');
            setIsLoading(false);
            setError(null);
            
            // Only redirect if not already on auth pages
            if (pathname !== '/' && pathname !== '/login') {
              router.replace('/');
            }
            break;
            
          case 'USER_UPDATED':
            if (newSession?.user) {
              const userRole = getUserRole(newSession.user);
              setUser(newSession.user);
              setRole(userRole);
            }
            break;
        }
      } catch (err) {
        console.error('Error in auth state change handler:', err);
        if (isMounted) {
          setError('Authentication error occurred');
        }
      }
    });

    const initializeAuth = async () => {
      if (!isMounted) return;
      
      try {
        console.log("[UserProvider] initializeAuth: Attempting to get Supabase session...");
        const currentSession = await getSupabaseSession();
        if (!isMounted) return; // Re-check after await
        console.log("[UserProvider] initializeAuth: getSupabaseSession resolved. Session User ID:", currentSession ? currentSession.user.id : 'null');
        
        if (!isMounted) return;
        
        if (currentSession?.user) {
          const userRole = getUserRole(currentSession.user);
          
          setSession(currentSession);
          setUser(currentSession.user);
          setRole(userRole);
          
          // Handle redirections based on current path and role
          if (pathname === '/' || pathname === '/login') {
            router.replace('/dashboard');
          } else if (userRole === 'guest' && !pathname.startsWith('/crm')) {
            router.replace('/crm');
          }
        } else {
          setSession(null);
          setUser(null);
          setRole('guest');
          
          // Redirect to login if on protected pages
          if (pathname !== '/' && pathname !== '/login' && !pathname.startsWith('/auth')) {
            router.replace('/');
          }
        }
        
        setError(null);
      } catch (err) {
        console.error("Error initializing auth:", err);
        if (isMounted) {
          setError("Failed to initialize authentication");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      void authListener?.subscription?.unsubscribe(); // Explicitly mark as fire-and-forget
    };
  }, [pathname, router]);

  if (isLoading && !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="mt-4 text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ user, session, role, isLoading, error }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};