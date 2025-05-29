// src/app/api/engine/email-metrics/helpers.ts
import { createClient } from '@/lib/supabase/server';

export type EmailStatus = 'sent' | 'delivered' | 'bounced';

export type Campaignjob = {
  campaign_id: string;
  sender_id: string;
  sender_email: string;
  status: 'queued' | 'sent' | 'failed';
  contact_email: string;
  error?: string;
  email_address: string;
  lead_id: string;
};

export class EmailMetricsError extends Error {
  status: number;
  constructor(message: string, status: number = 500) {
    super(message);
    this.name = 'EmailMetricsError';
    this.status = status;
  }
}

export async function logCampaignjob(job: Campaignjob) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('campaign_jobs')
    .insert([job])
    .select()
    .single();

  if (error) {
    console.error('[logCampaignjob] Error inserting job:', error);
    return null;
  }
  return data;
}

export async function updateEmailLogStatus(
  logId: string,
  status: EmailStatus,
  timestamp: string
) {
  const supabase = createClient();

  const { error: updateError } = await supabase
    .from('eli5_email_log')
    .update({ 
      email_status: status, 
      updated_at: timestamp 
    })
    .eq('message_id', logId);

  if (updateError) {
    throw new EmailMetricsError(
      `Failed to update email log status: ${updateError.message}`,
      500
    );
  }
}
export const STATUS_KEY = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
} as const;
