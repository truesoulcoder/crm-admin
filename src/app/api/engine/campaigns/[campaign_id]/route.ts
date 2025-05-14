import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Database } from '@/types_db'; // Ensure this path is correct

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Helper to get Supabase client for route handlers
function getSupabaseRouteHandlerClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { /* Handled by response object */ },
        remove(name: string, options: CookieOptions) { /* Handled by response object */ },
      },
    }
  );
}

export async function GET(
  request: Request,
  { params }: { params: { campaign_id: string } }
) {
  const campaignId = params.campaign_id;
  if (!campaignId) {
    return NextResponse.json({ error: 'Campaign ID is required.' }, { status: 400 });
  }

  // Validate if campaignId is a UUID (optional, but good practice)
  // A simple regex or a library like Zod could be used here.
  // For brevity, skipping detailed UUID validation here.

  const supabase = getSupabaseRouteHandlerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized', details: authError?.message || 'User not authenticated.' }, { status: 401 });
  }

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .single(); // Expecting one row or null

  if (error) {
    // If error is due to 'PGRST116' (PostgREST: 'Fetched 0 rows'), it means not found or not owned.
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Campaign not found or you do not have permission to view it.' }, { status: 404 });
    }
    console.error('Error fetching campaign by ID:', error);
    return NextResponse.json({ error: 'Failed to fetch campaign', details: error.message }, { status: 500 });
  }

  if (!campaign) { // Should be caught by PGRST116, but as a fallback
    return NextResponse.json({ error: 'Campaign not found or you do not have permission to view it.' }, { status: 404 });
  }

  return NextResponse.json(campaign);
}
