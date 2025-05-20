import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { prepareAndSendOfferEmail } from '@/actions/emailSending.action';
import { createAdminServerClient } from '@/lib/supabase/server';
import { Database } from '@/types/supabase';

type Lead = Database['public']['Tables']['normalized_leads']['Row'];

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

    // 1. Get campaign details with type assertion for sender_id
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', String(campaignId))
      .single();

    if (campaignError || !campaign) {
      return new NextResponse(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get admin user's email from session
    const supabase = await createAdminServerClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.email || !session.user.id) {
      return new NextResponse(
        JSON.stringify({ error: 'Could not get admin user details. Please sign in again.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const adminEmail = session.user.email;

    // 3. Get a test lead with proper type assertion for campaign_id
    const { data: testLeadData, error: leadError } = await supabase
      .from('normalized_leads')
      .select('*')
      .eq('campaign_id', String(campaignId))
      .limit(1)
      .single();

    if (leadError || !testLeadData) {
      return new NextResponse(
        JSON.stringify({ error: 'No leads found for this campaign' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Create a copy of the test lead and update the email
    const testLead = { ...testLeadData, email: adminEmail };

    // 4. Get sender details with proper type assertions
    interface CampaignWithSender extends Record<string, unknown> {
      sender_id?: string;
      document_template_id?: string;
    }
    
    const campaignWithSender = campaign as CampaignWithSender;
    const senderId = campaignWithSender.sender_id;
    if (!senderId) {
      return new NextResponse(
        JSON.stringify({ error: 'Campaign is missing sender ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const { data: sender, error: senderError } = await supabase
      .from('senders')
      .select('*')
      .eq('id', senderId)
      .single();

    if (senderError || !sender) {
      return new NextResponse(
        JSON.stringify({ error: 'Sender not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

      // 5. Send test email immediately
    const { prepareAndSendOfferEmail } = await import('@/actions/emailSending.action');
    
    // Update the lead's email to the admin's email for testing
    testLead.email = adminEmail;
    
    // 6. Fetch Email Template based on campaign.email_template_id
    if (!campaign.email_template_id) {
      return new NextResponse(
        JSON.stringify({ error: 'Campaign does not have an email template assigned.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const { data: emailTemplate, error: emailTemplateError } = await supabase
      .from('email_templates')
      .select('*')
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
    const documentTemplateId = campaignWithSender.document_template_id;
    if (documentTemplateId) {
      const { data: documentTemplate, error: documentTemplateError } = await supabase
        .from('document_templates')
        .select('content') // Assuming 'content' stores the HTML for the PDF
        .eq('id', documentTemplateId)
        .single();

      if (documentTemplateError) {
        // Log error but proceed, as document might be optional for some campaigns
        console.error('Error fetching document template:', documentTemplateError.message);
        addLog(`Warning: Could not fetch document template ID ${documentTemplateId}. Proceeding without PDF attachment.`, 'warning');
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
      contact1_name: testLead.contact1_name ?? 'Test Recipient',
      contact1_email_1: adminEmail, // For preflight, send to admin
      contact2_email_1: testLead.contact2_email_1 ?? null,
      contact2_name: testLead.contact2_name ?? null,
      contact3_email_1: testLead.contact3_email_1 ?? null,
      contact3_name: testLead.contact3_name ?? null,
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
        recipient_email: adminEmail,
        status: 'sent',
        sender_id: sender.id,
        is_test: true,
        subject: `[TEST] ${emailTemplate?.subject || 'Test Email'}`,
        body: emailTemplate?.body_html || emailTemplate?.body_text || '',
        sent_at: new Date().toISOString(),
        metadata: {
          is_preflight: true,
          admin_email: adminEmail,
          timestamp: new Date().toISOString(),
          gmail_message_id: result.messageId || null
        }
      })
      .select()
      .single();

    // 6. Log the pre-flight check to campaign_log instead of system_events
    const logEntry = {
      campaign_id: campaignId,
      event_type: 'preflight_check',
      status: 'success',
      message: 'Preflight check completed successfully',
      details: JSON.stringify({
        admin_email: adminEmail,
        test_lead_id: testLead.id,
        sender_id: sender.id,
        timestamp: new Date().toISOString()
      }),
      user_id: session.user.id // Add the user ID from the session
    };
    
    const { error: logError } = await supabase
      .from('campaign_log')
      .insert([logEntry]); // Wrap in array to match expected type

    if (logError) {
      console.error('Error logging preflight check:', logError);
    }

    return new NextResponse(
      JSON.stringify({ 
        success: true, 
        message: 'Pre-flight check initiated. Test email will be sent shortly.' 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Preflight check failed:', error);
    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
