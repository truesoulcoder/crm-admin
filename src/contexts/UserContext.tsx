// src/contexts/UserContext.tsx
'use client';

import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

type UserContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  role: string | null;
  error: string | null;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: React.ReactNode;
  initialSession?: Session | null;
}

export function UserProvider({
  children,
  initialSession = null,
}: UserProviderProps) {
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  const [session, setSession] = useState<Session | null>(initialSession);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  // Fetch role from profiles table
  const fetchUserRole = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return 'guest';
      }

      return profile?.role || 'guest';
    } catch (err) {
      console.error('Error fetching role:', err);
      return 'guest';
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get initial session if not provided
        if (!initialSession) {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) throw error;
          setSession(session);
          setUser(session?.user ?? null);
        }

        // Fetch role if user exists
        if (session?.user || initialSession?.user) {
          const userId = (session?.user?.id || initialSession?.user?.id)!;
          const userRole = await fetchUserRole(userId);
          setRole(userRole);
        }

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setLoading(false);
      }
    };

    initializeAuth();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const userRole = await fetchUserRole(session.user.id);
          setRole(userRole);
        } else {
          setRole(null);
        }
        
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [initialSession, supabase.auth]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setRole(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  };

  return (
    <UserContext.Provider value={{ 
      user, 
      session, 
      loading, 
      isLoading: loading, 
      signOut, 
      role, 
      error 
    }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};