import { NextResponse } from 'next/server';

import { type Lead, prepareAndSendOfferEmail } from '@/actions/emailSending.action'; // Import Lead type
import { getAdminSupabaseClient } from '@/services/supabaseAdminService';

export const dynamic = 'force-dynamic';

// Helper to add logs (if you adapt the Dashboard's addLog or similar for server-side)
const addLog = (message: string, type: string = 'info') => console.log(`[Preflight API][${type.toUpperCase()}]: ${message}`);

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

      // 5. Send test email immediately
    const { prepareAndSendOfferEmail } = await import('@/actions/emailSending.action');
    
    // 6. Fetch Email Template based on campaign.email_template_id
    if (!campaign.email_template_id) {
      return new NextResponse(
        JSON.stringify({ error: 'Campaign does not have an email template assigned.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const { data: emailTemplate, error: emailTemplateError } = await supabase
      .from('email_templates')
      .select('subject, body')
      .eq('id', campaign.email_template_id)
      .single();

    if (emailTemplateError || !emailTemplate) {
      return new NextResponse(
        JSON.stringify({ error: 'Failed to fetch email template or template not found.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 7. Fetch Document Template based on campaign.document_template_id (if exists)
    let documentHtmlContent: string | undefined = undefined;
    if (campaign.document_template_id) {
      const { data: documentTemplate, error: documentTemplateError } = await supabase
        .from('document_templates')
        .select('content') // Assuming 'content' stores the HTML for the PDF
        .eq('id', campaign.document_template_id)
        .single();

      if (documentTemplateError) {
        // Log error but proceed, as document might be optional for some campaigns
        console.error('Error fetching document template:', documentTemplateError.message);
        addLog(`Warning: Could not fetch document template ID ${campaign.document_template_id}. Proceeding without PDF attachment.`, 'warning');
      } else if (documentTemplate) {
        documentHtmlContent = documentTemplate.content;
      }
    } else {
        addLog('No document template assigned to this campaign. Test email will not have a PDF attachment.', 'info');
    }

    // 8. Prepare lead data for the email
    // Ensure testLead is cast to the Lead type expected by prepareAndSendOfferEmail
    const leadDataForEmail: Lead = {
      id: testLead.id,
      contact1_name: testLead.contact1_name || 'Test Recipient',
      contact1_email_1: user.email, // For preflight, send to admin
      contact2_email_1: testLead.contact2_email_1,
      contact3_email_1: testLead.contact3_email_1,
      property_address: testLead.property_address || 'Test Property',
      wholesale_value: testLead.wholesale_value || 0,
      assessed_total: testLead.assessed_total || 0,
      mls_curr_list_agent_name: testLead.mls_curr_list_agent_name,
      mls_curr_list_agent_email: testLead.mls_curr_list_agent_email,
      // Include any other fields from testLead that are expected by the Lead type or templates
      ...(testLead as any) // Spread remaining properties, cast to any if necessary for safety
    };

    // 9. Prepare sender info
    const senderInfo = {
      fullName: sender.full_name,
      title: sender.title || 'Acquisitions Specialist',
      email: sender.email_address, // The actual sender email to impersonate
      // Add other sender fields if your templates use them, e.g., companyAddress, phone
      // companyAddress: sender.company_address || 'Default Company Address',
      // phone: sender.phone_number || 'Default Phone'
    };

    // 10. Send test email using actual templates
    const result = await prepareAndSendOfferEmail(
      leadDataForEmail,
      senderInfo,
{
  subject: emailTemplate.subject,
  body: emailTemplate.body,
  documentHtmlContent,  // Shorthand
  leadData: leadDataForEmail  // Keep this one as is since the variable name is different
}
    );

    if (!result.success) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Failed to send test email',
          details: result.error 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Log the successful test email task
    const { data: emailTask, error: taskError } = await supabase
      .from('email_tasks')
      .insert({
        campaign_id: campaignId,
        lead_id: testLead.id,
        recipient_email: user.email,
        status: 'sent',
        sender_id: sender.id,
        is_test: true,
        subject: `[TEST] ${campaign.email_subject || 'Test Email'}`,
        body: campaign.email_body || '',
        sent_at: new Date().toISOString(),
        metadata: {
          is_preflight: true,
          admin_email: user.email,
          timestamp: new Date().toISOString(),
          gmail_message_id: result.messageId || null
        }
      })
      .select()
      .single();

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
