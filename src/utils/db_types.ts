export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      application_settings: {
        Row: {
          created_at: string
          description: string | null
          group_name: string | null
          id: number
          is_sensitive: boolean | null
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_name?: string | null
          id?: number
          is_sensitive?: boolean | null
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          group_name?: string | null
          id?: number
          is_sensitive?: boolean | null
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      austin_fine_cut_leads: {
        Row: {
          assessed_total: number | null
          avm_value: number | null
          baths: string | null
          beds: string | null
          contact_email: string | null
          contact_name: string | null
          contact_type: string
          converted: boolean
          created_at: string
          email_sent: boolean | null
          id: number
          lot_size_sqft: string | null
          market_region: string | null
          mls_curr_days_on_market: string | null
          mls_curr_status: string | null
          notes: string | null
          original_lead_id: string | null
          price_per_sq_ft: number | null
          property_address: string | null
          property_city: string | null
          property_postal_code: string | null
          property_state: string | null
          property_type: string | null
          source: string | null
          square_footage: string | null
          status: string | null
          updated_at: string
          wholesale_value: number | null
          year_built: string | null
        }
        Insert: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_type: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Update: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_type?: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Relationships: []
      }
      brownsville_fine_cut_leads: {
        Row: {
          assessed_total: number | null
          avm_value: number | null
          baths: string | null
          beds: string | null
          contact_email: string | null
          contact_name: string | null
          contact_type: string
          converted: boolean
          created_at: string
          email_sent: boolean | null
          id: number
          lot_size_sqft: string | null
          market_region: string | null
          mls_curr_days_on_market: string | null
          mls_curr_status: string | null
          notes: string | null
          original_lead_id: string | null
          price_per_sq_ft: number | null
          property_address: string | null
          property_city: string | null
          property_postal_code: string | null
          property_state: string | null
          property_type: string | null
          source: string | null
          square_footage: string | null
          status: string | null
          updated_at: string
          wholesale_value: number | null
          year_built: string | null
        }
        Insert: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_type: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Update: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_type?: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Relationships: []
      }
      campaign_jobs: {
        Row: {
          assigned_sender_id: string | null
          campaign_id: string
          contact_email: string
          contact_name: string | null
          created_at: string | null
          current_step: number | null
          error_message: string | null
          id: number
          lead_id: string
          metadata: Json | null
          next_processing_time: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          assigned_sender_id?: string | null
          campaign_id: string
          contact_email: string
          contact_name?: string | null
          created_at?: string | null
          current_step?: number | null
          error_message?: string | null
          id?: number
          lead_id: string
          metadata?: Json | null
          next_processing_time?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          assigned_sender_id?: string | null
          campaign_id?: string
          contact_email?: string
          contact_name?: string | null
          created_at?: string | null
          current_step?: number | null
          error_message?: string | null
          id?: number
          lead_id?: string
          metadata?: Json | null
          next_processing_time?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_jobs_assigned_sender_id_fkey"
            columns: ["assigned_sender_id"]
            isOneToOne: false
            referencedRelation: "senders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_campaign"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_campaign_jobs_campaign"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_campaign_jobs_sender"
            columns: ["assigned_sender_id"]
            isOneToOne: false
            referencedRelation: "senders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sender"
            columns: ["assigned_sender_id"]
            isOneToOne: false
            referencedRelation: "senders"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_jobs_backup: {
        Row: {
          assigned_sender_id: string | null
          campaign_id: string
          contact_email: string
          contact_name: string | null
          created_at: string | null
          current_step: number | null
          error_message: string | null
          id: string
          lead_id: string
          metadata: Json | null
          next_processing_time: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          assigned_sender_id?: string | null
          campaign_id: string
          contact_email: string
          contact_name?: string | null
          created_at?: string | null
          current_step?: number | null
          error_message?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          next_processing_time?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          assigned_sender_id?: string | null
          campaign_id?: string
          contact_email?: string
          contact_name?: string | null
          created_at?: string | null
          current_step?: number | null
          error_message?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          next_processing_time?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_jobs_backup_assigned_sender_id_fkey"
            columns: ["assigned_sender_id"]
            isOneToOne: false
            referencedRelation: "senders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_jobs_backup_assigned_sender_id_fkey1"
            columns: ["assigned_sender_id"]
            isOneToOne: false
            referencedRelation: "senders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_jobs_backup_assigned_sender_id_fkey2"
            columns: ["assigned_sender_id"]
            isOneToOne: false
            referencedRelation: "senders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_jobs_backup_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_jobs_backup_campaign_id_fkey1"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_jobs_backup_campaign_id_fkey2"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_leads: {
        Row: {
          added_at: string
          campaign_id: string
          contact_email: string | null
          contact_name: string | null
          contact_type: string | null
          conversion_type: string | null
          converted_at: string | null
          current_action_id: string | null
          email_clicked_at: string | null
          email_delivered_at: string | null
          email_message_id: string | null
          email_opened_at: string | null
          email_sent: boolean | null
          email_sent_at: string | null
          email_thread_id: string | null
          error_message: string | null
          id: string
          is_converted: boolean | null
          last_processed_at: string | null
          last_response_received_at: string | null
          last_response_subject: string | null
          last_response_text: string | null
          notes: string | null
          response_count: number | null
          status: string | null
          user_id: string
        }
        Insert: {
          added_at?: string
          campaign_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_type?: string | null
          conversion_type?: string | null
          converted_at?: string | null
          current_action_id?: string | null
          email_clicked_at?: string | null
          email_delivered_at?: string | null
          email_message_id?: string | null
          email_opened_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          email_thread_id?: string | null
          error_message?: string | null
          id?: string
          is_converted?: boolean | null
          last_processed_at?: string | null
          last_response_received_at?: string | null
          last_response_subject?: string | null
          last_response_text?: string | null
          notes?: string | null
          response_count?: number | null
          status?: string | null
          user_id: string
        }
        Update: {
          added_at?: string
          campaign_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_type?: string | null
          conversion_type?: string | null
          converted_at?: string | null
          current_action_id?: string | null
          email_clicked_at?: string | null
          email_delivered_at?: string | null
          email_message_id?: string | null
          email_opened_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          email_thread_id?: string | null
          error_message?: string | null
          id?: string
          is_converted?: boolean | null
          last_processed_at?: string | null
          last_response_received_at?: string | null
          last_response_subject?: string | null
          last_response_text?: string | null
          notes?: string | null
          response_count?: number | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_campaign"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_campaign_leads_campaign"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_runs: {
        Row: {
          campaign_id: string
          completed_at: string | null
          created_at: string | null
          failed_emails: number | null
          id: string
          sent_emails: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          total_emails: number | null
          updated_at: string | null
        }
        Insert: {
          campaign_id: string
          completed_at?: string | null
          created_at?: string | null
          failed_emails?: number | null
          id?: string
          sent_emails?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          total_emails?: number | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string
          completed_at?: string | null
          created_at?: string | null
          failed_emails?: number | null
          id?: string
          sent_emails?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          total_emails?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_campaign"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_campaign_runs_campaign"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_steps: {
        Row: {
          action_type: string
          campaign_id: string
          created_at: string | null
          delay_days: number | null
          delay_hours: number | null
          id: string
          step_number: number
          subject_template: string | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          action_type: string
          campaign_id: string
          created_at?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          id?: string
          step_number: number
          subject_template?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          action_type?: string
          campaign_id?: string
          created_at?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          id?: string
          step_number?: number
          subject_template?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_campaign_steps_campaign"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string | null
          daily_limit: number | null
          description: string | null
          dry_run: boolean | null
          id: string
          is_active: boolean | null
          market_region: string | null
          max_interval_seconds: number | null
          min_interval_seconds: number | null
          name: string
          sender_quota: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          daily_limit?: number | null
          description?: string | null
          dry_run?: boolean | null
          id?: string
          is_active?: boolean | null
          market_region?: string | null
          max_interval_seconds?: number | null
          min_interval_seconds?: number | null
          name: string
          sender_quota?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          daily_limit?: number | null
          description?: string | null
          dry_run?: boolean | null
          id?: string
          is_active?: boolean | null
          market_region?: string | null
          max_interval_seconds?: number | null
          min_interval_seconds?: number | null
          name?: string
          sender_quota?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_leads: {
        Row: {
          assessed_total: number | null
          baths: string | null
          beds: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_type: string
          converted: boolean
          created_at: string
          email_sent: boolean | null
          id: number
          lot_size_sqft: string | null
          market_region: string | null
          mls_curr_days_on_market: string | null
          mls_curr_status: string | null
          notes: string | null
          phone: string | null
          phone_number: number | null
          property_address: string | null
          property_city: string | null
          property_postal_code: string | null
          property_state: string | null
          property_type: string | null
          square_footage: string | null
          status: string | null
          updated_at: string
          year_built: string | null
        }
        Insert: {
          assessed_total?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_type: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          phone?: string | null
          phone_number?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          year_built?: string | null
        }
        Update: {
          assessed_total?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_type?: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          phone?: string | null
          phone_number?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          year_built?: string | null
        }
        Relationships: []
      }
      dfw_metroplex_fine_cut_leads: {
        Row: {
          assessed_total: number | null
          avm_value: number | null
          baths: string | null
          beds: string | null
          contact_email: string | null
          contact_name: string | null
          contact_type: string
          converted: boolean
          created_at: string
          email_sent: boolean | null
          id: number
          lot_size_sqft: string | null
          market_region: string | null
          mls_curr_days_on_market: string | null
          mls_curr_status: string | null
          notes: string | null
          original_lead_id: string | null
          price_per_sq_ft: number | null
          property_address: string | null
          property_city: string | null
          property_postal_code: string | null
          property_state: string | null
          property_type: string | null
          source: string | null
          square_footage: string | null
          status: string | null
          updated_at: string
          wholesale_value: number | null
          year_built: string | null
        }
        Insert: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_type: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Update: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_type?: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Relationships: []
      }
      document_templates: {
        Row: {
          available_placeholders: string[] | null
          content: string | null
          created_at: string | null
          created_by: string
          deleted_at: string | null
          file_path: string | null
          file_type: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string | null
          type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          available_placeholders?: string[] | null
          content?: string | null
          created_at?: string | null
          created_by: string
          deleted_at?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject?: string | null
          type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          available_placeholders?: string[] | null
          content?: string | null
          created_at?: string | null
          created_by?: string
          deleted_at?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      eli5_email_log: {
        Row: {
          assessed_total: number | null
          baths: string | null
          beds: string | null
          campaign_id: string | null
          campaign_run_id: string | null
          contact_email: string
          contact_name: string | null
          converted: boolean
          email_body_preview_sent: string | null
          email_error_message: string | null
          email_sent_at: string | null
          email_status: string
          email_subject_sent: string | null
          id: number
          market_region: string | null
          mls_curr_days_on_market: string | null
          mls_curr_status: string | null
          normalized_lead_converted_status: boolean | null
          processed_at: string
          property_address: string | null
          property_city: string | null
          property_postal_code: string | null
          property_state: string | null
          property_type: string | null
          sender_email_used: string | null
          sender_name: string | null
          square_footage: string | null
          year_built: string | null
        }
        Insert: {
          assessed_total?: number | null
          baths?: string | null
          beds?: string | null
          campaign_id?: string | null
          campaign_run_id?: string | null
          contact_email: string
          contact_name?: string | null
          converted?: boolean
          email_body_preview_sent?: string | null
          email_error_message?: string | null
          email_sent_at?: string | null
          email_status: string
          email_subject_sent?: string | null
          id?: number
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          normalized_lead_converted_status?: boolean | null
          processed_at?: string
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          sender_email_used?: string | null
          sender_name?: string | null
          square_footage?: string | null
          year_built?: string | null
        }
        Update: {
          assessed_total?: number | null
          baths?: string | null
          beds?: string | null
          campaign_id?: string | null
          campaign_run_id?: string | null
          contact_email?: string
          contact_name?: string | null
          converted?: boolean
          email_body_preview_sent?: string | null
          email_error_message?: string | null
          email_sent_at?: string | null
          email_status?: string
          email_subject_sent?: string | null
          id?: number
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          normalized_lead_converted_status?: boolean | null
          processed_at?: string
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          sender_email_used?: string | null
          sender_name?: string | null
          square_footage?: string | null
          year_built?: string | null
        }
        Relationships: []
      }
      eli5_engine_status: {
        Row: {
          created_at: string | null
          status_key: string
          status_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          status_key: string
          status_value: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          status_key?: string
          status_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          created_at: string | null
          created_by: string
          deleted_at: string | null
          id: string
          is_active: boolean | null
          name: string
          placeholders: string[] | null
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body_html: string
          body_text?: string | null
          created_at?: string | null
          created_by: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          placeholders?: string[] | null
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body_html?: string
          body_text?: string | null
          created_at?: string | null
          created_by?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          placeholders?: string[] | null
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      engine_control: {
        Row: {
          created_at: string | null
          current_campaign_id: string | null
          id: string
          is_running: boolean | null
          last_started_at: string | null
          last_stopped_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_campaign_id?: string | null
          id?: string
          is_running?: boolean | null
          last_started_at?: string | null
          last_stopped_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_campaign_id?: string | null
          id?: string
          is_running?: boolean | null
          last_started_at?: string | null
          last_stopped_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engine_control_current_campaign_id_fkey"
            columns: ["current_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      gulf_coast_fine_cut_leads: {
        Row: {
          assessed_total: number | null
          avm_value: number | null
          baths: string | null
          beds: string | null
          contact_email: string | null
          contact_name: string | null
          contact_type: string
          converted: boolean
          created_at: string
          email_sent: boolean | null
          id: number
          lot_size_sqft: string | null
          market_region: string | null
          mls_curr_days_on_market: string | null
          mls_curr_status: string | null
          notes: string | null
          original_lead_id: string | null
          price_per_sq_ft: number | null
          property_address: string | null
          property_city: string | null
          property_postal_code: string | null
          property_state: string | null
          property_type: string | null
          source: string | null
          square_footage: string | null
          status: string | null
          updated_at: string
          wholesale_value: number | null
          year_built: string | null
        }
        Insert: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_type: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Update: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_type?: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Relationships: []
      }
      houston_fine_cut_leads: {
        Row: {
          assessed_total: number | null
          avm_value: number | null
          baths: string | null
          beds: string | null
          contact_email: string | null
          contact_name: string | null
          contact_type: string
          converted: boolean
          created_at: string
          email_sent: boolean | null
          id: number
          lot_size_sqft: string | null
          market_region: string | null
          mls_curr_days_on_market: string | null
          mls_curr_status: string | null
          notes: string | null
          original_lead_id: string | null
          price_per_sq_ft: number | null
          property_address: string | null
          property_city: string | null
          property_postal_code: string | null
          property_state: string | null
          property_type: string | null
          source: string | null
          square_footage: string | null
          status: string | null
          updated_at: string
          wholesale_value: number | null
          year_built: string | null
        }
        Insert: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_type: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Update: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_type?: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Relationships: []
      }
      indianapolis_fine_cut_leads: {
        Row: {
          assessed_total: number | null
          avm_value: number | null
          baths: string | null
          beds: string | null
          contact_email: string | null
          contact_name: string | null
          contact_type: string
          converted: boolean
          created_at: string
          email_sent: boolean | null
          id: number
          lot_size_sqft: string | null
          market_region: string | null
          mls_curr_days_on_market: string | null
          mls_curr_status: string | null
          notes: string | null
          original_lead_id: string | null
          price_per_sq_ft: number | null
          property_address: string | null
          property_city: string | null
          property_postal_code: string | null
          property_state: string | null
          property_type: string | null
          source: string | null
          square_footage: string | null
          status: string | null
          updated_at: string
          wholesale_value: number | null
          year_built: string | null
        }
        Insert: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_type: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Update: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_type?: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          id: string
          market_region: string
          normalization_error: string | null
          normalization_status: string
          original_filename: string
          raw_data: Json
          updated_at: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          id?: string
          market_region: string
          normalization_error?: string | null
          normalization_status?: string
          original_filename: string
          raw_data: Json
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          id?: string
          market_region?: string
          normalization_error?: string | null
          normalization_status?: string
          original_filename?: string
          raw_data?: Json
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      market_regions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          lead_count: number | null
          name: string
          normalized_name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_count?: number | null
          name: string
          normalized_name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          lead_count?: number | null
          name?: string
          normalized_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      normalized_leads: {
        Row: {
          assessed_total: number | null
          avm_value: number | null
          baths: string | null
          beds: string | null
          contact1_email_1: string | null
          contact1_name: string | null
          contact2_email_1: string | null
          contact2_name: string | null
          contact3_email_1: string | null
          contact3_name: string | null
          converted: boolean
          created_at: string
          id: number
          lot_size_sqft: string | null
          market_region: string | null
          mls_curr_days_on_market: string | null
          mls_curr_list_agent_email: string | null
          mls_curr_list_agent_name: string | null
          mls_curr_status: string | null
          notes: string | null
          original_lead_id: string | null
          price_per_sq_ft: number | null
          property_address: string | null
          property_city: string | null
          property_postal_code: string | null
          property_state: string | null
          property_type: string | null
          source: string | null
          square_footage: string | null
          status: string | null
          updated_at: string
          wholesale_value: number | null
          year_built: string | null
        }
        Insert: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact1_email_1?: string | null
          contact1_name?: string | null
          contact2_email_1?: string | null
          contact2_name?: string | null
          contact3_email_1?: string | null
          contact3_name?: string | null
          converted?: boolean
          created_at?: string
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_list_agent_email?: string | null
          mls_curr_list_agent_name?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Update: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact1_email_1?: string | null
          contact1_name?: string | null
          contact2_email_1?: string | null
          contact2_name?: string | null
          contact3_email_1?: string | null
          contact3_name?: string | null
          converted?: boolean
          created_at?: string
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_list_agent_email?: string | null
          mls_curr_list_agent_name?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "normalized_leads_original_lead_id_fkey"
            columns: ["original_lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      san_antonio_fine_cut_leads: {
        Row: {
          assessed_total: number | null
          avm_value: number | null
          baths: string | null
          beds: string | null
          contact_email: string | null
          contact_name: string | null
          contact_type: string
          converted: boolean
          created_at: string
          email_sent: boolean | null
          id: number
          lot_size_sqft: string | null
          market_region: string | null
          mls_curr_days_on_market: string | null
          mls_curr_status: string | null
          notes: string | null
          original_lead_id: string | null
          price_per_sq_ft: number | null
          property_address: string | null
          property_city: string | null
          property_postal_code: string | null
          property_state: string | null
          property_type: string | null
          source: string | null
          square_footage: string | null
          status: string | null
          updated_at: string
          wholesale_value: number | null
          year_built: string | null
        }
        Insert: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_type: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Update: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_type?: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Relationships: []
      }
      senders: {
        Row: {
          created_at: string | null
          credentials_json: Json | null
          daily_limit: number | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          last_authorized_at: string | null
          last_reset_date: string | null
          sender_email: string
          sender_name: string
          sent_today: number | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          credentials_json?: Json | null
          daily_limit?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_authorized_at?: string | null
          last_reset_date?: string | null
          sender_email: string
          sender_name: string
          sent_today?: number | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          credentials_json?: Json | null
          daily_limit?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_authorized_at?: string | null
          last_reset_date?: string | null
          sender_email?: string
          sender_name?: string
          sent_today?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      system_event_logs: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: number
          message: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: number
          message?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: number
          message?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      system_state: {
        Row: {
          created_at: string
          id: number
          is_paused: boolean
          is_running: boolean
          paused_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_paused?: boolean
          is_running?: boolean
          paused_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          is_paused?: boolean
          is_running?: boolean
          paused_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      test: {
        Row: {
          assessed_total: number | null
          avm_value: number | null
          baths: string | null
          beds: string | null
          contact_email: string | null
          contact_name: string | null
          contact_type: string
          converted: boolean
          created_at: string
          email_sent: boolean | null
          id: number
          lot_size_sqft: string | null
          market_region: string | null
          mls_curr_days_on_market: string | null
          mls_curr_status: string | null
          notes: string | null
          original_lead_id: string | null
          price_per_sq_ft: number | null
          property_address: string | null
          property_city: string | null
          property_postal_code: string | null
          property_state: string | null
          property_type: string | null
          source: string | null
          square_footage: string | null
          status: string | null
          updated_at: string
          wholesale_value: number | null
          year_built: string | null
        }
        Insert: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_type: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Update: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_type?: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Relationships: []
      }
      west_texas_fine_cut_leads: {
        Row: {
          assessed_total: number | null
          avm_value: number | null
          baths: string | null
          beds: string | null
          contact_email: string | null
          contact_name: string | null
          contact_type: string
          converted: boolean
          created_at: string
          email_sent: boolean | null
          id: number
          lot_size_sqft: string | null
          market_region: string | null
          mls_curr_days_on_market: string | null
          mls_curr_status: string | null
          notes: string | null
          original_lead_id: string | null
          price_per_sq_ft: number | null
          property_address: string | null
          property_city: string | null
          property_postal_code: string | null
          property_state: string | null
          property_type: string | null
          source: string | null
          square_footage: string | null
          status: string | null
          updated_at: string
          wholesale_value: number | null
          year_built: string | null
        }
        Insert: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_type: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Update: {
          assessed_total?: number | null
          avm_value?: number | null
          baths?: string | null
          beds?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_type?: string
          converted?: boolean
          created_at?: string
          email_sent?: boolean | null
          id?: number
          lot_size_sqft?: string | null
          market_region?: string | null
          mls_curr_days_on_market?: string | null
          mls_curr_status?: string | null
          notes?: string | null
          original_lead_id?: string | null
          price_per_sq_ft?: number | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          property_type?: string | null
          source?: string | null
          square_footage?: string | null
          status?: string | null
          updated_at?: string
          wholesale_value?: number | null
          year_built?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      active_market_regions: {
        Row: {
          created_at: string | null
          id: string | null
          lead_count: number | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          lead_count?: number | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          lead_count?: number | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_email_metrics: {
        Row: {
          bounce_rate: number | null
          bounced: number | null
          click_rate: number | null
          clicked: number | null
          date: string | null
          delivered: number | null
          delivery_rate: number | null
          open_rate: number | null
          opened: number | null
          replied: number | null
          reply_rate: number | null
          sent: number | null
          total_sent: number | null
        }
        Relationships: []
      }
      email_metrics_by_sender: {
        Row: {
          bounce_rate: number | null
          bounced: number | null
          click_rate: number | null
          clicked: number | null
          delivered: number | null
          delivery_rate: number | null
          email: string | null
          name: string | null
          open_rate: number | null
          opened: number | null
          replied: number | null
          reply_rate: number | null
          sent: number | null
          total_sent: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_market_specific_fine_cut_leads_table: {
        Args: { p_market_region_raw_name: string }
        Returns: string
      }
      generate_complete_schema_dump: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_campaigns_to_process: {
        Args: Record<PropertyKey, never>
        Returns: {
          campaign_id: string
          campaign_name: string
          pending_jobs: number
        }[]
      }
      get_email_metrics_time_series: {
        Args: { start_date: string; end_date: string; interval_days?: number }
        Returns: {
          date_group: string
          sent: number
          delivered: number
          bounced: number
          opened: number
          clicked: number
          replied: number
        }[]
      }
      increment_sender_sent_count: {
        Args: { sender_id: string }
        Returns: undefined
      }
      normalize_market_name: {
        Args: { p_name: string }
        Returns: string
      }
      normalize_staged_leads: {
        Args:
          | { p_market_region: string }
          | { p_market_region: string; p_user_id: string }
        Returns: undefined
      }
      reorder_campaign_steps: {
        Args: { p_campaign_id: string; p_step_ids: string[] }
        Returns: {
          action_type: string
          campaign_id: string
          created_at: string | null
          delay_days: number | null
          delay_hours: number | null
          id: string
          step_number: number
          subject_template: string | null
          template_id: string | null
          updated_at: string | null
        }[]
      }
      reset_all_sender_daily_counts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      reset_sender_daily_count: {
        Args: { sender_id: string }
        Returns: undefined
      }
      schedule_campaign: {
        Args: { p_start_offset: unknown; p_campaign_id: string }
        Returns: undefined
      }
      start_eli5_engine: {
        Args: {
          p_dry_run?: boolean
          p_limit_per_run?: number
          p_market_region?: string
          p_min_interval_seconds?: number
          p_max_interval_seconds?: number
          p_selected_sender_ids?: string[]
        }
        Returns: {
          message: string
          campaign_id: string
          campaign_name: string
          status: string
          dry_run: boolean
        }[]
      }
      stop_eli5_engine: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      test_email_send: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      trigger_eli5_test_email: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      trigger_preflight_check: {
        Args: { campaign_id_param: string }
        Returns: Json
      }
      truncate_normalized_leads: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      campaign_status:
        | "DRAFT"
        | "SCHEDULED"
        | "RUNNING"
        | "PAUSED"
        | "COMPLETED"
        | "STOPPED"
        | "FAILED"
      campaign_status_enum:
        | "pending"
        | "in_progress"
        | "completed"
        | "paused"
        | "error"
        | "AWAITING_CONFIRMATION"
      email_status:
        | "PENDING"
        | "SENDING"
        | "SENT"
        | "DELIVERED"
        | "FAILED"
        | "BOUNCED"
        | "OPENED"
        | "CLICKED"
        | "COMPLAINED"
      sender_status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "LIMIT_REACHED"
    }
    CompositeTypes: {
      fine_cut_lead_type: {
        id: number | null
        original_lead_id: string | null
        market_region_id: string | null
        market_region_name: string | null
        contact_name: string | null
        contact_email: string | null
        contact_phone: string | null
        contact_type: string | null
        property_address: string | null
        property_city: string | null
        property_state: string | null
        property_postal_code: string | null
        source: string | null
        notes: string | null
        created_at: string | null
        updated_at: string | null
      }
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      campaign_status: [
        "DRAFT",
        "SCHEDULED",
        "RUNNING",
        "PAUSED",
        "COMPLETED",
        "STOPPED",
        "FAILED",
      ],
      campaign_status_enum: [
        "pending",
        "in_progress",
        "completed",
        "paused",
        "error",
        "AWAITING_CONFIRMATION",
      ],
      email_status: [
        "PENDING",
        "SENDING",
        "SENT",
        "DELIVERED",
        "FAILED",
        "BOUNCED",
        "OPENED",
        "CLICKED",
        "COMPLAINED",
      ],
      sender_status: ["ACTIVE", "INACTIVE", "SUSPENDED", "LIMIT_REACHED"],
    },
  },
} as const
