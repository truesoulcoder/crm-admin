// Engine-specific DB types

export interface User {
  id: string; // UUID
  email: string;
  full_name?: string;
  created_at: string; // ISO timestamp
  updated_at: string;
}

export interface Template {
  id: string;
  name: string;
  type: 'email' | 'pdf';
  subject?: string;
  content?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  subject?: string;
  email_template_id?: string;
  document_template_id?: string;
  template_id?: string; // legacy field
  pdf_template_id?: string; // legacy field
  assigned_user_ids?: string[];
  status: string;
  market_region?: string;
  quota?: number;
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CampaignUserAllocation {
  id: string;
  campaign_id: string;
  user_id: string;
  daily_quota: number;
  sent_today: number;
  total_sent: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignJob {
  id: string;
  campaign_id: string;
  lead_id: number;
  status: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailTask {
  id: string;
  campaign_job_id: string;
  assigned_user_id: string;
  contact_email: string;
  subject?: string;
  body?: string;
  pdf_template_id?: string;
  pdf_generated: boolean;
  attachments?: Record<string, unknown>;
  status: string;
  gmail_message_id?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface NormalizedLead {
  id: number;
  contact1_email_1?: string;
  contact2_email_1?: string;
  contact3_email_1?: string;
  mls_curr_list_agent_email?: string;
  [key: string]: any;
}

export interface SystemEventLog {
  id: string;
  event_type: string;
  details: Record<string, unknown>;
  related_id?: string;
  created_at: string;
}
