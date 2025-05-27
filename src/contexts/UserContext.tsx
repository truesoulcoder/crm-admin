// src/contexts/UserContext.tsx
'use client';

import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

type UserContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
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
  const supabase = createClient();

  useEffect(() => {
    setUser(session?.user ?? null);
    setLoading(false);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [session, supabase.auth]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <UserContext.Provider value={{ user, session, loading, signOut }}>
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