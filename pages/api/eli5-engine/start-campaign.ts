import path from 'path';

import { SupabaseClient } from '@supabase/supabase-js';
import { configure as nunjucksConfigure, renderString as nunjucksRenderString } from 'nunjucks';

import { generateLoiPdf } from './_pdfUtils';
import { getGmailService, getSupabaseClient, isValidEmail } from './_utils';
import { sendConfiguredEmail, type EmailConfig } from './send-email';

import type { Tables, Json } from '@/types/db_types'; 
import type { NextApiRequest, NextApiResponse } from 'next'; 

// Define a type for the log entry for cleaner code, matching eli5_email_log structure
// Interface for individual contacts within lead.contacts JSON
interface LeadContact {
  email: string;
  name?: string;
  is_primary?: boolean;
  // Allow other properties as contacts can have varied structure
  [key: string]: any;
}

interface Eli5EmailLogEntry {
  id?: number; 
  original_lead_id?: string;
  contact_name?: string;
  contact_email?: string;
  sender_name?: string;
  sender_email_used?: string;
  email_subject_sent?: string;
  email_body_preview_sent?: string;
  email_status?: string; 
  email_error_message?: string | null;
  email_sent_at?: string | null; 
  campaign_id?: string;
  campaign_run_id?: string;
  created_at?: string; 
  is_converted_status_updated_by_webhook?: boolean | null;
  [key: string]: any; 
}

const templateDir = path.join(process.cwd(), 'pages', 'api', 'eli5-engine', 'templates');
nunjucksConfigure(templateDir, { autoescape: true });

// Sender management: File-level state for senders is removed. Senders are fetched and managed within the handler.

// Type for managing sender state during a campaign run
interface SenderState {
  id: string;
  name: string;
  email: string;
  daily_limit: number;
  in_memory_sent_today: number; // Tracks sends during this specific run, initialized from DB
  can_send_after_timestamp: number; // Timestamp (ms) when this sender can send next
}

