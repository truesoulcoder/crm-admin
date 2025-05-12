-- Supabase CRM Admin Schema Setup
-- Version 5.11 (Consolidated)

-- PART 0: UTILITY FUNCTIONS AND EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- For gen_random_uuid()

-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- PART 1: STAGING AREA AND NORMALIZATION LOGIC

-- Staging table for raw lead import (typically from CSV)
-- This table is temporary and cleared after normalization.
DROP TABLE IF EXISTS public.leads CASCADE;
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Raw fields directly from CSV - adapt as needed
    contact1_name TEXT,
    contact1_email_1 TEXT,
    contact2_name TEXT,
    contact2_email_1 TEXT,
    contact3_name TEXT,
    contact3_email_1 TEXT,
    mls_curr_list_agent_name TEXT,
    mls_curr_list_agent_email TEXT,
    property_address TEXT,
    property_city TEXT,
    property_state TEXT,
    property_zip TEXT, -- Will be mapped to property_postal_code
    property_type TEXT,
    baths TEXT,
    beds TEXT,
    year_built TEXT,
    square_footage TEXT,
    wholesale_value TEXT, -- Will be cleaned and cast to NUMERIC
    assessed_total TEXT,  -- Will be cleaned and cast to NUMERIC
    mls_curr_status TEXT,
    mls_curr_days_on_market TEXT,
    market_region TEXT, -- Added market region field
    -- Add any other fields from your CSV import
    created_at TIMESTAMPTZ DEFAULT NOW(),
    imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL -- Tracks who imported
);
COMMENT ON TABLE public.leads IS 'Staging table for raw imported lead data. Data is normalized and moved to normalized_leads.';

-- Normalization function for multi-contact schema (region-aware)
DROP FUNCTION IF EXISTS public.normalize_staged_leads();
DROP FUNCTION IF EXISTS public.normalize_staged_leads(p_market_region TEXT);

-- Unified normalized_leads table schema (multi-contact, matches new function)
DROP TABLE IF EXISTS public.normalized_leads CASCADE;
CREATE TABLE public.normalized_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_lead_id UUID UNIQUE,
    contact_name TEXT,
    contact_email TEXT,
    contact1_name TEXT,
    contact1_email_1 TEXT,
    contact2_name TEXT,
    contact2_email_1 TEXT,
    contact3_name TEXT,
    contact3_email_1 TEXT,
    mls_curr_list_agent_name TEXT,
    mls_curr_list_agent_email TEXT,
    property_address TEXT,
    property_city TEXT,
    property_state TEXT,
    property_postal_code TEXT,
    property_type TEXT,
    baths TEXT,
    beds TEXT,
    year_built TEXT,
    square_footage TEXT,
    wholesale_value NUMERIC,
    assessed_total NUMERIC,
    mls_curr_status TEXT,
    mls_curr_days_on_market TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Correct normalization function
