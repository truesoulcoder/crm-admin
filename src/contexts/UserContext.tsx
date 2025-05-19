"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

import { Session, User } from '@supabase/supabase-js';

import { getSupabaseSession } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';

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

  // Check app_metadata for the 'role' field
  if (user.app_metadata && typeof user.app_metadata.role === 'string') {
    const roleFromMeta = user.app_metadata.role;
    console.log(`[getUserRole] Found role in app_metadata: '${roleFromMeta}'`);
    
    if (roleFromMeta === 'superadmin') {
      return 'superadmin'; // Match 'superadmin' from app_metadata
    } else if (roleFromMeta === 'crmuser') {
      return 'crmuser'; // Assuming 'crmuser' will be used for CrmUser role
    } else {
      console.warn(`[getUserRole] Unknown role in app_metadata: '${roleFromMeta}'. Defaulting to 'guest'.`);
      return 'guest'; // Fallback for unrecognized roles in app_metadata
    }
  } else {
    console.log("[getUserRole] No 'role' string found in app_metadata. Defaulting to 'guest'.");
    return 'guest'; // Default if no role or role is not a string in app_metadata
  }
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
    const { data: authListener } = supabase.auth.onAuthStateChange((event: string, newSession: Session | null) => {
      console.log('[UserProvider] Auth state changed:', event, newSession);
      if (event === 'SIGNED_IN') {
        if (isMounted && newSession) {
          setSession(newSession);
          setUser(newSession.user);
          const userRole = getUserRole(newSession.user);
          setRole(userRole);
          setIsLoading(false);
          // Redirection after sign-in will be handled by the page components (login.tsx, index.tsx)
          // or by the main effect hook if user directly lands on a protected page with a new session.
        }
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setSession(null);
          setUser(null);
          setRole('guest');
          setIsLoading(false);
          if (pathname !== '/') {
            router.replace('/'); // Redirect to login page (root) on sign out
          }
        }
      } else if (event === 'USER_UPDATED') {
        if (isMounted && newSession) {
            setUser(newSession.user);
            const userRole = getUserRole(newSession.user);
            setRole(userRole);
        }
      }
    });

    const fetchUserSessionAndRole = async () => {
      console.log('[UserProvider] fetchUserSessionAndRole: CALLED. isMounted:', isMounted);
      if (!isMounted) return;
      setIsLoading(true);
      console.log('[UserProvider] fetchUserSessionAndRole: About to call getSupabaseSession. isMounted:', isMounted);
      try {
        const currentSession = await getSupabaseSession();
        console.log('[UserProvider] fetchUserSessionAndRole: getSupabaseSession call COMPLETE. Session:', currentSession, 'isMounted:', isMounted);
        if (isMounted) {
          if (currentSession) {
            console.log("[UserProvider] Session found. User ID:", currentSession.user.id);
            setSession(currentSession);
            setUser(currentSession.user);
            const userRole = getUserRole(currentSession.user);
            setRole(userRole);
            console.log("[UserProvider] User role determined as:", userRole);

            // Role-based redirection for users already authenticated and navigating directly
            // The login.tsx and index.tsx pages will handle their own redirects if user lands there.
            if (pathname !== '/') { // Don't interfere with login page redirects
              if (userRole === 'crmuser' && !pathname.startsWith('/crm')) {
                console.log(`[UserProvider] Authenticated crmuser ('${userRole}') on restricted path '${pathname}'. Redirecting to /crm.`);
                router.replace('/crm');
              } else if (userRole === 'guest' || (userRole !== 'superadmin' && userRole !== 'crmuser')) {
                // If user is guest or unknown role on a protected path (not login/index), send to login
                console.log(`[UserProvider] User with role ('${userRole}') on path '${pathname}' needs redirection. Redirecting to login page ('/').`);
                router.replace('/');
              }
              // SuperAdmins are generally allowed on any authenticated path.
            }
          } else {
            // No active session found by initial fetch
            setSession(null);
            setUser(null);
            setRole('guest');
            console.log("[UserProvider] No active session. isLoading:", isLoading, "Path:", pathname);
            if (pathname !== '/') {
              console.log("[UserProvider] No session and not on login/index page. UserProvider sees no session, RequireAuth should handle redirect.");
              // No direct redirect from here to avoid conflicts with RequireAuth
              // RequireAuth should catch this state and redirect to login page ('/').
            }
          }
          setError(null);
        }
      } catch (e: any) {
        console.error("[UserProvider] Error fetching session or role: RAW ERROR:", e);
        if (e instanceof Error) {
          console.error("[UserProvider] Error fetching session or role: NAME:", e.name, "MESSAGE:", e.message, "STACK:", e.stack);
        }
        if (isMounted) {
            setError("Error loading user data. Please try logging in again.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
        console.log("[UserProvider] Initialization complete. isLoading:", isLoading, "Role:", role);
      }
    };

    (async () => {
      await fetchUserSessionAndRole();
    })();

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