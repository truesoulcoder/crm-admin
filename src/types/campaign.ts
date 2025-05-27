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
  contact_name: string;
  email_address: string;
  assigned_sender_id: string;
  next_processing_time: string;
  error_message?: string;
  processed_at?: string;
  campaign_id?: string;
  market_region?: string;
}