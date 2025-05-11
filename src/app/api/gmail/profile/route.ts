import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ name: null, picture: null });
  }
  const { full_name, avatar_url } = (user.user_metadata as any) || {};
  return NextResponse.json({
    name: full_name ?? user.email,
    picture: avatar_url ?? null,
  });
}