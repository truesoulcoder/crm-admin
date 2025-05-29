// pages/api/crondonkey/route.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Initialize Supabase admin client
const supabaseAdmin = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    cookies: {
      getAll() {
        return [];
      },
      setAll() {}
    }
  }
);

export async function POST(request: Request) {
  try {
    // First, get the current system state
    const { data: systemState, error: fetchError } = await supabaseAdmin
      .from('system_state')
      .select('*')
      .eq('id', 1)
      .single();

    if (fetchError) {
      console.error('[Crondonkey API] Error fetching system state:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch system state' },
        { status: 500 }
      );
    }

    // Add type assertion to tell TypeScript this is a valid date string
    const pausedAt = systemState?.paused_at ? new Date(systemState.paused_at as string) : null;

    const { run, pause } = await request.json();

    const updates: Record<string, boolean> = {};
    if (typeof run === 'boolean') updates.is_running = run;
    if (typeof pause === 'boolean') updates.is_paused = pause;

    const { error: updateError } = await supabaseAdmin
      .from('system_state')
      .update(updates)
      .eq('id', 1);

    if (updateError) {
      console.error('[Crondonkey API] Supabase update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update Crondonkey state' },
        { status: 500 }
      );
    }

    if (pause === true) {
      // Record pause time and pause jobs
      await supabaseAdmin
        .from('system_state')
        .update({ paused_at: new Date().toISOString() })
        .eq('id', 1);

      await supabaseAdmin
        .from('campaign_jobs')
        .update({ status: 'paused' })
        .eq('status', 'pending');
    }

      if (pause === false) {
        const now = new Date();
        const pauseDeltaMs = pausedAt ? now.getTime() - pausedAt.getTime() : 0;

        const { data: pausedJobs } = await supabaseAdmin
          .from('campaign_jobs')
          .select('id, next_processing_time')
          .eq('status', 'paused');

        if (!pausedJobs || pausedJobs.length === 0) {
          return NextResponse.json({ message: 'No paused jobs to resume.' });
        }
        
        for (const job of pausedJobs) {
          const jobWithTypes = job as { 
            id: string; 
            next_processing_time: string | null; 
          };
          
          if (jobWithTypes.next_processing_time === null) {
            console.warn(`Job ${jobWithTypes.id} has null next_processing_time, skipping`);
            continue;
          }

          const adjustedTime = new Date(new Date(jobWithTypes.next_processing_time).getTime() + pauseDeltaMs);

          await supabaseAdmin
            .from('campaign_jobs')
            .update({
              status: 'pending',
              next_processing_time: adjustedTime.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq('id', jobWithTypes.id);
        } // End of for loop
      } // End of if (pause === false)

return NextResponse.json({ message: 'Crondonkey state updated successfully' });
  } catch (error: any) {
    console.error('[Crondonkey API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unexpected error occurred' },
      { status: 500 }
    );
  }
}
