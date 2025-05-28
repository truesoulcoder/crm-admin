// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/auth/callback', '/_next', '/favicon.ico']
const isPublicPath = (path: string) => 
  PUBLIC_PATHS.some(publicPath => 
    path === publicPath || 
    path.startsWith(publicPath) ||
    path.startsWith('/_next/static')
  )

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
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ 
            name, 
            value, 
            ...options,
            domain: '.truesoulpartners.vercel.app',
            secure: true,
            sameSite: 'lax',
            path: '/'
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next()
          response.cookies.set({ 
            name, 
            value: '', 
            ...options,
            maxAge: 0,
            path: '/'
          })
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // Allow public paths and API routes
  if (isPublicPath(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith('/api/')) {
    return response
  }

  // Redirect to login if no session
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }