// src/types/crm.ts

// Define the possible views for the SPA
export type CrmView = 
  | 'dashboard'
  | 'leads'
  | 'campaigns'
  | 'templates'
  | 'senders'
  | 'crm'
  | 'settings'
  | 'analytics';

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
  user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  is_default: boolean;
  credentials_json?: any;
  created_at: string;
  updated_at: string;
  photo_url?: string;
  status_message?: string;
  last_authorized_at?: string;
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
  updated_at: string;
  // Consider adding more fields like 'status', 'start_date', 'end_date'
  // and potentially an array of 'CampaignStep' if campaigns have multiple steps.
  steps?: CampaignStep[];
}

export interface CrmLead {
  contact_email?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_type: string;
  converted: boolean;
  created_at: string;
  id: number;
  market_region?: string | null;
  mls_curr_days_on_market?: string | null;
  mls_curr_list_agent_email?: string | null;
  mls_curr_list_agent_name?: string | null;
  mls_curr_status?: string | null;
  notes?: string | null;

  property_address?: string | null;
  property_city?: string | null;
  property_postal_code?: string | null;
  property_state?: string | null;
  property_type?: string | null;
  source?: string | null;
  status?: string | null;
  updated_at: string;
  wholesale_value?: number | null;
  year_built?: string | null;
  baths?: string | null;
  beds?: string | null;
  square_footage?: string | null;
  lot_size_sqft?: string | null;
  assessed_total?: number | null;
  avm_value?: number | null;
  price_per_sq_ft?: number | null;
}
