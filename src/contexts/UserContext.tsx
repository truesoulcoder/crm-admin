"use client";

import { Session, User } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

import { getSupabaseSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase/client';

interface UserContextType {
  user: User | null;
  session: Session | null;
  role: string | null; // e.g., 'superadmin', 'user', 'guest'
  isLoading: boolean;
  error: string | null;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const getUserRole = (user: User | null): string => {
  if (!user) {
    console.log("[getUserRole] No user object, returning 'guest'.");
    return 'guest'; // Role for unauthenticated or missing user
  }

  // Check email domain
  const userEmail = user.email?.toLowerCase() || '';
  const allowedDomain = '@truesoulpartners.com';
  
  if (!userEmail.endsWith(allowedDomain)) {
    console.log(`[getUserRole] Unauthorized email domain for user: ${userEmail}`);
    return 'guest'; // Only allow emails from @truesoulpartners.com
  }

  // If user has a valid email domain, check their role in app_metadata
  if (user.app_metadata) {
    // If role is explicitly set, use it
    if (typeof user.app_metadata.role === 'string') {
      const roleFromMeta = user.app_metadata.role;
      console.log(`[getUserRole] Found role in app_metadata: '${roleFromMeta}'`);
      
      if (roleFromMeta === 'superadmin' || roleFromMeta === 'crmuser' || roleFromMeta === 'guest') {
        return roleFromMeta;
      } else {
        console.warn(`[getUserRole] Unknown role in app_metadata: '${roleFromMeta}'. Defaulting to 'crmuser'.`);
        return 'crmuser'; // Default to crmuser for valid domain users with unknown role
      }
    }
    
    // If no role is set but user has valid domain, default to 'crmuser'
    console.log("[getUserRole] No 'role' found in app_metadata for domain user. Defaulting to 'crmuser'.");
    return 'crmuser';
  }
  
  // Default fallback (shouldn't normally reach here)
  console.log("[getUserRole] No app_metadata found. Defaulting to 'crmuser'.");
  return 'crmuser';
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let isMounted = true;
    console.log("[UserProvider] Initializing. Current path:", pathname);

    // Listener for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event: string, newSession: Session | null) => {
      if (!isMounted) return;
      
      console.log('[UserProvider] Auth state changed:', event);
      
      switch (event) {
        case 'SIGNED_IN':
          if (newSession) {
            const userRole = getUserRole(newSession.user);
            // Batch state updates
            void (async () => {
              try {
                // Only update state if it has changed to prevent unnecessary re-renders
                setSession(prev => prev?.user?.id === newSession.user.id ? prev : newSession);
                setUser(prev => prev?.id === newSession.user.id ? prev : newSession.user);
                setRole(prev => prev === userRole ? prev : userRole);
                setIsLoading(false);
              } catch (error) {
                console.error('Error in SIGNED_IN handler:', error);
              }
            })();
          }
          break;
          
        case 'SIGNED_OUT':
          // Batch state updates and redirect
          void (async () => {
            try {
              setSession(null);
              setUser(null);
              setRole('guest');
              setIsLoading(false);
              if (window.location.pathname !== '/') {
                window.location.href = '/';
              }
            } catch (error) {
              console.error('Error in SIGNED_OUT handler:', error);
            }
          })();
          break;
          
        case 'USER_UPDATED':
          if (newSession) {
            const userRole = getUserRole(newSession.user);
            // Batch state updates
            void (async () => {
              try {
                setUser(newSession.user);
                setRole(userRole);
              } catch (error) {
                console.error('Error in USER_UPDATED handler:', error);
              }
            })();
          }
          break;
      }
    });

    const fetchUserSessionAndRole = async () => {
      if (!isMounted) return;
      
      setIsLoading(true);
      
      try {
        const currentSession = await getSupabaseSession();
        
        if (!isMounted) return;
        
        if (currentSession) {
          const userRole = getUserRole(currentSession.user);
          
          // Batch state updates
          setSession(currentSession);
          setUser(currentSession.user);
          setRole(userRole);
          
          // Handle redirections
          if (pathname !== '/') {
            if (userRole === 'crmuser' && !pathname.startsWith('/crm')) {
              router.replace('/crm');
              return;
            } else if (userRole === 'guest' || (userRole !== 'superadmin' && userRole !== 'crmuser')) {
              router.replace('/');
              return;
            }
          }
        } else {
          // No active session
          setSession(null);
          setUser(null);
          setRole('guest');
          
          if (pathname !== '/') {
            router.replace('/');
            return;
          }
        }
        
        setError(null);
      } catch (e) {
        if (isMounted) {
          console.error("Error in fetchUserSessionAndRole:", e);
          setError("Error loading user data. Please refresh the page.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    (async () => {
      await fetchUserSessionAndRole();
    })().catch(err => {
      // Handle or log any errors from fetchUserSessionAndRole if needed
      // This prevents an unhandled promise rejection if fetchUserSessionAndRole itself throws
      console.error("[UserProvider] Error during initial fetchUserSessionAndRole call:", err);
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe(); // Clean up the auth listener
      console.log("[UserProvider] Unmounted, auth listener unsubscribed.");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, router]);

  if (isLoading && !session) {
      console.log("[UserProvider] Render: Initial load, no session yet. Displaying loader.");
      return (
          <div className="flex min-h-screen flex-col items-center justify-center bg-base-100">
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <p className="mt-4 text-lg">Initializing user session...</p>
          </div>
      );
  }

  // This specific render-time redirect might conflict with RequireAuth or page-level redirects.
  // Let's rely on useEffect and page-level logic for redirects mostly.
  // if (!isLoading && role === 'crmuser' && !pathname.startsWith('/crm') && pathname !== '/' && pathname !== '/login') {
  //   console.log(`[UserProvider] Render check: crmuser ('${role}') on restricted path '${pathname}'. Displaying redirect message.`);
  //   // This can cause hydration errors if router.replace is called during render pass from here.
  //   // It's better to handle in useEffect or at page level.
  //   // router.replace('/crm'); 
  //   return (
  //       <div className="flex min-h-screen flex-col items-center justify-center bg-base-100">
  //           <span className="loading loading-spinner loading-lg text-primary"></span>
  //           <p className="mt-4 text-lg">Redirecting to your authorized area...</p>
  //       </div>
  //   );
  // }

  
  console.log(`[UserProvider] Render: isLoading=${isLoading}, role=${role}, path=${pathname}. Rendering children.`);
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