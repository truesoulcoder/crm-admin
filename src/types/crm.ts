export interface CrmLead {
  id: number; // bigserial maps to number in TS
  normalized_lead_id: number; // bigint maps to number or string, number is fine if IDs are within JS safe integer range
  contact_name?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  contact_type: string; // not null
  market_region?: string | null;
  property_address?: string | null;
  property_city?: string | null;
  property_state?: string | null;
  property_postal_code?: string | null;
  property_type?: string | null;
  baths?: number | null;
  beds?: number | null;
  year_built?: string | null;
  square_footage?: number | null;
  lot_size_sqft?: string | null;
  assessed_total?: number | null; // numeric
  mls_curr_status?: string | null;
  mls_curr_days_on_market?: string | null;
  converted: boolean; // not null, default false
  status?: string | null;
  notes?: string | null;
  created_at: string; // timestamp with time zone
  updated_at: string; // timestamp with time zone
  email_sent?: boolean | null; // default false
}
