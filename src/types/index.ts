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
// This type seems to be a mix of mock data structure and previous schema ideas.
// It will be used by LeadsView.tsx temporarily for modals, but the main display will use NormalizedLead.
export interface Lead {
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

// New type representing the structure of the normalized_leads table from Supabase
export interface NormalizedLead {
  id: number; // From BIGSERIAL PRIMARY KEY
  original_lead_id?: string | null; // UUID from the 'leads' staging table
  
  // Contact fields from the multi-contact schema
  contact1_name?: string | null;
  contact1_email_1?: string | null;
  contact2_name?: string | null;
  contact2_email_1?: string | null;
  contact3_name?: string | null;
  contact3_email_1?: string | null;
  mls_curr_list_agent_name?: string | null;
  mls_curr_list_agent_email?: string | null;

  // Property details
  property_address?: string | null;
  property_city?: string | null;
  property_state?: string | null;
  property_postal_code?: string | null; // formerly property_zip in staging
  property_type?: string | null;
  baths?: string | null; // Note: these are TEXT in DB as per original SQL
  beds?: string | null;  // If they should be numbers, schema & parsing needs change
  year_built?: string | null;
  square_footage?: string | null;          
  wholesale_value?: number | string | null; // NUMERIC in DB
  assessed_total?: number | string | null;  // NUMERIC in DB
  mls_curr_status?: string | null;
  mls_curr_days_on_market?: string | null;
  market_region?: string | null; // Added for filtering
  
  created_at: string; // TIMESTAMPTZ from DB comes as string
  updated_at: string; // TIMESTAMPTZ from DB comes as string
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

// UserAccount type for user management
export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Agent' | 'Viewer';
  status: 'Active' | 'Pending' | 'Suspended';
  lastLogin: string;
  avatarUrl?: string;
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
