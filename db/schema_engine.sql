-- DDL scripts for Next.js CRM engine schema

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for impersonation
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Templates table (email/pdf)
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'email' or 'pdf'
  subject TEXT,
  content TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  template_id UUID NOT NULL REFERENCES templates(id),
  pdf_template_id UUID REFERENCES templates(id),
  status TEXT NOT NULL DEFAULT 'PENDING',
  market_region TEXT,
  quota INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User allocations per campaign
CREATE TABLE IF NOT EXISTS campaign_user_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  daily_quota INTEGER NOT NULL DEFAULT 0,
  sent_today INTEGER NOT NULL DEFAULT 0,
  total_sent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campaign processing jobs
CREATE TABLE IF NOT EXISTS campaign_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id BIGINT NOT NULL REFERENCES normalized_leads(id),
  status TEXT NOT NULL DEFAULT 'PENDING',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual email tasks
CREATE TABLE IF NOT EXISTS email_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_job_id UUID NOT NULL REFERENCES campaign_jobs(id) ON DELETE CASCADE,
  assigned_user_id UUID NOT NULL REFERENCES users(id),
  contact_email TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  pdf_template_id UUID REFERENCES templates(id),
  pdf_generated BOOLEAN NOT NULL DEFAULT false,
  attachments JSONB,
  status TEXT NOT NULL DEFAULT 'DRAFTING',
  gmail_message_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System event logs
CREATE TABLE IF NOT EXISTS system_event_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  details JSONB,
  related_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_campaign_status ON campaign_jobs(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_email_tasks_user_status ON email_tasks(assigned_user_id, status);

-- Daily quota reset
CREATE EXTENSION IF NOT EXISTS pg_cron;  
CREATE OR REPLACE FUNCTION public.reset_daily_quota()  
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE campaign_user_allocations SET sent_today = 0;
END;
$$;  

-- Schedule to run at midnight UTC daily
SELECT cron.schedule('reset_daily_quota', '0 0 * * *', 'SELECT public.reset_daily_quota();');