// Function to fetch senders from DB, sort them, and prepare them for campaign use
async function fetchAndPrepareSenders(supabase: SupabaseClient, filter_sender_ids?: string[]): Promise<SenderState[]> {
  try {
    let query = supabase
      .from('senders')
      .select('id, name, email, daily_limit, sent_today')
      .eq('is_active', true)
      .order('email', { ascending: true }) // Primary sort: Alphabetical by email
      .order('sent_today', { ascending: true }); // Secondary sort: Least used today

    if (filter_sender_ids && filter_sender_ids.length > 0) {
      query = query.in('id', filter_sender_ids);
      console.log(`Filtering senders by IDs: ${filter_sender_ids.join(', ')}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('CAMPAIGN_HANDLER (fetchAndPrepareSenders): Error fetching senders from DB:', error.message);
      return [];
    }
    if (!data) {
      console.log('CAMPAIGN_HANDLER (fetchAndPrepareSenders): No sender data returned from DB query.');
      return [];
    }

    console.log(`CAMPAIGN_HANDLER (fetchAndPrepareSenders): ${data.length} active senders fetched from DB.`);
    
    const preparedSenders: SenderState[] = data.map(dbSender => ({
      id: dbSender.id,
      name: dbSender.name,
      email: dbSender.email,
      daily_limit: dbSender.daily_limit,
      in_memory_sent_today: dbSender.sent_today, // Initialize with current count from DB
      can_send_after_timestamp: 0, // Can send immediately if not over quota (Date.now() will be >= 0)
    }));

    console.log(`CAMPAIGN_HANDLER (fetchAndPrepareSenders): ${preparedSenders.length} senders prepared with initial state.`);
    return preparedSenders;
  } catch (e: unknown) {
    let errorMessage = 'Unknown error fetching senders';
    let errorStack: string | undefined;
    if (e instanceof Error) {
      errorMessage = e.message;
      errorStack = e.stack;
    } else if (typeof e === 'string') {
      errorMessage = e;
    }
    console.error('CAMPAIGN_HANDLER (fetchAndPrepareSenders): Exception:', errorMessage, errorStack);
    return [];
  }
}

// Function to increment the sent count for a sender
async function incrementSenderSentCount(supabase: SupabaseClient, senderId: string) {
  try {
    const { error } = await supabase.rpc('increment_sender_sent_count', {
      sender_id: senderId
    });

    if (error) {
      console.error('Error incrementing sender sent count:', error);
    }
  } catch (e: unknown) {
    let errorMessage = 'Unknown error incrementing sender sent count';
    let errorStack: string | undefined;
    if (e instanceof Error) {
      errorMessage = e.message;
      errorStack = e.stack;
    } else if (typeof e === 'string') {
      errorMessage = e;
    }
    console.error('Error in incrementSenderSentCount:', errorMessage, errorStack);
  }
}

async function logInitialAttempt(
  supabase: SupabaseClient,
  logData: Partial<Eli5EmailLogEntry>
): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('eli5_email_log')
      .insert({ ...logData, email_status: logData.email_status || 'PENDING_PROCESSING' }) // Default if not provided
      .select('id')
      .single();

    if (error) {
      console.error('Failed to log initial attempt to Supabase:', error.message);
      return null; // Resolve with null on Supabase error
    }
    // Ensure data and data.id exist and data.id is a number
    if (data && typeof data.id === 'number') {
      return data.id;
    } else {
      console.error('Failed to log initial attempt to Supabase: No valid ID returned from data:', data);
      return null; // Resolve with null if ID is not valid or data is null
    }
  } catch (e: unknown) {
    let errorMessage = 'Unknown error in logInitialAttempt';
    let errorStack: string | undefined;
    if (e instanceof Error) {
      errorMessage = e.message;
      errorStack = e.stack;
    } else if (typeof e === 'string') {
      errorMessage = e;
    }
    // Avoid logging full stack in prod for sensitive info or brevity, consider structured logging
    console.error('Error in logInitialAttempt:', errorMessage, errorStack ? errorStack.substring(0, 300) : ''); 
    return null; // Resolve with null on caught exception
  }
}

async function updateEmailLogStatus(
  supabase: SupabaseClient,
  logId: number,
  status: string,
  sentAt: string | null = null,
  errorMessage: string | null = null,
  isConvertedStatus: boolean | null = null
): Promise<void> {
  const updateData: Partial<Eli5EmailLogEntry> = {
    email_status: status,
    email_sent_at: sentAt,
    email_error_message: errorMessage,
  };
  if (isConvertedStatus !== null) {
    updateData.is_converted_status_updated_by_webhook = isConvertedStatus;
  }

  try {
    const { error } = await supabase
      .from('eli5_email_log')
      .update(updateData)
      .eq('id', logId);

    if (error) {
      console.error(`Failed to update email log status for log ID ${logId}:`, error);
    }
  } catch (e: unknown) {
    let errorMessage = `Unknown error in updateEmailLogStatus for log ID ${logId}`;
    let errorStack: string | undefined;
    if (e instanceof Error) {
      errorMessage = e.message;
      errorStack = e.stack;
    } else if (typeof e === 'string') {
      errorMessage = e;
    }
    console.error(`Error in updateEmailLogStatus for log ID ${logId}:`, errorMessage, errorStack);
  }
}

// Helper types for fetched data
type FetchedEmailTemplate = Pick<Tables<'email_templates'>, 'subject' | 'body_html' | 'body_text' | 'placeholders'>;
type FetchedDocumentTemplate = Pick<Tables<'document_templates'>, 'name' | 'content' | 'type' | 'available_placeholders'>;

interface FetchedCampaignDetails extends Pick<Tables<'campaigns'>, 'name' | 'email_template_id' | 'document_template_id'> {
  email_templates: FetchedEmailTemplate[] | null;
  document_templates: FetchedDocumentTemplate[] | null;
}

interface StartCampaignRequestBody {
  campaign_id: string;
  campaign_run_id?: string;
  market_region?: string;
  selected_sender_ids?: string[];
  selected_lead_ids?: string[];
  dry_run?: boolean;
  dryRun?: boolean; // Alias for dry_run
  limit_per_run?: number;
}

export async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    let successCount = 0;
    let failureCount = 0;
    const processingErrors: Array<{error: string; timestamp: string; leadId?: string; contact_email?: string}> = [];
    let leads: any[] = []; // Should be properly typed from db_types

    // Get campaign details from request body
    const { campaign_id, campaign_run_id, market_region, selected_sender_ids, selected_lead_ids, dry_run, dryRun, limit_per_run = 100 } = req.body as StartCampaignRequestBody;

    const isDryRun = dry_run || dryRun; // Consolidate dry run flags

    if (!campaign_id) {
      return res.status(400).json({ success: false, message: 'Campaign ID is required.' });
    }

    // Ensure campaign_id and campaign_run_id are treated as strings
    const currentCampaignId = campaign_id as string;
    const currentCampaignRunId = campaign_run_id as string;

    console.log(`ELI5_CAMPAIGN_HANDLER: Received request to ${isDryRun ? 'DRY RUN' : 'START'} campaign (ID: ${currentCampaignId}, Run ID: ${currentCampaignRunId}) at ${new Date().toISOString()}`);
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const supabase = getSupabaseClient();

    // Fetch campaign details
    const { data: campaignDetails, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        name,
        email_template_id,
        document_template_id,
        email_templates(subject, body_html, body_text, placeholders),
        document_templates(name, content, type, available_placeholders)
      `)
      .eq('id', currentCampaignId)
      .single();

    if (campaignError || !campaignDetails) {
      console.error('ELI5_CAMPAIGN_HANDLER: Error fetching campaign details:', campaignError?.message || 'Campaign not found');
      return res.status(404).json({ success: false, message: 'Campaign not found or error fetching details.' });
    }

    const emailTemplate = campaignDetails.email_templates ? campaignDetails.email_templates[0] : undefined;
    const documentTemplate = campaignDetails.document_templates ? campaignDetails.document_templates[0] : undefined;

    if (!emailTemplate) {
      console.error('ELI5_CAMPAIGN_HANDLER: Email template not found for campaign:', currentCampaignId);
      return res.status(400).json({ success: false, message: 'Email template not found for this campaign.' });
    }

    // Fetch senders
    const allSenders = await fetchAndPrepareSenders(supabase, selected_sender_ids);

    if (allSenders.length === 0) {
      const errorMsg = 'No active senders available or matched the filter. Campaign cannot start.';
      console.warn(`ELI5_CAMPAIGN_HANDLER: ${errorMsg}`);
      processingErrors.push({ error: 'no_senders_available', timestamp: new Date().toISOString() });
      return res.status(400).json({
        success: false,
        message: errorMsg,
        processing_errors_details: processingErrors
      });
    }

    // Fetch Leads
    let leadsQuery;
    if (market_region) {
      leadsQuery = supabase.from('normalized_leads').select('*').eq('market_region', market_region).limit(limit_per_run);
    } else if (selected_lead_ids && selected_lead_ids.length > 0) {
      leadsQuery = supabase.from('normalized_leads').select('*').in('id', selected_lead_ids).limit(limit_per_run);
    } else {
      const criticalErrorMsg = 'Critical logic error: Neither market_region nor selected_lead_ids provided for lead fetching.';
      console.error(`ELI5_CAMPAIGN_HANDLER: ${criticalErrorMsg}`);
      processingErrors.push({ error: 'internal_logic_error', timestamp: new Date().toISOString() });
      return res.status(500).json({
        success: false,
        message: criticalErrorMsg,
        processing_errors_details: processingErrors
      });
    }

    const { data: rawLeads, error: leadsError } = await leadsQuery;
    leads = rawLeads as any[]; // Temporary any type - should be properly typed

    if (leadsError) {
      console.error('ELI5_CAMPAIGN_HANDLER: Error fetching leads:', leadsError.message);
      processingErrors.push({ error: 'leads_fetch_failed', timestamp: new Date().toISOString() });
      return res.status(500).json({
          success: false,
          message: 'Error fetching leads.',
          error: leadsError.message,
          processing_errors_details: processingErrors
      });
    }

    if (!leads || leads.length === 0) {
      const noLeadsMsg = 'No leads found for the specified criteria.';
      console.log(`ELI5_CAMPAIGN_HANDLER: ${noLeadsMsg}`);
      return res.status(200).json({
        success: true,
        message: noLeadsMsg,
        campaign_id: currentCampaignId,
        campaign_run_id: currentCampaignRunId,
        summary: {
          total_leads_processed_in_batch: 0,
          emails_sent_successfully: 0,
          emails_failed_to_send: 0,
          processing_errors_details: []
        }
      });
    }

    // Main processing loop for leads
    for (const lead of leads) {
      const leadId = String(lead.id);
      // Determine primary contact from lead fields
      let contactEmail: string | null = null;
      let contactName: string | null = null;

      if (lead.contact1_email_1 && isValidEmail(lead.contact1_email_1)) {
        contactEmail = lead.contact1_email_1;
        contactName = lead.contact1_name || 'Valued Prospect';
      } else if (lead.contact2_email_1 && isValidEmail(lead.contact2_email_1)) {
        contactEmail = lead.contact2_email_1;
        contactName = lead.contact2_name || 'Valued Prospect';
      } else if (lead.contact3_email_1 && isValidEmail(lead.contact3_email_1)) {
        contactEmail = lead.contact3_email_1;
        contactName = lead.contact3_name || 'Valued Prospect';
      }

      let logId: number | null = null; // Will be set to a number if lead processing proceeds
      const noContactError = 'No valid primary contact email found for lead.';
      let senderAssignedAndEmailProcessed = false;

      if (!contactEmail) {
        console.log(`ELI5_CAMPAIGN_HANDLER: Lead ID ${leadId}: ${noContactError}`);
        try {
          logId = await logInitialAttempt(supabase, {
            original_lead_id: leadId as string,
            contact_email: contactEmail || 'N/A',
            campaign_id: currentCampaignId,
            campaign_run_id: currentCampaignRunId,
            email_status: 'FAILED_NO_CONTACT',
            email_error_message: noContactError
          });
        } catch (e: unknown) {
          let detailMessage = 'Unknown error during FAILED_NO_CONTACT logging.';
          if (e instanceof Error) detailMessage = e.message;
          else if (typeof e === 'string') detailMessage = e;
          console.error(`ELI5_CAMPAIGN_HANDLER: Logging failure for FAILED_NO_CONTACT on lead ${leadId}: ${detailMessage}`);
          processingErrors.push({ leadId, error: 'logging_failed', contact_email: 'N/A', timestamp: new Date().toISOString() });
        }
        failureCount++;
        processingErrors.push({ leadId, error: 'no_valid_contact', contact_email: 'N/A', timestamp: new Date().toISOString() });
        continue; // Next lead
      }

      // If we're here, contactEmail is valid. Now, establish a logId for this lead.
      try {
        logId = await logInitialAttempt(supabase, {
          original_lead_id: leadId as string,
          contact_name: contactName || '',
          contact_email: contactEmail,
          campaign_id: currentCampaignId,
          campaign_run_id: currentCampaignRunId,
          email_status: 'PENDING_PROCESSING'
        });

        if (logId === null) {
          console.error(`ELI5_CAMPAIGN_HANDLER: CRITICAL - Failed to create initial 'PENDING_PROCESSING' log entry for lead ${leadId}. Skipping.`);
          processingErrors.push({ leadId, contact_email: contactEmail, error: 'initial_log_creation_failed', timestamp: new Date().toISOString() });
          failureCount++;
          continue; // Skip to the next lead
        }
        // If we are here, logId is a valid number.
      } catch (initialLogErr: any) {
        console.error(`ELI5_CAMPAIGN_HANDLER: CRITICAL - Exception during initial 'PENDING_PROCESSING' logging for lead ${leadId}: ${initialLogErr.message || String(initialLogErr)}`);
        processingErrors.push({ leadId, contact_email: contactEmail, error: 'initial_log_exception', timestamp: new Date().toISOString() });
        failureCount++;
        continue; // Skip to the next lead
      }
      // At this point, logId is GUARANTEED to be a number.

      // TODO: Implement proper sender selection logic (rotation, limits, cooling periods)
      const selectedSender = allSenders[0]; // Placeholder: always use the first sender
      if (!selectedSender) {
        console.error(`ELI5_CAMPAIGN_HANDLER: No sender available for lead ${leadId}. Skipping.`);
        processingErrors.push({ leadId, error: 'no_sender_for_lead', timestamp: new Date().toISOString() });
        failureCount++;
        // logId is guaranteed to be a number here due to the preceding initialization block.
        await updateEmailLogStatus(supabase, logId, 'FAILED_NO_SENDER', null, 'No sender available for this lead.');
        continue; // Skip to the next lead
      }

      // Prepare personalization data for Nunjucks
      const personalizationDataForEmail = {
        lead_id: leadId as string,
        contact_name: contactName || '',
        contact_email: contactEmail || '',
        sender_name: selectedSender.name || '',
        sender_email: selectedSender.email || '',
        property_address: lead.property_address as string || '',
        property_city: lead.property_city as string || '',
        property_state: lead.property_state as string || '',
        property_postal_code: lead.property_postal_code as string || '',
        assessed_total: lead.assessed_total as number || 0,
        avm_value: lead.avm_value as number || 0,
        baths: lead.baths as string || '',
        beds: lead.beds as string || '',
        year_built: lead.year_built as string || '',
        square_footage: lead.square_footage as string || '',
        lot_size_sqft: lead.lot_size_sqft as string || '',
        mls_curr_status: lead.mls_curr_status as string || '',
        mls_curr_days_on_market: lead.mls_curr_days_on_market as string || '',
        campaign_name: campaignDetails.name as string || '',
        // Add any other fields from 'lead' or 'campaignDetails' needed by templates, with defaults
        original_lead_data: (lead as any).original_lead_data ?? {}, // TODO: Regenerate Supabase types if this field is valid
        market_region: lead.market_region as string || '',
        last_contacted_at: (lead as any).last_contacted_at ?? '' // TODO: Regenerate Supabase types if this field is valid
      };

      let emailSubject: string = '';
      let emailBody: string = '';
      try {
        emailSubject = nunjucksRenderString(String(emailTemplate.subject), personalizationDataForEmail);
        emailBody = nunjucksRenderString(String(emailTemplate.body_html || emailTemplate.body_text || ''), personalizationDataForEmail);
      } catch (renderError: any) {
        const renderErrorMsg = `Email template rendering failed for lead ${leadId}: ${renderError.message || String(renderError)}`;
        console.error(`ELI5_CAMPAIGN_HANDLER: ${renderErrorMsg}`);
        // logId is guaranteed to be a number here due to the robust initialization earlier.
        await updateEmailLogStatus(supabase, logId, 'FAILED_PREPARATION', null, renderErrorMsg);
        processingErrors.push({ leadId, contact_email: contactEmail, error: 'template_render_failed', timestamp: new Date().toISOString() });
        failureCount++;
        continue; // CRITICAL: Skip to the next lead, do not proceed to create emailConfig or send.
      }
      // If rendering was successful, execution continues here.
      // The emailConfig declaration and subsequent logic will only be reached if the try block for rendering succeeded.
      const emailConfig: EmailConfig = {
        recipientEmail: contactEmail as string,
        recipientName: contactName as string,
        leadId,
        senderEmail: selectedSender.email as string,
        senderName: selectedSender.name as string,
        emailSubjectTemplate: emailSubject,
        emailBodyTemplate: emailBody,
        personalizationData: personalizationDataForEmail,
        pdfSettings: {
          generate: !!documentTemplate,
          personalizationData: personalizationDataForEmail,
          filenamePrefix: documentTemplate?.name as string || `LOI_${(campaignDetails.name || 'Campaign').replace(/\s+/g, '_')}`,
        },
        campaignId: currentCampaignId, 
        campaignRunId: currentCampaignRunId,
        dryRun: isDryRun,
      };

      if (isDryRun) {
        console.log(`ELI5_CAMPAIGN_HANDLER: [DRY RUN] Would send email to ${contactEmail} from ${selectedSender.email} for lead ${leadId}.`);
        if (logId !== null) {
          await updateEmailLogStatus(supabase, logId, 'DRY_RUN_SENT', new Date().toISOString(), 'Dry run simulation.');
        }
        successCount++;
        // selectedSender.in_memory_sent_today++; 
        // selectedSender.can_send_after_timestamp = Date.now() + (Math.floor(Math.random() * (5.5 * 60000 - 3.5 * 60000 + 1)) + 3.5 * 60000);
      } else {
        const sendResult = await sendConfiguredEmail(emailConfig);
        if (sendResult.success && sendResult.messageId) {
          console.log(`ELI5_CAMPAIGN_HANDLER: Email sent successfully to ${contactEmail} from ${selectedSender.email} for lead ${leadId}. Message ID: ${sendResult.messageId}`);
          if (logId !== null) {
            await updateEmailLogStatus(supabase, logId!, 'SENT', new Date().toISOString());
          }
          successCount++;
          selectedSender.in_memory_sent_today++;
          const cooldownMs = Math.floor(Math.random() * (5.5 * 60 * 1000 - 3.5 * 60 * 1000 + 1)) + 3.5 * 60 * 1000; // 3.5 to 5.5 minutes
          selectedSender.can_send_after_timestamp = Date.now() + cooldownMs;
          console.log(`ELI5_CAMPAIGN_HANDLER: Sender ${selectedSender.email} on cooldown for ${cooldownMs / 1000 / 60} minutes. Next send at ${new Date(selectedSender.can_send_after_timestamp).toLocaleTimeString()}`);
          await incrementSenderSentCount(supabase, selectedSender.id as string);
        } else { // This 'else' pairs with 'if (sendResult.success && sendResult.messageId)'
          console.error(`ELI5_CAMPAIGN_HANDLER: Failed to send email to ${contactEmail} for lead ${leadId}. Error: ${sendResult.error}`);
          if (logId !== null) { // logId is guaranteed to be a number here
            await updateEmailLogStatus(supabase, logId!, 'FAILED_SENDING', null, sendResult.error || 'Unknown send error');
          }
          failureCount++;
        } // Closes 'else' for 'if (sendResult.success ...)'
      } // Closes 'else' for 'if (dryRun)'
      senderAssignedAndEmailProcessed = true; // Mark as processed as an attempt was made with the selected sender
    } // End of for...of leads loop

    // Final summary response
    const totalAttempted = successCount + failureCount;
    const summaryMessage = `Campaign run ${currentCampaignRunId} for campaign ${currentCampaignId} completed. Attempted: ${totalAttempted}, Sent: ${successCount}, Failed: ${failureCount}.`;
    
    console.log(`ELI5_CAMPAIGN_HANDLER: ${summaryMessage}`);
    console.log('ELI5_CAMPAIGN_HANDLER: Processing Errors:', JSON.stringify(processingErrors, null, 2));

    // Log overall campaign run status (optional, could be a separate table or log entry)
    // Example: await logCampaignRunSummary(supabase, { campaign_id, campaign_run_id, successCount, failureCount, totalAttempted, processingErrors });

    return res.status(200).json({
      success: true,
      message: summaryMessage,
      campaign_id: currentCampaignId,
      campaign_run_id: currentCampaignRunId,
      summary: {
        total_leads_processed_in_batch: leads.length, // Number of leads fetched for this batch
        emails_sent_successfully: successCount,
        emails_failed_to_send: failureCount,
        processing_errors_details: processingErrors || [] // Initialize empty array if processingErrors is undefined
      }
    });
  } catch (err) {
    console.error('ELI5_CAMPAIGN_HANDLER: Uncaught exception in handler:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

export default handler;
