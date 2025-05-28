// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      cookies: {
        get(name: string) {
          if (typeof document === 'undefined') return null
          const value = `; ${document.cookie}`
          const parts = value.split(`; ${name}=`)
          if (parts.length === 2) return parts.pop()?.split(';').shift() || null
          return null
        },
        set(name: string, value: string, options: { path: string; maxAge: number; domain?: string; secure?: boolean; httpOnly?: boolean; sameSite?: 'lax' | 'strict' | 'none' }) {
          if (typeof document === 'undefined') return
          document.cookie = `${name}=${value}; Path=${options.path}; Max-Age=${options.maxAge}; ${
            options.domain ? `Domain=${options.domain};` : ''
          } ${options.secure ? 'Secure;' : ''} ${options.httpOnly ? 'HttpOnly;' : ''} ${
            options.sameSite ? `SameSite=${options.sameSite};` : ''
          }`.trim()
        },
        remove(name: string, options: { path: string }) {
          if (typeof document === 'undefined') return
          document.cookie = `${name}=; Path=${options.path}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
        }
      }
    }
  )
}

// Create a default client instance
export const supabase = createClient()

// Helper function for safe table queries
export async function safeSelect<T>(table: string, columns: string) {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    
  if (error) throw error
  return data as T[]
}

export default supabase