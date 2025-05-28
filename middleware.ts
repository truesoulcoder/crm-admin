// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ 
            name, 
            value, 
            ...options,
            domain: '.truesoulpartners.vercel.app',
            secure: true,
            sameSite: 'lax'
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next()
          response.cookies.set({ 
            name, 
            value: '', 
            ...options,
            maxAge: 0 
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // Auth routes that don't require a session
  const publicPaths = ['/login', '/auth/callback']
  if (publicPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    return response
  }

  // Redirect to login if no session
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}