import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies as nextCookies } from 'next/headers';
import { Database } from '@/types_db';

// GET /api/engine/tasks?campaign_id=...&job_id=...&status=...
export async function GET(req: NextRequest) {
  const cookieStore = nextCookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value || '',
      },
    }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get('campaign_id');
  const jobId = searchParams.get('job_id');
  const status = searchParams.get('status');
  // Get campaign IDs owned by user
  const { data: campaigns, error: campErr } = await supabase.from('campaigns').select('id').eq('user_id', user.id);
  if (campErr) return NextResponse.json({ error: campErr.message }, { status: 500 });
  const campaignIds = (campaigns || []).map(c => c.id);
  // Get job IDs for those campaigns
  let jobQuery = supabase.from('campaign_jobs').select('id');
  if (campaignId) jobQuery = jobQuery.eq('campaign_id', campaignId);
  jobQuery = jobQuery.in('campaign_id', campaignIds);
  const { data: jobs, error: jobErr } = await jobQuery;
  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });
  const jobIds = (jobs || []).map(j => j.id);

  let query = supabase.from('email_tasks').select('*').order('created_at', { ascending: false });
  if (jobId) query = query.eq('campaign_job_id', jobId);
  if (status) query = query.eq('status', status);
  query = query.in('campaign_job_id', jobIds);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
