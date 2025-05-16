export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      application_settings: {
        Row: {
          created_at: string;
          description: string | null;
          group_name: string | null;
          id: number;
          is_sensitive: boolean | null;
          key: string;
          updated_at: string;
          value: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          group_name?: string | null;
          id?: number;
          is_sensitive?: boolean | null;
          key: string;
          updated_at?: string;
          value?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          group_name?: string | null;
          id?: number;
          is_sensitive?: boolean | null;
          key?: string;
          updated_at?: string;
          value?: string | null;
        };
        Relationships: [];
      };
      campaign_actions: {
        Row: {
          action_type: string;
          campaign_id: string;
          created_at: string;
          delay_after_previous_seconds: number | null;
          details_json: Json | null;
          document_template_id: string | null;
          email_template_id: string | null;
          id: string;
          name: string;
          sequence_order: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          action_type: string;
          campaign_id: string;
          created_at?: string;
          delay_after_previous_seconds?: number | null;
          details_json?: Json | null;
          document_template_id?: string | null;
          email_template_id?: string | null;
          id?: string;
          name: string;
          sequence_order: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          action_type?: string;
          campaign_id?: string;
          created_at?: string;
          delay_after_previous_seconds?: number | null;
          details_json?: Json | null;
          document_template_id?: string | null;
          email_template_id?: string | null;
          id?: string;
          name?: string;
          sequence_order?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_actions_email_template_id_fkey";
            columns: ["email_template_id"];
            isOneToOne: false;
            referencedRelation: "email_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_jobs: {
        Row: {
          campaign_id: string;
          completed_at: string | null;
          created_at: string;
          error_details: string | null;
          id: string;
          normalized_lead_id: number;
          started_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          campaign_id: string;
          completed_at?: string | null;
          created_at?: string;
          error_details?: string | null;
          id?: string;
          normalized_lead_id: number;
          started_at?: string | null;
          status: string;
          updated_at?: string;
        };
        Update: {
          campaign_id?: string;
          completed_at?: string | null;
          created_at?: string;
          error_details?: string | null;
          id?: string;
          normalized_lead_id?: number;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaign_jobs_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_jobs_normalized_lead_id_fkey";
            columns: ["normalized_lead_id"];
            isOneToOne: false;
            referencedRelation: "normalized_leads";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
