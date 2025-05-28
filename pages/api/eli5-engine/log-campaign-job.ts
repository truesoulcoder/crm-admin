import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface LogCampaignJobParams {
  campaign_id: string;
  sender_id?: string;
  sender_email?: string;
  contact_email?: string;
  status: 'queued' | 'sent' | 'failed';
  error_message?: string;
  email_subject?: string;
  email_body_preview?: string;
}

export async function logCampaignJob(params: LogCampaignJobParams) {
  const { data, error } = await supabase
    .from('campaign_jobs')
    .insert([
      {
        campaign_id: params.campaign_id,
        sender_id: params.sender_id,
        sender_email: params.sender_email,
        contact_email: params.contact_email,
        status: params.status,
        error_message: params.error_message,
        email_subject: params.email_subject,
        email_body_preview: params.email_body_preview,
      },
    ])
    .select();

  if (error) {
    console.error('Error logging campaign job:', error);
    throw error;
  }

  return data?.[0];
}
