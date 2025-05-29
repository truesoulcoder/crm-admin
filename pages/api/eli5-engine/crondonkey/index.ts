// pages/api/crondonkey/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerClient } from '@/lib/supabase/server';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createServerClient();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { run, pause } = JSON.parse(req.body || '{}');

  try {
    const updates: Record<string, boolean> = {};
    if (typeof run === 'boolean') updates.is_running = run;
    if (typeof pause === 'boolean') updates.is_paused = pause;

    const { error: updateError } = await supabase
      .from('system_state')
      .update(updates)
      .eq('id', 1);

    if (updateError) {
      console.error('[Crondonkey API] Supabase update error:', updateError);
      return res.status(500).json({ error: 'Failed to update Crondonkey state' });
    }

    if (pause === true) {
      // Record pause time and pause jobs
      await supabase
        .from('system_state')
        .update({ paused_at: new Date().toISOString() })
        .eq('id', 1);

      await supabase
        .from('campaign_jobs')
        .update({ status: 'paused' })
        .eq('status', 'pending');
    }

    if (pause === false) {
      const now = new Date();

      const { data: systemState } = await supabase
        .from('system_state')
        .select('paused_at')
        .eq('id', 1)
        .single();

      const pausedAt = systemState?.paused_at ? new Date(systemState.paused_at) : null;
      const pauseDeltaMs = pausedAt ? now.getTime() - pausedAt.getTime() : 0;

      const { data: pausedJobs } = await supabase
        .from('campaign_jobs')
        .select('id, next_processing_time')
        .eq('status', 'paused');

      if (!pausedJobs || pausedJobs.length === 0) {
        return res.status(200).json({ message: 'No paused jobs to resume.' });
      }

      for (const job of pausedJobs) {
        const adjustedTime = new Date(new Date(job.next_processing_time).getTime() + pauseDeltaMs);

        await supabase
          .from('campaign_jobs')
          .update({
            status: 'pending',
            next_processing_time: adjustedTime.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', job.id);
      }
    }

    return res.status(200).json({ message: 'Crondonkey state updated successfully' });
  } catch (error: any) {
    console.error('[Crondonkey API] Unexpected error:', error);
    return res.status(500).json({ error: 'Unexpected error occurred' });
  }
}
