import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Database } from '@/types/supabase'; // Ensure this path is correct

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
        // NextResponse objects are used for setting cookies in Route Handlers
        set(name: string, value: string, options: CookieOptions) { 
          // NextResponse.next().cookies.set(name, value, options) - this needs to be handled by the response object itself
          // For read-only operations in GET, setting cookies might not be typical unless for auth refresh tokens.
          // The createServerClient handles cookie management internally for auth state.
        },
        remove(name: string, options: CookieOptions) { 
          // NextResponse.next().cookies.delete(name, options) - similar to set
        },
      },
    }
  );
}

export async function GET(request: Request) {
  const supabase = getSupabaseRouteHandlerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized', details: authError?.message || 'User not authenticated.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

  if (isNaN(page) || page < 1) {
    return NextResponse.json({ error: 'Invalid page number.' }, { status: 400 });
  }
  if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) { // Max pageSize to prevent abuse
    return NextResponse.json({ error: 'Invalid pageSize. Must be between 1 and 100.' }, { status: 400 });
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: campaigns, error, count } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns', details: error.message }, { status: 500 });
  }

  return NextResponse.json({
    campaigns,
    totalCount: count,
    page,
    pageSize,
    totalPages: count ? Math.ceil(count / pageSize) : 0,
  });
}
