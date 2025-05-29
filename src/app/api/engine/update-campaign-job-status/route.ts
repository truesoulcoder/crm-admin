// src/app/api/engine/update-campaign-job-status/route.ts
import { createClient } from '@/lib/supabase/server';

export async function updateCampaignJobStatus(jobId: string, status: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from('campaign_jobs')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to update job status: ${error.message}`);
  }
}
