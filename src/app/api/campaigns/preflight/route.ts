import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { prepareAndSendOfferEmail, Lead } from '@/actions/emailSending.action'; // Imported Lead interface
import { createAdminServerClient } from '@/lib/supabase/server';
import { Database } from '@/types/supabase';

// Removed local Lead type alias: type Lead = Database['public']['Tables']['normalized_leads']['Row'];

export const dynamic = 'force-dynamic';

// Helper to add logs
// Helper function to add logs with consistent formatting
const addLog = (message: string, level: 'info' | 'error' | 'warning' = 'info') => {
  console.log(`[CampaignPreflight:${level.toUpperCase()}] ${message}`);
  // In a real scenario, you might send these logs to a logging service
};

// Type alias for sender row from Supabase schema
type SenderRow = Database['public']['Tables']['senders']['Row'];

export async function POST(request: Request) {
  // Initialize Supabase client inside the function
  const supabase = await createAdminServerClient();
  
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
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.email || !session.user.id) {
      return new NextResponse(
        JSON.stringify({ error: 'Could not get admin user details. Please sign in again.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const adminEmail = session.user.email;

    // 3. Get a test lead with a valid email from the campaign's target market region
    if (!campaign.target_market_region) {
      return new NextResponse(
        JSON.stringify({ error: 'Campaign is missing a target market region' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // First, try to find a lead with contact1_email_1 (most common case)
    let { data: testLeadData, error: leadError } = await supabase
      .from('normalized_leads')
      .select('*')
      .eq('market_region', campaign.target_market_region)
      .not('contact1_email_1', 'is', null)
      .not('contact1_email_1', 'eq', '')
      .limit(1)
      .single();

    // If no lead with contact1_email_1, try contact2_email_1
    if (leadError || !testLeadData) {
      ({ data: testLeadData, error: leadError } = await supabase
        .from('normalized_leads')
        .select('*')
        .eq('market_region', campaign.target_market_region)
        .not('contact2_email_1', 'is', null)
        .not('contact2_email_1', 'eq', '')
        .limit(1)
        .single());
    }

    // If still no lead, try contact3_email_1
    if (leadError || !testLeadData) {
      ({ data: testLeadData, error: leadError } = await supabase
        .from('normalized_leads')
        .select('*')
        .eq('market_region', campaign.target_market_region)
        .not('contact3_email_1', 'is', null)
        .not('contact3_email_1', 'eq', '')
        .limit(1)
        .single());
    }

    // If still no lead, try mls_curr_list_agent_email
    if (leadError || !testLeadData) {
      ({ data: testLeadData, error: leadError } = await supabase
        .from('normalized_leads')
        .select('*')
        .eq('market_region', campaign.target_market_region)
        .not('mls_curr_list_agent_email', 'is', null)
        .not('mls_curr_list_agent_email', 'eq', '')
        .limit(1)
        .single());
    }

    if (leadError || !testLeadData) {
      return new NextResponse(
        JSON.stringify({ 
          error: `No leads with valid email addresses found in market region: ${campaign.target_market_region}`,
          marketRegion: campaign.target_market_region,
          details: 'The system looks for leads with any of these email fields populated: contact1_email_1, contact2_email_1, contact3_email_1, or mls_curr_list_agent_email'
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Create a copy of the test lead and update the email
    const testLead = { ...testLeadData, email: adminEmail };

    // 4. Get an active sender allocated to this campaign
    const { data: allocatedSenderData, error: allocationError } = await supabase
      .from('campaign_sender_allocations')
      .select(`
        senders (
          id,
          email,
          name,
          is_active,
          avatar_url,
          credentials_json,
          provider
        )
      `)
      .eq('campaign_id', campaignId)
      .order('name', { foreignTable: 'senders', ascending: true })
      .limit(1); // Get the alphabetically first allocated active sender

    if (allocationError) {
      addLog(`Error fetching sender allocations: ${allocationError.message}`, 'error');
      return new NextResponse(
        JSON.stringify({ error: 'Error fetching sender allocations for campaign.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // allocatedSenderData is of type ({ senders: SenderRow | null }[] | null)
    let sender: SenderRow;

    const activeAllocatedSender = allocatedSenderData?.find(
      (alloc): alloc is { senders: SenderRow } => 
        alloc?.senders?.is_active !== false
    )?.senders;

    if (activeAllocatedSender) {
      sender = activeAllocatedSender;
      addLog(`Using existing active allocated sender ID: ${sender.id} (${sender.email}) for pre-flight test.`);
    } else {
      addLog(`No active sender currently allocated for campaign ID: ${campaignId}. Attempting to allocate a default sender.`, 'warning');

      const { data: availableActiveSenders, error: activeSendersError } = await supabase
        .from('senders')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(1);

      if (activeSendersError) {
        addLog(`Error fetching available active senders: ${activeSendersError.message}`, 'error');
        return new NextResponse(JSON.stringify({ error: 'Could not fetch available senders to create default allocation.' }), { status: 500 });
      }

      if (!availableActiveSenders || availableActiveSenders.length === 0) {
        addLog('No active senders available in the system to create a default allocation.', 'error');
        return new NextResponse(JSON.stringify({ error: 'No active senders in system to allocate.' }), { status: 400 });
      }

      const defaultSenderToAllocate = availableActiveSenders[0];
      const DEFAULT_DAILY_QUOTA = 50; // Define a default quota

      const newAllocation: Database['public']['Tables']['campaign_sender_allocations']['Insert'] = {
        campaign_id: campaignId,
        sender_id: defaultSenderToAllocate.id,
        daily_quota: DEFAULT_DAILY_QUOTA,
        sent_today: 0,
        total_sent: 0,
      };

      const { error: insertError } = await supabase
        .from('campaign_sender_allocations')
        .insert(newAllocation);

      if (insertError) {
        addLog(`Failed to insert default sender allocation: ${insertError.message}`, 'error');
        return new NextResponse(JSON.stringify({ error: 'Failed to create default sender allocation.' }), { status: 500 });
      }

      sender = defaultSenderToAllocate; // Use the newly allocated sender
      addLog(`Successfully allocated sender ID: ${sender.id} (${sender.email}) with quota ${DEFAULT_DAILY_QUOTA} as default for campaign ID: ${campaignId}.`);
    }

    // sender.id and sender.email are non-nullable strings as per SenderRow type
    const logMessage: string = `Using sender ID: ${sender.id} (${sender.email}) for pre-flight test.`;
    addLog(logMessage); // level defaults to 'info'

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

    // 7. Fetch Document Template based on campaign.pdf_template_id (if exists)
    let documentHtmlContent: string | undefined = undefined;
    const documentTemplateId = campaign.pdf_template_id; // Use pdf_template_id from campaign
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
        documentHtmlContent = documentTemplate.content ?? undefined;
      }
    } else {
        addLog('No document template assigned to this campaign. Test email will not have a PDF attachment.', 'info');
    }

    // 8. Prepare lead data for the email
    // Ensure testLeadData's nullable string properties are converted to undefined for the Lead interface.
    const leadDataForEmail: Lead = {
      id: testLeadData.id, // Assuming testLeadData.id is a non-null number after successful fetch
      contact1_name: testLeadData.contact1_name ?? undefined,
      contact1_email_1: adminEmail, // adminEmail is string, compatible with string | undefined
      contact2_name: testLeadData.contact2_name ?? undefined,
      contact2_email_1: testLeadData.contact2_email_1 ?? undefined,
      contact3_name: testLeadData.contact3_name ?? undefined,
      contact3_email_1: testLeadData.contact3_email_1 ?? undefined,
      property_address: testLeadData.property_address ?? undefined,
      wholesale_value: testLeadData.wholesale_value ?? null,
      assessed_total: testLeadData.assessed_total ?? null,
      mls_curr_list_agent_name: testLeadData.mls_curr_list_agent_name ?? undefined,
      mls_curr_list_agent_email: testLeadData.mls_curr_list_agent_email ?? undefined,

      // Fields for [key: string]: any, mapped from testLeadData
      // Ensure correct null to undefined conversion if template expects undefined for empty/null strings
      property_city: testLeadData.property_city ?? undefined,
      property_state: testLeadData.property_state ?? undefined,
      market_region: testLeadData.market_region ?? undefined,
      // avm_value: if testLeadData.avm_value is number | null, and 'any' can take it.
      // If it must be number or undefined for template, then more specific mapping is needed.
      // Assuming testLeadData.avm_value can be passed as is if it's number | null for 'any'.
      // Or, to be safe and align with string optional fields:
      avm_value: typeof testLeadData.avm_value === 'number' ? testLeadData.avm_value : null,
      // Other fields like property_zip_code, sq_ft, etc., are omitted as they previously caused 'property does not exist' errors
      // or are not explicitly part of the Lead interface and their existence on testLeadData is unconfirmed for this mapping.
    };

    // 9. Prepare sender info
    const senderInfo = {
      fullName: sender.name, // Changed from full_name to name
      title: 'Acquisitions Specialist', // Removed sender.title as it doesn't exist
      email: sender.email, // Changed from email_address to email
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
        body: emailTemplate.body_html || emailTemplate.body_text || '',
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
        assigned_sender_id: sender.id,
        contact_email: adminEmail,
        status: 'sent',
        is_test: true,
        subject: `[TEST] ${emailTemplate?.subject || 'Test Email'}`,
        body: emailTemplate?.body_html || emailTemplate?.body_text || '',
        sent_at: new Date().toISOString(),
        attachments: JSON.stringify({
          is_preflight: true,
          admin_email: adminEmail,
          timestamp: new Date().toISOString(),
          gmail_message_id: result.messageId ?? undefined,
          gmail_thread_id: result.threadId ?? undefined
        }),
        campaign_job_id: `preflight-${Date.now()}`,
        // Add any other required fields for your email_tasks table
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
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
        test_lead_id: testLead.id ?? undefined,
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
