// src/lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@/types/db_types';

// Helper function to create a Supabase server client with the latest cookie methods
function createSupabaseServerClient() {
  const cookieStore = cookies();
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map(cookie => ({
            name: cookie.name,
            value: cookie.value
          }));
        },
        setAll(cookies: Array<{ name: string; value: string } & CookieOptions>) {
          cookies.forEach(({ name, value, ...options }) => {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              console.error('Error setting cookie:', error);
            }
          });
        },
      },
    }
  );
}

// Create and export the server client instance
export const supabaseServerClient = createSupabaseServerClient();

// For backward compatibility
export function createClient() {
  return supabaseServerClient;
}

export default supabaseServerClient;