CREATE OR REPLACE FUNCTION public.normalize_staged_leads(p_market_region TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Drop and recreate normalized_leads with the multi-contact schema
    DROP TABLE IF EXISTS public.normalized_leads CASCADE;
    CREATE TABLE public.normalized_leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        original_lead_id UUID UNIQUE,
        contact_name TEXT,
        contact_email TEXT,
        contact1_name TEXT,
        contact1_email_1 TEXT,
        contact2_name TEXT,
        contact2_email_1 TEXT,
        contact3_name TEXT,
        contact3_email_1 TEXT,
        mls_curr_list_agent_name TEXT,
        mls_curr_list_agent_email TEXT,
        property_address TEXT,
        property_city TEXT,
        property_state TEXT,
        property_postal_code TEXT,
        property_type TEXT,
        baths TEXT,
        beds TEXT,
        year_built TEXT,
        square_footage TEXT,
        wholesale_value INTEGER, -- Changed to INTEGER as per later request
        assessed_total NUMERIC,
        mls_curr_status TEXT,
        mls_curr_days_on_market TEXT,
        status TEXT DEFAULT 'NEW', -- e.g., NEW, CONTACTED, QUALIFIED, OFFER_SENT, CONVERTED, CLOSED_WON, CLOSED_LOST, ARCHIVED

        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    COMMENT ON TABLE public.normalized_leads IS 'Stores normalized lead data, ready for CRM operations.';
    COMMENT ON COLUMN public.normalized_leads.status IS 'Current status of the lead in the sales pipeline.';


    -- 2. Insert and transform data from the 'leads' (staging) table
    INSERT INTO public.normalized_leads (
        original_lead_id,
        user_id, -- Assuming the 'imported_by' field from staging is the target user_id

        contact1_name,
        contact1_email_1,
        contact2_name,
        contact2_email_1,
        contact3_name,
        contact3_email_1,
        mls_curr_list_agent_name,
        mls_curr_list_agent_email,

        property_address,
        property_city,
        property_state,
        property_postal_code,
        property_type,
        baths,
        beds,
        year_built,
        square_footage,
        wholesale_value,
        assessed_total,
        mls_curr_status,
        mls_curr_days_on_market,
        status -- Default is 'NEW'
    )
    SELECT
        staged.id AS original_lead_id,
        staged.imported_by AS user_id, -- Map imported_by to user_id

        staged.contact1_name,
        LOWER(staged.contact1_email_1),
        staged.contact2_name,
        LOWER(staged.contact2_email_1),
        staged.contact3_name,
        LOWER(staged.contact3_email_1),
        staged.mls_curr_list_agent_name,
        LOWER(staged.mls_curr_list_agent_email),

        staged.property_address,
        staged.property_city,
        staged.property_state,
        staged.property_zip, -- MAPPING staging.property_zip to normalized_leads.property_postal_code
        staged.property_type,
        staged.baths,
        staged.beds,
        staged.year_built,
        staged.square_footage,
        NULLIF(REPLACE(REPLACE(staged.wholesale_value, '$', ''), ',', ''), '')::INTEGER, -- Clean and cast to INTEGER
        NULLIF(REPLACE(REPLACE(staged.assessed_total, '$', ''), ',', ''), '')::NUMERIC,  -- Clean and cast
        staged.mls_curr_status,
        staged.mls_curr_days_on_market,
        'NEW' -- Default status
    FROM public.leads staged
    ON CONFLICT (original_lead_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        contact1_name = EXCLUDED.contact1_name,
        contact1_email_1 = EXCLUDED.contact1_email_1,
        contact2_name = EXCLUDED.contact2_name,
        contact2_email_1 = EXCLUDED.contact2_email_1,
        contact3_name = EXCLUDED.contact3_name,
        contact3_email_1 = EXCLUDED.contact3_email_1,
        mls_curr_list_agent_name = EXCLUDED.mls_curr_list_agent_name,
        mls_curr_list_agent_email = EXCLUDED.mls_curr_list_agent_email,
        property_address = EXCLUDED.property_address,
        property_city = EXCLUDED.property_city,
        property_state = EXCLUDED.property_state,
        property_postal_code = EXCLUDED.property_postal_code,
        property_type = EXCLUDED.property_type,
        baths = EXCLUDED.baths,
        beds = EXCLUDED.beds,
        year_built = EXCLUDED.year_built,
        square_footage = EXCLUDED.square_footage,
        wholesale_value = EXCLUDED.wholesale_value,
        assessed_total = EXCLUDED.assessed_total,
        mls_curr_status = EXCLUDED.mls_curr_status,
        mls_curr_days_on_market = EXCLUDED.mls_curr_days_on_market,
        status = EXCLUDED.status,
        updated_at = NOW();

    -- 3. Clear the staging table after successful normalization
    DELETE FROM public.leads WHERE true;

    -- 4. Add relevant indexes for the new schema
    ALTER TABLE public.normalized_leads OWNER TO postgres; -- Or your admin role
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.normalized_leads TO authenticated; -- Or specific app role

    CREATE INDEX IF NOT EXISTS idx_norm_leads_user_id ON public.normalized_leads(user_id);
    CREATE INDEX IF NOT EXISTS idx_norm_leads_status ON public.normalized_leads(status);
    CREATE INDEX IF NOT EXISTS idx_norm_leads_c1_email ON public.normalized_leads(contact1_email_1);
    CREATE INDEX IF NOT EXISTS idx_norm_leads_c2_email ON public.normalized_leads(contact2_email_1);
    CREATE INDEX IF NOT EXISTS idx_norm_leads_c3_email ON public.normalized_leads(contact3_email_1);
    CREATE INDEX IF NOT EXISTS idx_norm_leads_agent_email ON public.normalized_leads(mls_curr_list_agent_email);
    CREATE INDEX IF NOT EXISTS idx_norm_leads_prop_addr_full ON public.normalized_leads(property_address, property_city, property_state, property_postal_code);

    -- Apply 'update_updated_at_column' trigger
    CREATE TRIGGER set_normalized_leads_updated_at
    BEFORE UPDATE ON public.normalized_leads
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    -- RLS for normalized_leads
    ALTER TABLE public.normalized_leads ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Admin can manage their normalized_leads" ON public.normalized_leads;
    CREATE POLICY "Admin can manage their normalized_leads"
    ON public.normalized_leads FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

    RAISE NOTICE 'Normalization of staged leads complete. Staging table cleared. normalized_leads table created/updated.';

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error in normalize_staged_leads: %', SQLERRM;
END;
$$;


-- PART 2: CORE CRM TABLES

-- Table: CONTACTS
DROP TABLE IF EXISTS public.contacts CASCADE;
CREATE TABLE public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    normalized_lead_id UUID REFERENCES public.normalized_leads(id) ON DELETE CASCADE, -- Link to the lead/property
    name TEXT,
    email TEXT, -- Main email for the contact
    phone TEXT,
    role TEXT, -- e.g., 'Owner1', 'Owner2', 'Agent', 'Tenant', 'Spouse'
    is_primary_contact BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_contact_lead_email_role UNIQUE (normalized_lead_id, email, role) -- Ensures a unique contact role per email for a lead
);
COMMENT ON TABLE public.contacts IS 'Stores individual contact information associated with leads/properties.';

-- Table: DOCUMENT_TEMPLATES
DROP TABLE IF EXISTS public.document_templates CASCADE;
CREATE TABLE public.document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    content_json JSONB, -- For structured templates (e.g., for dynamic PDF generation)
    content_html TEXT,   -- For HTML based templates or email bodies
    template_type TEXT NOT NULL, -- e.g., 'OFFER_LETTER', 'PURCHASE_AGREEMENT', 'EMAIL_BODY'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.document_templates IS 'Stores various document and content templates.';

-- Table: EMAIL_TEMPLATES
DROP TABLE IF EXISTS public.email_templates CASCADE;
CREATE TABLE public.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    body_html TEXT,
    body_text TEXT, -- For plain text version
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.email_templates IS 'Stores templates for emails.';

-- Table: SENDERS (Email accounts used to send emails)
DROP TABLE IF EXISTS public.senders CASCADE;
CREATE TABLE public.senders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., "John Doe Acquisitions"
    email TEXT NOT NULL UNIQUE, -- The actual sending email address
    provider TEXT, -- e.g., 'GMAIL', 'OUTLOOK', 'SMTP'
    is_default BOOLEAN DEFAULT FALSE,
    credentials_json JSONB, -- Store OAuth tokens, API keys, SMTP credentials (encrypted or use Supabase Vault)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.senders IS 'Manages email sender identities and their credentials.';
COMMENT ON COLUMN public.senders.credentials_json IS 'Sensitive. Store encrypted or use Supabase Vault.';


-- PART 3: CAMPAIGN MANAGEMENT TABLES

-- Table: CAMPAIGNS
DROP TABLE IF EXISTS public.campaigns CASCADE;
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'DRAFT', -- DRAFT, ACTIVE, PAUSED, COMPLETED, ARCHIVED
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    target_audience_json JSONB, -- For defining filters if leads are dynamically added
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.campaigns IS 'Defines marketing or outreach campaigns.';

-- Table: CAMPAIGN_LEADS (Associates leads with campaigns)
DROP TABLE IF EXISTS public.campaign_leads CASCADE;
CREATE TABLE public.campaign_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    normalized_lead_id UUID NOT NULL REFERENCES public.normalized_leads(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'PENDING', -- PENDING, ACTIVE, COMPLETED, FAILED, SKIPPED (within this campaign)
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_processed_at TIMESTAMPTZ,
    current_action_id UUID, -- FK to campaign_actions, if applicable for state
    notes TEXT,
    UNIQUE (campaign_id, normalized_lead_id)
);
COMMENT ON TABLE public.campaign_leads IS 'Links leads to specific campaigns and tracks their status within that campaign.';

-- Table: CAMPAIGN_ACTIONS (Steps or sequences within a campaign)
DROP TABLE IF EXISTS public.campaign_actions CASCADE;
CREATE TABLE public.campaign_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    action_type TEXT NOT NULL, -- e.g., 'SEND_EMAIL', 'CREATE_TASK', 'WAIT', 'SEND_OFFER_EMAIL_SEQUENCE'
    sequence_order INT NOT NULL,
    email_template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
    document_template_id UUID REFERENCES public.document_templates(id) ON DELETE SET NULL, -- For actions generating documents
    delay_after_previous_seconds INT DEFAULT 0, -- Delay in seconds after the previous action
    details_json JSONB, -- For specific settings, e.g., task details, email variants
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (campaign_id, sequence_order)
);
COMMENT ON TABLE public.campaign_actions IS 'Defines individual actions or steps within a campaign sequence.';

