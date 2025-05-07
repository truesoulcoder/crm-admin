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
}

// New type representing the structure of the normalized_leads table from Supabase
export interface NormalizedLead {
  id: number; // BIGSERIAL PRIMARY KEY from normalized_leads
  original_lead_id?: string | null; // UUID, from 'leads' staging table, if you join or carry it over
  contact_name?: string | null;
  contact_email?: string | null;
  property_address?: string | null;
  property_city?: string | null;
  property_state?: string | null;
  property_postal_code?: string | null;
  property_type?: string | null;
  baths?: string | null;         // Stored as TEXT, consider conversion in UI if needed for numeric ops
  beds?: string | null;          // Stored as TEXT
  year_built?: string | null;    // Stored as TEXT
  square_footage?: string | null;// Stored as TEXT
  wholesale_value?: string | null; // Stored as TEXT, consider NUMERIC if used for calculations
  assessed_total?: string | null;  // Stored as TEXT, consider NUMERIC
  avm_value?: number | null;       // NUMERIC in DB
  mls_curr_status?: string | null;
  mls_curr_days_on_market?: string | null; // Stored as TEXT, consider INTEGER
  market_region?: string | null;   // TEXT
  created_at: string; // TIMESTAMPTZ - will be string when fetched
  updated_at?: string | null; // TIMESTAMPTZ - will be string when fetched
  // Add any other relevant fields from your normalized_leads table as needed for display
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
