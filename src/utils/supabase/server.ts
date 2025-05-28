import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

import type { Database } from '@/utils/supabase/database'

export const createSupabaseServerClient = () => {
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
        setAll(cookies) {
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
