"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { getSupabaseSession } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';

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

    const fetchUserSessionAndRole = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      try {
        const currentSession = await getSupabaseSession();
        if (isMounted) {
          if (currentSession) {
            console.log("[UserProvider] Session found. User ID:", currentSession.user.id);
            setSession(currentSession);
            setUser(currentSession.user);
            const userRole = getUserRole(currentSession.user);
            setRole(userRole);
            console.log("[UserProvider] User role determined as:", userRole);

            // Role-based redirection logic
            if (userRole === 'crmuser' && !pathname.startsWith('/crm') && pathname !== '/') {
              console.log(`[UserProvider] crmuser ('${userRole}') on restricted path '${pathname}'. Redirecting to /crm.`);
              router.replace('/crm');
            } else if (userRole === 'superadmin' && pathname === '/') {
              // If a superadmin is logged in and on the login page, redirect to dashboard
              console.log(`[UserProvider] superadmin on login page with session. Redirecting to /dashboard.`);
              router.replace('/dashboard');
            } else if (userRole !== 'superadmin' && userRole !== 'crmuser' && pathname !== '/') {
              // If user has an unknown role (or 'guest' after login somehow) and isn't on login page, redirect to login
              console.log(`[UserProvider] User with unrecognized role ('${userRole}') or guest on authenticated path '${pathname}'. Redirecting to login.`);
              router.replace('/'); // Or a generic 'unauthorized' page
            }
            // SuperAdmins can access any page (no specific redirect unless they are on '/')
            // CrmUsers are allowed on /crm paths (and implicitly on '/' if they land there before this logic kicks in)

          } else {
            console.log("[UserProvider] No active session. User should be redirected by RequireAuth.");
            setSession(null);
            setUser(null);
            setRole('guest');
            // No redirect here; RequireAuth is responsible for unauthenticated users.
          }
          setError(null);
        }
      } catch (e: any) {
        console.error("[UserProvider] Error fetching session or role:", e);
        if (isMounted) {
            setError("Error loading user data. Please try logging in again.");
        }
      } finally {
        if (isMounted) setIsLoading(false);
        console.log("[UserProvider] Initialization complete. isLoading:", isLoading, "Role:", role);
      }
    };

    fetchUserSessionAndRole();

    return () => {
      isMounted = false;
      console.log("[UserProvider] Unmounted.");
    };
  }, [pathname, router]); // Added router to dependencies as it's used for redirection

  if (isLoading && !session) {
      console.log("[UserProvider] Render: Initial load, no session yet. Displaying loader.");
      return (
          <div className="flex min-h-screen flex-col items-center justify-center bg-base-100">
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <p className="mt-4 text-lg">Initializing user session...</p>
          </div>
      );
  }

  // Post-load check for redirection for crmuser
  if (!isLoading && role === 'crmuser' && !pathname.startsWith('/crm') && pathname !== '/') {
    console.log(`[UserProvider] Render check: crmuser ('${role}') on restricted path '${pathname}'. Displaying redirect message.`);
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-base-100">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="mt-4 text-lg">Redirecting to your authorized area...</p>
        </div>
    );
  }
  
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