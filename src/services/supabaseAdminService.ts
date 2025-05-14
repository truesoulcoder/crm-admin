import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Returns a Supabase client authenticated with the service role key for admin operations.
 */
export function getAdminSupabaseClient() {
  return createClient(supabaseUrl, serviceKey);
}
