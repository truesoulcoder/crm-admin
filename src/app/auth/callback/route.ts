// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server'

import { createServerClient } from '@/lib/supabase/client'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  if (code) {
    const supabase = createServerClient()

    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) throw error
    } catch (error) {
      console.error('Error exchanging code:', error)
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent('Could not authenticate user')}`, request.url)
      )
    }
  }

  return NextResponse.redirect(new URL(next, request.url))
}