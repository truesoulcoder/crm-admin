import { NextResponse, type NextRequest } from 'next/server'

import { createServerClient } from '@/lib/supabase/client'

export async function POST(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const supabase = createServerClient()

  // Sign out from Supabase
  await supabase.auth.signOut()

  // Redirect to the home page after sign out
  return NextResponse.redirect(new URL('/login', request.url), {
    status: 302,
    headers: {
      'Set-Cookie': `sb-access-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lazy`
    }
  })
}
