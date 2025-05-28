// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

// Create a single supabase client for interacting with your database
// The default cookie handling by createBrowserClient is generally sufficient for browser environments.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// If you still need a default export for some reason, uncomment the line below.
// export default supabase;