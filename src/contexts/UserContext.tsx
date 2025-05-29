// src/contexts/UserContext.tsx
import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { createClient } from '@/lib/supabase/client';

type UserContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<{ error: Error | null }>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ 
  children,
  initialSession = null 
}: { 
  children: ReactNode;
  initialSession?: Session | null;
}) => {
  const [user, setUser] = useState<User | null>(initialSession?.user ?? null);
  const [session, setSession] = useState<Session | null>(initialSession);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and set the user
    const { data: { subscription } } = createClient().auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const { error } = await createClient().auth.signOut();
    setUser(null);
    setSession(null);
    return { error };
  };

  return (
    <UserContext.Provider
      value={{
        user,
        session,
        loading,
        signOut,
      }}
    >
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