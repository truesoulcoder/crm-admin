import { NextResponse } from 'next/server';

import { getAdminSupabaseClient } from '@/services/supabaseAdminService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { campaignId } = await request.json();
    
    if (!campaignId) {
      return new NextResponse(
        JSON.stringify({ error: 'Campaign ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getAdminSupabaseClient();
    
    // 1. Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return new NextResponse(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get admin user's email for test email
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user?.email) {
      return new NextResponse(
        JSON.stringify({ error: 'Could not get admin user details' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Get a test lead
    const { data: testLead, error: leadError } = await supabase
      .from('normalized_leads')
      .select('*')
      .eq('campaign_id', campaignId)
      .limit(1)
      .single();

    if (leadError || !testLead) {
      return new NextResponse(
        JSON.stringify({ error: 'No leads found for this campaign' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Get sender details
    const { data: sender, error: senderError } = await supabase
      .from('senders')
      .select('*')
      .eq('id', campaign.sender_id)
      .single();

    if (senderError || !sender) {
      return new NextResponse(
        JSON.stringify({ error: 'Sender not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Create a test email task
    const { data: emailTask, error: taskError } = await supabase
      .from('email_tasks')
      .insert({
        campaign_id: campaignId,
        lead_id: testLead.id,
        recipient_email: user.email, // Send test email to the admin
        status: 'queued',
        sender_id: sender.id,
        is_test: true,
        subject: `[TEST] ${campaign.email_subject || 'Test Email'}`,
        body: campaign.email_body || '',
        metadata: {
          is_preflight: true,
          admin_email: user.email,
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (taskError || !emailTask) {
      return new NextResponse(
        JSON.stringify({ error: 'Failed to create test email task' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Log the pre-flight check
    await supabase.from('system_events').insert({
      event_type: 'INFO',
      message: 'Pre-flight check initiated',
      details: {
        campaign_id: campaignId,
        admin_email: user.email,
        email_task_id: emailTask.id
      },
      campaign_id: campaignId,
      created_by: user.id
    });

    return new NextResponse(
      JSON.stringify({ 
        success: true, 
        message: 'Pre-flight check initiated. Test email will be sent shortly.' 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in pre-flight check:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
