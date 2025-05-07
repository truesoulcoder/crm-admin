// src/lib/supabaseClient.ts
import { createBrowserClient } from '@supabase/ssr';

// Ensure these are environment variables in .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseAnonKey) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// Create a single supabase client for client-side usage
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// Example function to get user session (client-side)
export async function getUserSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error.message);
    return null;
  }
  return session;
}
