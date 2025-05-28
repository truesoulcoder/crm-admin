// app/providers.tsx
'use client';

import { createBrowserClient } from '@supabase/ssr';
import { ReactNode } from 'react';
import { Database } from '@/types/supabase';

export default function Providers({ children }: { children: ReactNode }) {
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  return <>{children}</>;
}