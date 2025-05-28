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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(initialSession);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    try {
      setUser(session?.user ?? null);
      setRole(session?.user?.user_metadata?.role as string | null ?? null);
      setLoading(false);

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        try {
          setSession(session);
          setUser(session?.user ?? null);
          setRole(session?.user?.user_metadata?.role as string | null ?? null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unknown error occurred');
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setLoading(false);
    }
  }, [session, supabase.auth]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  };

  return (
    <UserContext.Provider value={{ user, session, loading, isLoading: loading, signOut, role, error }}>
      {!loading && children}
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