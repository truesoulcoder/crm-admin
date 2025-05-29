import { createClient } from '@/lib/supabase/server';

import type { Campaignjob } from '@/app/api/engine/email-metrics/helpers';

export async function logCampaignJob(params: Campaignjob) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('campaign_jobs')
    .insert([params])
    .select()
    .single();

  if (error) {
    console.error('[logCampaignJob] DB Insert failed:', error.message);
    return null;
  }

  return data;
}
