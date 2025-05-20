-- Insert test campaign data
INSERT INTO public.campaigns (
  id, 
  name, 
  description, 
  status, 
  market_region, 
  created_by,
  start_date,
  end_date,
  is_active,
  settings
) VALUES (
  '3b124270-7704-43f5-8db1-5138612bcc25',
  'Q2 2025 Marketing Campaign',
  'Spring marketing campaign targeting new leads',
  'active',
  'Austin, TX',
  (SELECT id FROM auth.users WHERE email = 'chrisphillips@truesoulpartners.com' LIMIT 1),
  NOW() - INTERVAL '1 day',
  NOW() + INTERVAL '30 days',
  true,
  '{"dailyLimit": 100, "timezone": "America/Chicago"}'
) ON CONFLICT (id) DO NOTHING;

-- Insert another test campaign
INSERT INTO public.campaigns (
  id, 
  name, 
  description, 
  status, 
  market_region, 
  created_by,
  start_date,
  end_date,
  is_active,
  settings
) VALUES (
  '4c235380-8815-54f6-9ec2-6249722cbd36',
  'Q3 2025 Follow-up',
  'Follow-up campaign for warm leads',
  'draft',
  'Dallas, TX',
  (SELECT id FROM auth.users WHERE email = 'chrisphillips@truesoulpartners.com' LIMIT 1),
  NOW() + INTERVAL '60 days',
  NOW() + INTERVAL '90 days',
  false,
  '{"dailyLimit": 150, "timezone": "America/Chicago"}'
) ON CONFLICT (id) DO NOTHING;
