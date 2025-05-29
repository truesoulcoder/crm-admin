// External dependencies
import { createClient } from '@supabase/supabase-js';

// Types
import { Database } from '@/db_types';

// Initialize Supabase client with service role
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function updateCampaignJobStatus(
  logId: string, 
  status: 'sent' | 'failed', 
  error?: string
): Promise<void> {
  try {
    const { error: updateError } = await supabase
      .from('campaign_jobs')
      .update({ 
        status, 
        error: error || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', logId);

    if (updateError) {
      console.error('Error updating campaign job status:', updateError);
      throw updateError;
    }
  } catch (e: unknown) {
    console.error(
      'Error in updateCampaignJobStatus:', 
      e instanceof Error ? e.message : 'Unknown error'
    );
    throw e; // Re-throw to allow callers to handle the error
  }
}

export default updateCampaignJobStatus;
