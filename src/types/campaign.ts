export type CampaignStatus = 'draft' | 'active' | 'running' | 'paused' | 'completed';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  is_active: boolean;
  market_region: string;
  created_at: string;
}

export interface CampaignJob {
  id: string;
  status: JobStatus;
  contact_name: string | null;  // Allow null
  email_address: string | null; // Allow null
  assigned_sender_id: string | null; // This one too based on your error
  next_processing_time: string | null; // And this
  error_message?: string | null;
  processed_at?: string | null;
  campaign_id?: string | null;
  market_region?: string | null;
}