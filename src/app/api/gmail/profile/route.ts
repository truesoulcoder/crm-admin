import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Error getting user:', userError);
      return NextResponse.json({ name: null, picture: null }, { status: 401 });
    }

    // Get the user's profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      // Fall back to user_metadata if profile fetch fails
      const { full_name, avatar_url } = user.user_metadata || {};
      return NextResponse.json({
        name: full_name || user.email,
        picture: avatar_url || null,
      });
    }

    return NextResponse.json({
      name: profile?.full_name || user.email,
      picture: profile?.avatar_url || null,
    });
  } catch (error) {
    console.error('Error in profile API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' }, 
      { status: 500 }
    );
  }
}