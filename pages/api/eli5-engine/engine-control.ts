// pages/api/eli5-engine/engine-control.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { PostgrestError } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
        set(name: string, value: string, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Check auth
  const { data: { session } } = await supabase.auth.getSession();
  
  // Handle unauthenticated users
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check for superadmin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (profile?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    // Handle GET requests for engine status
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('engine_control')
        .select('*')
        .limit(1)
        .single();

      if (error) throw new Error(error.message);
      
      return res.status(200).json(data || { 
        is_running: false,
        last_started_at: null,
        last_stopped_at: null
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error('Unknown error occurred');
    return res.status(500).json({ 
      error: 'Failed to fetch engine status',
      details: error.message 
    });
  }
}