// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

import type { CookieOptionsWithName } from '@supabase/ssr';

// Create a single supabase client for interacting with your database
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    },
    cookies: {
      get(key: string) {
        if (typeof document === 'undefined') return null;
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${key}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
        return null;
      },
      set(key: string, value: string, options: CookieOptionsWithName) {
        if (typeof document === 'undefined') return;
        
        let cookieString = `${key}=${value}; path=/`;
        
        if (options.maxAge) {
          cookieString += `; max-age=${options.maxAge}`;
        }
        
        if (options.domain) {
          cookieString += `; domain=${options.domain}`;
        }
        
        if (options.secure) {
          cookieString += '; secure';
        }
        
        if (options.sameSite) {
          cookieString += `; samesite=${options.sameSite}`;
        }
        
        if (options.httpOnly) {
          cookieString += '; httponly';
        }
        
        document.cookie = cookieString;
      },
      remove(key: string, options: CookieOptionsWithName) {
        if (typeof document === 'undefined') return;
        
        document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }
    }
  }
);

// Helper function for safe table queries
export async function safeSelect<T>(table: string, columns: string) {
  const { data, error } = await supabase
    .from(table)
    .select(columns);
    
  if (error) throw error;
  return data as T[];
}

// Also export the createClient function for backward compatibility
export function createClient() {
  return supabase;
}

export default supabase;