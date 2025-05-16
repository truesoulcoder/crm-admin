// src/lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type Database } from '@/types/supabase'; // Import Database type
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  // Ensure these are environment variables in .env.local or your hosting environment
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl) {
    throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!supabaseAnonKey) {
    throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options });
        } catch (error) {
          // The `delete` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}

// Function to create a Supabase client for server-side admin operations (uses service_role_key)
export async function createAdminServerClient() {
  const cookieStore = await cookies(); // Must await cookies() to get the actual store

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl) {
    throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing env.SUPABASE_SERVICE_ROLE_KEY. Ensure it's set and not prefixed with NEXT_PUBLIC_.");
  }

  return createServerClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    cookies: {
      getAll() {
        // The awaited cookieStore has a getAll method that returns HttpCookie[]
        return cookieStore.getAll().map((cookie: { name: string; value: string }) => ({ name: cookie.name, value: cookie.value }));
      },
      async setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        // To set cookies, it's often best to get a fresh cookie setter instance from Next.js,
        // especially in Server Actions or similar contexts.
        // Supabase's createServerClient will call this method internally.
        const writableCookieStore = await cookies(); // Get a store instance that can set cookies
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            writableCookieStore.set(name, value, options);
          });
        } catch (error) {
          // This error might occur if 'set' is called in a context where it's not allowed (e.g., during a GET request in a Route Handler if not handled carefully).
          // Or if running in a context without proper Next.js request lifecycle (e.g. some test environments or scripts).
          console.warn(`(AdminClient) Failed to set one or more cookies. Error:`, error);
        }
      },
    },
  });
}
