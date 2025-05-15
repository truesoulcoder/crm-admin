// Shared types for CRM

// TODO: Replace this with your generated Supabase Database type
export type Database = any;


export interface Sender {
  id: number;
  employee_name: string;
  employee_email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  photo_url?: string;
}

// Campaign data with optional stats for front-end view
export interface Campaign {
  id: string;
  name: string;
  status: string;
  created_at: string;
  emailsSent?: number;
  openRate?: number;
  clickRate?: number;
  creationDate?: string;
}
