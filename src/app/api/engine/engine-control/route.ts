// src/app/api/engine/engine-control/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import type { PostgrestError } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Create authenticated Supabase client
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options, maxAge: 0 });
          },
        },
      }
    );

    // Check auth
    const { data: { session } } = await supabase.auth.getSession();

    // Handle unauthenticated users
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for superadmin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Handle GET requests for engine status
    const { data, error } = await supabase
      .from('engine_control')
      .select('*')
      .limit(1)
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json(data || {
      is_running: false,
      last_started_at: null,
      last_stopped_at: null
    });

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error('Unknown error occurred');
    return NextResponse.json({
      error: 'Failed to fetch engine status',
      details: error.message
    }, { status: 500 });
  }
}