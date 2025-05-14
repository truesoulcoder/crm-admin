import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json({ error: 'Supabase URL not set' }, { status: 500 });
  }

  // Dynamically determine redirect URI
  let redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!redirectUri) {
    try {
      const host = req.headers.get('host');
      if (host?.includes('localhost')) {
        redirectUri = 'http://localhost:3000/api/auth/callback';
      } else {
        redirectUri = `${supabaseUrl}/auth/v1/callback`;
      }
    } catch {
      redirectUri = `${supabaseUrl}/auth/v1/callback`;
    }
  }
  const redirectTo = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUri)}`;
  return NextResponse.redirect(redirectTo);
}