-- Table: CAMPAIGN_USER_ALLOCATIONS
DROP TABLE IF EXISTS public.campaign_user_allocations CASCADE;
CREATE TABLE public.campaign_user_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assigning_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- The admin user who made the allocation
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    allocated_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Typically the admin themselves in a single-admin setup, but allows for future expansion
    sender_id UUID REFERENCES public.senders(id) ON DELETE SET NULL, -- Specific sender to use for this allocation if different from default
    allocated_count INT DEFAULT 0, -- Number of leads/tasks assigned
    processed_count INT DEFAULT 0, -- Number of leads/tasks processed
    allocation_type TEXT DEFAULT 'LEAD_PROCESSING', -- e.g., LEAD_PROCESSING, EMAIL_SENDING
    details_json JSONB, -- e.g., specific lead IDs, or criteria for dynamic allocation
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.campaign_user_allocations IS 'Manages allocation of campaign tasks/leads to users or senders.';

-- Table: CAMPAIGN_LOG
DROP TABLE IF EXISTS public.campaign_log CASCADE;
CREATE TABLE public.campaign_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    campaign_lead_id UUID REFERENCES public.campaign_leads(id) ON DELETE SET NULL,
    campaign_action_id UUID REFERENCES public.campaign_actions(id) ON DELETE SET NULL,
    allocation_id UUID REFERENCES public.campaign_user_allocations(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- e.g., 'EMAIL_SENT', 'TASK_CREATED', 'STATUS_UPDATED', 'ERROR', 'CAMPAIGN_STARTED', 'EMAIL_SEND_ATTEMPT'
    target_identifier TEXT, -- e.g., email address, task ID, lead ID
    status TEXT, -- e.g., 'SUCCESS', 'FAILURE', 'PENDING', 'INFO', 'WARNING'
    message TEXT, -- General log message
    details_json JSONB, -- For structured data like error messages, API responses, etc.
    external_message_id TEXT, -- Stores the unique ID from the external email service
    sender_id UUID REFERENCES public.senders(id) ON DELETE SET NULL, -- Stores the actual sender_id used for the communication
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- No updated_at here as logs are typically immutable.
);
COMMENT ON TABLE public.campaign_log IS 'Logs all actions, events, and errors related to campaign execution.';
COMMENT ON COLUMN public.campaign_log.external_message_id IS 'Unique message ID from the external email sending service (e.g., Mailgun, SendGrid). Used to correlate with email_events.';
COMMENT ON COLUMN public.campaign_log.sender_id IS 'The actual sender identity (from public.senders) used for this specific logged communication.';


