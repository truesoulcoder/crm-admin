// src/middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// List of public paths that don't require authentication
const publicPaths = ['/login', '/reset-password'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Refresh session if expired - required for Server Components
  const { data: { session } } = await supabase.auth.getSession();
  
  // Get the user's role if they're logged in
  let userRole: string | null = null;
  if (session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();
    userRole = profile?.role || null;
  }

  const { pathname } = request.nextUrl;
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  // Redirect logic
  if (!session && !isPublicPath) {
    // Redirect to login if not authenticated and not on a public path
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (session) {
    // Redirect to dashboard if authenticated and trying to access login/signup
    if (['/login', '/signup'].includes(pathname)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Role-based redirects
    if (pathname.startsWith('/admin') && userRole !== 'superadmin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return response;
}
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};