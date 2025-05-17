// CRM Types
type CrmLead = {
  id: string;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
  status: string;
  source: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  next_follow_up: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  campaign_id: string | null;
  custom_fields: Record<string, unknown> | null;
};

type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
};

type Campaign = {
  id: string;
  name: string;
};

type Lead = CrmLead & {
  assigned_user?: UserProfile | null;
  campaign?: Campaign | null;
};

type LeadFormData = Partial<CrmLead>;

// Status options for leads
const statusOptions = [
  { value: 'NEW', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'CONTACTED', label: 'Contacted', color: 'bg-purple-100 text-purple-800' },
  { value: 'QUALIFIED', label: 'Qualified', color: 'bg-green-100 text-green-800' },
  { value: 'PROPOSAL_SENT', label: 'Proposal Sent', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'NEGOTIATION', label: 'Negotiation', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'WON', label: 'Won', color: 'bg-green-500 text-white' },
  { value: 'LOST', label: 'Lost', color: 'bg-red-100 text-red-800' },
  { value: 'UNQUALIFIED', label: 'Unqualified', color: 'bg-gray-100 text-gray-800' },
];

export type { CrmLead, UserProfile, Campaign, Lead, LeadFormData };
export { statusOptions };
