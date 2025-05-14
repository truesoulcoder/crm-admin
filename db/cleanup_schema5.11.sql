-- Supabase CRM Admin Cleanup Script v5.11
-- Drops all tables, functions, and policies created by schema_setup5.11.sql

-- TRIGGERS (drop before dropping update_updated_at_column)
DROP TRIGGER IF EXISTS set_processing_status_updated_at ON public.processing_status;
DROP TRIGGER IF EXISTS set_contacts_updated_at ON public.contacts;
DROP TRIGGER IF EXISTS set_document_templates_updated_at ON public.document_templates;
DROP TRIGGER IF EXISTS set_email_templates_updated_at ON public.email_templates;
DROP TRIGGER IF EXISTS set_senders_updated_at ON public.senders;
DROP TRIGGER IF EXISTS set_campaigns_updated_at ON public.campaigns;
DROP TRIGGER IF EXISTS set_campaign_actions_updated_at ON public.campaign_actions;
DROP TRIGGER IF EXISTS set_campaign_user_allocations_updated_at ON public.campaign_user_allocations;
DROP TRIGGER IF EXISTS set_application_settings_updated_at ON public.application_settings;
DROP TRIGGER IF EXISTS set_notifications_updated_at ON public.notifications;
DROP TRIGGER IF EXISTS set_tasks_updated_at ON public.tasks;
DROP TRIGGER IF EXISTS set_generated_documents_updated_at ON public.generated_documents;

-- FUNCTIONS
DROP FUNCTION IF EXISTS public.normalize_staged_leads();
DROP FUNCTION IF EXISTS public.normalize_staged_leads(p_market_region TEXT);
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- TABLES
DROP TABLE IF EXISTS public.contacts CASCADE;
DROP TABLE IF EXISTS public.document_templates CASCADE;
DROP TABLE IF EXISTS public.email_templates CASCADE;
DROP TABLE IF EXISTS public.senders CASCADE;
DROP TABLE IF EXISTS public.normalized_leads CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TABLE IF EXISTS public.campaign_actions CASCADE;
DROP TABLE IF EXISTS public.campaigns CASCADE;
DROP TABLE IF EXISTS public.generated_documents CASCADE;
DROP TABLE IF EXISTS public.application_settings CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;

-- EXTENSIONS (optional, comment out if you want to keep)
-- DROP EXTENSION IF EXISTS "uuid-ossp";

-- POLICIES (optional, only if you want a full wipe)
-- DROP POLICY IF EXISTS "Admin can manage their normalized_leads" ON public.normalized_leads;
-- DROP POLICY IF EXISTS "Admin can manage notifications" ON public.notifications;
-- DROP POLICY IF EXISTS "Admin can manage tasks" ON public.tasks;

-- TRIGGERS (optional, cascade drop should remove them)
-- No explicit DROP TRIGGER needed if CASCADE is used on tables.

-- End of cleanup script
