// src/types/index.ts

// Define the possible views for the SPA
export type CrmView = 
  | 'dashboard'
  | 'leads'
  | 'campaigns'
  | 'templates'
  | 'accounts'
  | 'settings';

// Example Lead type (align with your Supabase schema)
export interface Lead {
  id: string;
  owner_name: string;
  owner_email: string;
  property_address: string;
  regional_market: string;
  status: 'new' | 'contacted_step1' | 'contacted_step2' | 'offer_sent' | 'responded' | 'not_interested' | 'deal_closed';
  last_contacted_at: string; // ISO date string
  created_at: string; // ISO date string
  phone?: string;
  notes?: string;
}

// Example EmailTemplate type
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html_snippet: string;
  body_html_full: string;
  placeholders: string[];
  created_at: string;
  updated_at: string;
}

// Example GmailAccount type
export interface GmailAccount {
  id: string;
  employee_name: string;
  gmail_address: string;
  last_authorized_at: string;
  is_active: boolean;
  status_message?: string;
}

// Example CampaignStep type
export interface CampaignStep {
  id: string;
  step_number: number;
  template_name: string;
  template_id: string;
  delay_days: number;
  sending_account_name: string;
  sending_account_id: string;
}

// Example Campaign type
export interface Campaign {
  id: string;
  name: string;
  description: string;
  target_market: string | null;
  lead_status_trigger: string;
  is_active: boolean;
  created_at: string;
  total_leads_enrolled: number;
  emails_sent: number;
  reply_rate?: number;
  steps: CampaignStep[];
}
