import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import React from 'react';

export async function middleware(req: any) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        }
      }
    }
  );
  // Refresh session if expired
  await supabase.auth.getUser();
  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
export interface StreetViewMapProps {
  address: string;
  containerStyle?: React.CSSProperties;
}