-- PART 4: APPLICATION SETTINGS (User's enhanced version)
DROP TABLE IF EXISTS public.application_settings CASCADE;
CREATE TABLE public.application_settings (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    group_name TEXT DEFAULT 'General',
    is_sensitive BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.application_settings IS 'Stores application-wide configuration settings manageable by the admin.';
COMMENT ON COLUMN public.application_settings.key IS 'Unique key for the setting (e.g., GOOGLE_CLIENT_ID).';
COMMENT ON COLUMN public.application_settings.value IS 'Value of the setting. Sensitive values should be handled carefully.';
COMMENT ON COLUMN public.application_settings.group_name IS 'Helps categorize settings in the UI (e.g., Email, OAuth).';
COMMENT ON COLUMN public.application_settings.is_sensitive IS 'Indicates if the value is sensitive and should be masked or handled securely.';


-- PART 5: APP FEATURES SUPPORT TABLES (NOTIFICATIONS, TASKS, EMAIL EVENTS)

-- Table: NOTIFICATIONS
DROP TABLE IF EXISTS public.notifications CASCADE;
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- The user to whom the notification is addressed
    type TEXT NOT NULL, -- e.g., 'NEW_LEAD', 'TASK_DUE', 'CAMPAIGN_COMPLETED', 'SYSTEM_ALERT'
    title TEXT NOT NULL,
    message TEXT,
    link TEXT, -- Optional link to navigate to (e.g., /leads/uuid)
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW() -- To track when it was read or updated
);
COMMENT ON TABLE public.notifications IS 'Stores in-app notifications for the admin user.';

-- Table: TASKS
DROP TABLE IF EXISTS public.tasks CASCADE;
CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- User assigned to the task
    normalized_lead_id UUID REFERENCES public.normalized_leads(id) ON DELETE SET NULL,
    campaign_action_id UUID REFERENCES public.campaign_actions(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ,
    status TEXT DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, DEFERRED
    priority TEXT DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.tasks IS 'Manages tasks for follow-ups, reminders, etc.';

-- Table: EMAIL_EVENTS (For tracking webhook data from email providers)
DROP TABLE IF EXISTS public.email_events CASCADE;
CREATE TABLE public.email_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Admin user who owns the campaign/sender context
    campaign_log_id UUID REFERENCES public.campaign_log(id) ON DELETE SET NULL, -- Link back to the specific send log
    message_id TEXT, -- The unique ID from the email provider (corresponds to campaign_log.external_message_id)
    event_type TEXT NOT NULL, -- e.g., 'DELIVERED', 'BOUNCED', 'OPENED', 'CLICKED', 'COMPLAINED', 'UNSUBSCRIBED'
    recipient_email TEXT,
    sender_email TEXT,
    subject TEXT,
    event_timestamp TIMESTAMPTZ NOT NULL, -- Timestamp from the email provider
    details_json JSONB, -- Full webhook payload or relevant parts
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() -- When this record was created in our DB
    -- No updated_at here as these are event records.
);
COMMENT ON TABLE public.email_events IS 'Tracks email delivery events from webhook callbacks (e.g., Mailgun, SendGrid).';


-- PART 6: GENERATED DOCUMENTS TRACKING
DROP TABLE IF EXISTS public.generated_documents CASCADE;
CREATE TABLE public.generated_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    normalized_lead_id UUID REFERENCES public.normalized_leads(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    campaign_action_id UUID REFERENCES public.campaign_actions(id) ON DELETE SET NULL,
    document_template_id UUID REFERENCES public.document_templates(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL UNIQUE, -- Full path in Supabase storage, e.g., 'media/generated/offer_xyz.pdf'
    file_type TEXT, -- e.g., 'application/pdf'
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), metadata_json JSONB );
COMMENT ON TABLE public.generated_documents IS 'Tracks documents generated from templates and stored in Supabase Storage.';
COMMENT ON COLUMN public.generated_documents.storage_path IS 'Must be unique. Path to the file in a Supabase Storage bucket.';

-- PART 7: TRIGGERS, RLS, INDEXES FOR ALL TABLES (Consolidated)

-- Triggers for 'updated_at'
CREATE TRIGGER set_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_document_templates_updated_at BEFORE UPDATE ON public.document_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_senders_updated_at BEFORE UPDATE ON public.senders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- No updated_at for campaign_leads as it's more of an association status table, use last_processed_at.
-- If an updated_at is desired, add the column and trigger.

CREATE TRIGGER set_campaign_actions_updated_at BEFORE UPDATE ON public.campaign_actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_campaign_user_allocations_updated_at BEFORE UPDATE ON public.campaign_user_allocations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_application_settings_updated_at BEFORE UPDATE ON public.application_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_generated_documents_updated_at BEFORE UPDATE ON public.generated_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS for all user-data tables
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.senders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_user_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Assuming single admin model where auth.uid() is the admin's ID)
-- For multi-user, policies would need to be more complex (e.g., based on roles or explicit user_id checks).

DROP POLICY IF EXISTS "Admin can manage contacts" ON public.contacts;
CREATE POLICY "Admin can manage contacts" ON public.contacts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can manage document templates" ON public.document_templates;
CREATE POLICY "Admin can manage document templates" ON public.document_templates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can manage email templates" ON public.email_templates;
CREATE POLICY "Admin can manage email templates" ON public.email_templates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can manage senders" ON public.senders;
CREATE POLICY "Admin can manage senders" ON public.senders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can manage campaigns" ON public.campaigns;
CREATE POLICY "Admin can manage campaigns" ON public.campaigns FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can manage campaign_leads" ON public.campaign_leads;
CREATE POLICY "Admin can manage campaign_leads" ON public.campaign_leads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can manage campaign_actions" ON public.campaign_actions;
CREATE POLICY "Admin can manage campaign_actions" ON public.campaign_actions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can manage campaign_user_allocations" ON public.campaign_user_allocations;
CREATE POLICY "Admin can manage campaign_user_allocations" ON public.campaign_user_allocations FOR ALL USING (auth.uid() = assigning_user_id) WITH CHECK (auth.uid() = assigning_user_id);

DROP POLICY IF EXISTS "Admin can manage campaign_log" ON public.campaign_log;
CREATE POLICY "Admin can manage campaign_log" ON public.campaign_log FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policy for application_settings (as per user's update)
DROP POLICY IF EXISTS "Admin can manage application settings" ON public.application_settings;
CREATE POLICY "Admin can manage application settings" ON public.application_settings FOR ALL USING (auth.role() = 'authenticated') -- Assuming 'authenticated' role is the admin
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin can manage notifications" ON public.notifications;
CREATE POLICY "Admin can manage notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can manage tasks" ON public.tasks;
CREATE POLICY "Admin can manage tasks" ON public.tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can manage email_events" ON public.email_events;
CREATE POLICY "Admin can manage email_events" ON public.email_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can manage generated documents" ON public.generated_documents;
CREATE POLICY "Admin can manage generated documents" ON public.generated_documents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes for Performance
-- (Indexes for normalized_leads are created within its function)

-- contacts
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_normalized_lead_id ON public.contacts(normalized_lead_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);

-- document_templates
CREATE INDEX IF NOT EXISTS idx_document_templates_user_id ON public.document_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_template_type ON public.document_templates(template_type);

-- email_templates
CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON public.email_templates(user_id);

-- senders
CREATE INDEX IF NOT EXISTS idx_senders_user_id ON public.senders(user_id);
CREATE INDEX IF NOT EXISTS idx_senders_email ON public.senders(email);
CREATE UNIQUE INDEX IF NOT EXISTS uq_default_sender_per_user ON public.senders (user_id, is_default) WHERE (is_default = TRUE);

-- campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);

-- campaign_leads
CREATE INDEX IF NOT EXISTS idx_campaign_leads_user_id ON public.campaign_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_id ON public.campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_normalized_lead_id ON public.campaign_leads(normalized_lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_status ON public.campaign_leads(status);

-- campaign_actions
CREATE INDEX IF NOT EXISTS idx_campaign_actions_user_id ON public.campaign_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_actions_campaign_id ON public.campaign_actions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_actions_action_type ON public.campaign_actions(action_type);

-- campaign_user_allocations
CREATE INDEX IF NOT EXISTS idx_campaign_user_allocations_assigning_user_id ON public.campaign_user_allocations(assigning_user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_user_allocations_campaign_id ON public.campaign_user_allocations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_user_allocations_sender_id ON public.campaign_user_allocations(sender_id);

-- campaign_log
CREATE INDEX IF NOT EXISTS idx_campaign_log_user_id ON public.campaign_log(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_log_campaign_id ON public.campaign_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_log_campaign_lead_id ON public.campaign_log(campaign_lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_log_event_type ON public.campaign_log(event_type);
CREATE INDEX IF NOT EXISTS idx_campaign_log_logged_at ON public.campaign_log(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_log_external_message_id ON public.campaign_log(external_message_id);
CREATE INDEX IF NOT EXISTS idx_campaign_log_sender_id ON public.campaign_log(sender_id);

-- application_settings
CREATE INDEX IF NOT EXISTS idx_application_settings_key ON public.application_settings(key);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- tasks
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_normalized_lead_id ON public.tasks(normalized_lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);

-- email_events
CREATE INDEX IF NOT EXISTS idx_email_events_user_id ON public.email_events(user_id);
CREATE INDEX IF NOT EXISTS idx_email_events_message_id ON public.email_events(message_id);
CREATE INDEX IF NOT EXISTS idx_email_events_event_type ON public.email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_recipient_email ON public.email_events(recipient_email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_events_message_id_event_type_event_timestamp ON public.email_events(message_id, event_type, event_timestamp);

-- generated_documents
CREATE INDEX IF NOT EXISTS idx_generated_documents_user_id ON public.generated_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_normalized_lead_id ON public.generated_documents(normalized_lead_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_campaign_id ON public.generated_documents(campaign_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_document_template_id ON public.generated_documents(document_template_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_storage_path ON public.generated_documents(storage_path);

-- Final Grant (Ensure the application role can access necessary schemas and objects)
-- This might vary based on your exact Supabase setup and roles.
-- 'authenticated' is a common default role for logged-in users.
-- 'service_role' is typically for backend services.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres; -- Or your admin role
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated; -- Or your specific app role
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated; -- Or your specific app role
-- If you use sequences for SERIAL PKs and your app role needs to insert
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;