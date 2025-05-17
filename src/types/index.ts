// src/types/index.ts

// Define the possible views for the SPA
export type CrmView = 
  | 'dashboard'
  | 'leads'
  | 'campaigns'
  | 'templates'
  | 'senders'
  | 'crm'
  | 'settings';

// Example Lead type (align with your Supabase schema)
// This type seems to be a mix of mock data structure and previous schema ideas.
// It will be used by LeadsView.tsx temporarily for modals, but the main display will use NormalizedLead.
export interface LeadViewModel_Deprecated {
  id: string; // Can be original_lead_id (UUID) or normalized_leads.id (number) depending on context
  firstName?: string; // From mock data in LeadsView
  lastName?: string;  // From mock data in LeadsView
  company?: string;   // From mock data in LeadsView
  email?: string;     // From mock data, maps to contact_email in NormalizedLead
  phone?: string;     // From mock data
  status?: 'New' | 'Contacted' | 'Qualified' | 'Lost' | 'Won' | 'contacted_step1' | 'contacted_step2' | 'offer_sent' | 'responded' | 'not_interested' | 'deal_closed' | 'new'; // Consolidating statuses
  source?: string;    // From mock data
  assignedTo?: string; // From mock data
  lastContactDate?: string; // From mock data, maps to updated_at or a specific interaction date
  potentialValue?: number; // From mock data
  notes?: string; // From mock data in LeadsView

  // Fields from your previous type definition in this file
  owner_name?: string; // Maps to contact_name in NormalizedLead
  owner_email?: string; // Maps to contact_email in NormalizedLead
  property_address?: string; // Directly in NormalizedLead
  regional_market?: string; // Maps to market_region in NormalizedLead
  last_contacted_at?: string; // From previous type, maps to updated_at
  lot_size_sqft?: string; // Added
  price_per_sq_ft?: string; // Added
}

// The 'NormalizedLead' interface has been removed. 
// Please use `Tables<'normalized_leads'>` from '@/types/supabase' for direct DB types,
// or create a specific ViewModel if transformations are needed.

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

// Sender type (unified)
export interface Sender {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  is_active: boolean;
  last_authorized_at?: string;
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


// User type (moved from engine.ts)
export interface User {
  id: string; // UUID
  email: string;
  full_name?: string;
  created_at: string; // ISO timestamp
  updated_at: string;
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
  assigned_user_ids: string[];
  subject: string;
  status: string;
}
