import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// This page needs to be dynamic to handle auth state
// https://nextjs.org/docs/app/building-your-application/rendering/server-components#server-rendering-strategies
export const dynamic = 'force-dynamic';

export default async function Home() {
  try {
    const cookieStore = cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      return redirect('/dashboard');
    } else {
      return redirect('/login');
    }
  } catch (error) {
    console.error('Error in root page:', error);
    return redirect('/login');
  }
}