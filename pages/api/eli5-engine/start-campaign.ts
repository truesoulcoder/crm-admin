import fs from 'fs/promises';
import path from 'path';

import { SupabaseClient } from '@supabase/supabase-js';
import { configure as nunjucksConfigure, renderString as nunjucksRenderString } from 'nunjucks';

import { generateLoiPdf } from './_pdfUtils';
import { getGmailService, getSupabaseClient, isValidEmail } from './_utils';
import { sendConfiguredEmail, type EmailConfig } from './send-email';

import type { Tables } from '@/types/db_types';
import type { NextApiRequest, NextApiResponse } from 'next';

// Define a type for the log entry for cleaner code, matching eli5_email_log structure
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

// getNextSender function is removed as its logic is replaced by the new sender management within the main handler.

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
      console.error('Failed to log initial attempt to Supabase:', error);
      throw error; 
    }
    if (!data || !data.id) {
        console.error('Failed to log initial attempt to Supabase: No ID returned');
        throw new Error('Failed to log initial attempt: No ID returned');
    }
    return data.id;
  } catch (e: unknown) {
    let errorMessage = 'Unknown error in logInitialAttempt';
    let errorStack: string | undefined;
    if (e instanceof Error) {
      errorMessage = e.message;
      errorStack = e.stack;
    } else if (typeof e === 'string') {
      errorMessage = e;
    }
    console.error('Error in logInitialAttempt:', errorMessage, errorStack);
    if (e instanceof Error) throw e;
    throw new Error(errorMessage);
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

interface StartCampaignRequestBody {
  market_region: string;
  limit_per_run?: number; // Max leads to attempt processing in this run
  campaign_id: string; // Mandatory: associates with a campaign entity in DB
  campaign_run_id?: string; // Optional: Unique ID for this specific execution batch, defaults if not provided
  selected_sender_ids?: string[]; // Optional: filter senders to this specific list of IDs
  selected_lead_ids?: string[]; // Optional: process only these specific lead IDs from normalized_leads
  dryRun?: boolean; // Optional: If true, simulates sending without actual email dispatch, defaults to false
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let successCount = 0;
  let failureCount = 0;
  const processingErrors: { leadId?: string; contact_email?: string; error: string; details?: string }[] = [];
  const campaignRunIdProcessed: string = req.body.campaign_run_id || `run-${Date.now()}`;
  console.log(`ELI5_CAMPAIGN_HANDLER: Received request to ${req.body.dryRun ? 'DRY RUN' : 'START'} campaign (ID: ${req.body.campaign_id}, Run ID: ${campaignRunIdProcessed}) at ${new Date().toISOString()}`);
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const {
    market_region,
    limit_per_run = 100, // Default number of leads to attempt in this run
    campaign_id,
    campaign_run_id = campaignRunIdProcessed,
    selected_sender_ids,
    selected_lead_ids,
    dryRun = false,
  }: StartCampaignRequestBody = req.body;

  console.log('ELI5_CAMPAIGN_HANDLER: Request Body:', JSON.stringify(req.body, null, 2));

  if (!campaign_id) {
    console.error('ELI5_CAMPAIGN_HANDLER: campaign_id is required.');
    return res.status(400).json({ success: false, error: 'campaign_id is required.' });
  }
  if (!market_region && !(selected_lead_ids && selected_lead_ids.length > 0)) {
    console.error('ELI5_CAMPAIGN_HANDLER: market_region is required when not processing specific lead_ids.');
    processingErrors.push({ error: 'market_region_required', details: 'Market region is required unless specific lead_ids are provided.' });
    return res.status(400).json({ 
        success: false, 
        message: 'Market region is required unless specific lead_ids are provided.',
        summary: { successCount, failureCount, processingErrors, campaignRunId: campaign_run_id }
    });
  }

  console.log(`ELI5_CAMPAIGN_HANDLER: Config - Campaign ID: ${campaign_id}, Run ID: ${campaign_run_id}, Market: ${market_region || 'N/A (specific leads selected)'}, Limit: ${limit_per_run}, Dry Run: ${dryRun}, Senders: ${selected_sender_ids?.join(',') || 'ALL'}, Leads: ${selected_lead_ids?.join(',') || 'MARKET_BASED'}`);

  const supabase = getSupabaseClient();
  const allSenders = await fetchAndPrepareSenders(supabase, selected_sender_ids);

  if (allSenders.length === 0) {
    const errorMsg = 'No active senders available or matched the filter. Campaign cannot start.';
    console.warn(`ELI5_CAMPAIGN_HANDLER: ${errorMsg}`);
    processingErrors.push({ error: 'no_senders_available', details: errorMsg });
    return res.status(400).json({
      success: false,
      message: errorMsg,
      summary: { successCount, failureCount, processingErrors, campaignRunId: campaign_run_id }
    });
  }
  console.log(`ELI5_CAMPAIGN_HANDLER: Initialized ${allSenders.length} senders for campaign ${campaign_id}, run ${campaign_run_id}.`);

  // Fetch leads
  let leadsQuery = supabase
    .from('normalized_leads')
    .select('id, original_lead_data, contacts, market_region') // Ensure all needed fields are selected
    .order('last_contacted_at', { ascending: true, nullsFirst: true })
    .limit(limit_per_run);

  if (selected_lead_ids && selected_lead_ids.length > 0) {
    console.log(`ELI5_CAMPAIGN_HANDLER: Filtering leads by specific IDs: ${selected_lead_ids.join(', ')}`);
    leadsQuery = leadsQuery.in('id', selected_lead_ids);
  } else if (market_region) {
    console.log(`ELI5_CAMPAIGN_HANDLER: Filtering leads by market_region: ${market_region}`);
    leadsQuery = leadsQuery.eq('market_region', market_region);
  } else {
    const criticalErrorMsg = 'Critical logic error: Neither market_region nor selected_lead_ids provided for lead fetching.';
    console.error(`ELI5_CAMPAIGN_HANDLER: ${criticalErrorMsg}`);
    processingErrors.push({ error: 'internal_logic_error', details: criticalErrorMsg });
    return res.status(500).json({
      success: false,
      message: criticalErrorMsg,
      summary: { successCount, failureCount, processingErrors, campaignRunId: campaign_run_id }
    });
  }

  const { data: leads, error: leadsError } = await leadsQuery;

  if (leadsError) {
    console.error('ELI5_CAMPAIGN_HANDLER: Error fetching leads:', leadsError.message);
    processingErrors.push({ error: 'leads_fetch_failed', details: leadsError.message });
    return res.status(500).json({ 
        success: false, 
        message: 'Error fetching leads.', 
        error: leadsError.message, 
        summary: { successCount, failureCount, processingErrors, campaignRunId: campaign_run_id } 
    });
  }

  if (!leads || leads.length === 0) {
    console.log('ELI5_CAMPAIGN_HANDLER: No leads found for the given criteria.');
    return res.status(200).json({ 
        success: true, 
        message: 'No leads found for the given criteria.', 
        summary: { successCount, failureCount, processingErrors, campaignRunId: campaign_run_id } 
    });
  }
  console.log(`ELI5_CAMPAIGN_HANDLER: Fetched ${leads.length} leads to process for campaign ${campaign_id}, run ${campaign_run_id}.`);

  // Fetch campaign details, including templates
  const { data: campaignDetails, error: campaignError } = await supabase
    .from('campaigns')
    .select(`
      name,
      email_template_id,
      email_templates (subject, body, is_html),
      document_template_id,
      document_templates (file_name_pattern, content_json, template_type)
    `)
    .eq('id', campaign_id)
    .single();

  if (campaignError || !campaignDetails || !campaignDetails.email_templates || campaignDetails.email_templates.length === 0) {
    const errorMsg = `Campaign with ID ${campaign_id} not found, or critical email template data is missing. Error: ${campaignError?.message}`;
    console.error(`ELI5_CAMPAIGN_HANDLER: ${errorMsg}`);
    // Log this critical setup failure before returning
    // Consider a specific log status for this scenario if not already covered
    return res.status(404).json({ success: false, error: errorMsg });
  }

  const emailTemplateFromDetails = campaignDetails.email_templates[0];
  if (!emailTemplateFromDetails || !emailTemplateFromDetails.subject || !emailTemplateFromDetails.body) {
    const errorMsg = `Essential subject or body missing in email template for campaign ${campaign_id}.`;
    console.error(`ELI5_CAMPAIGN_HANDLER: ${errorMsg}`);
    return res.status(404).json({ success: false, error: errorMsg });
  }

  // Document template is optional
  const documentTemplateFromDetails = (campaignDetails.document_templates && campaignDetails.document_templates.length > 0) ? campaignDetails.document_templates[0] : null;
  if (campaignDetails.document_template_id && (!documentTemplateFromDetails || !documentTemplateFromDetails.file_name_pattern || !documentTemplateFromDetails.content_json)) {
    const errorMsg = `Document template ID ${campaignDetails.document_template_id} provided for campaign ${campaign_id}, but template data (file_name_pattern or content_json) is missing or invalid.`;
    console.error(`ELI5_CAMPAIGN_HANDLER: ${errorMsg}`);
    return res.status(404).json({ success: false, error: errorMsg });
  }

  console.log(`ELI5_CAMPAIGN_HANDLER: Campaign '${campaignDetails.name}' validated. Email Template Subject: '${emailTemplateFromDetails.subject}'. Document Template: ${documentTemplateFromDetails ? `'${documentTemplateFromDetails.file_name_pattern}'` : 'None'}.`);

  const emailTemplate = {
    subject: emailTemplateFromDetails.subject as string, // Cast to string, assuming db_types might be 'any'
    body: emailTemplateFromDetails.body as string,       // Cast to string
    is_html: emailTemplateFromDetails.is_html as boolean // Cast to boolean
  };

  const documentTemplate = documentTemplateFromDetails ? {
    file_name_pattern: documentTemplateFromDetails.file_name_pattern as string,
    content_json: documentTemplateFromDetails.content_json as any, // Keep as any if structure varies
    template_type: documentTemplateFromDetails.template_type as string
  } : null;

  // Fetch Senders (already correctly implemented)
  // ...

// Fetch Leads (already correctly implemented)
// ...

// The validated 'emailTemplate' and 'documentTemplate' are already defined from lines 358-369.
// The redundant logic and incorrect destructuring that were here have been removed.

// ...

// Update all fetched leads as failed due to this campaign-level issue
for (const lead of leads) {
  let logIdForCampaignFailure: number | null = null;
  try {
    logIdForCampaignFailure = await logInitialAttempt(supabase, {
      original_lead_id: lead.id,
      contact_email: (lead.contact_email && isValidEmail(lead.contact_email)) ? lead.contact_email : 'unknown',
      campaign_id: campaign_id,
      campaign_run_id: campaign_run_id,
      email_status: 'FAILED_CAMPAIGN_SETUP'
    });
    if (logIdForCampaignFailure) {
      await updateEmailLogStatus(supabase, logIdForCampaignFailure, 'FAILED_CAMPAIGN_SETUP', null, 'Campaign setup failure');
    }
  } catch (logErr: any) {
    let detailMessage = 'Unknown error during FAILED_CAMPAIGN_SETUP logging.';
    if (logErr instanceof Error) detailMessage = logErr.message;
    else if (typeof logErr === 'string') detailMessage = logErr;
    console.error(`ELI5_CAMPAIGN_HANDLER: Logging failure for FAILED_CAMPAIGN_SETUP on lead ${lead.id}: ${detailMessage}`);
    processingErrors.push({ leadId: lead.id, error: 'logging_failed_campaign_setup', details: detailMessage });
  }
  failureCount++;
}

// ...

// Main processing loop for leads
for (const lead of leads) {
  const leadId = lead.id;
  const contactEmail = lead.contact_email;
  const contactName = lead.contact_name || 'Valued Prospect'; // Use lead's contact_name or a default

  let logId: number | null = null;

  if (!contactEmail || !isValidEmail(contactEmail)) {
    // ...
    console.log(`ELI5_CAMPAIGN_HANDLER: Lead ID ${leadId}: ${noContactError}`);
    try {
      logId = await logInitialAttempt(supabase, {
        original_lead_id: leadId,
        contact_email: 'N/A',
        campaign_id: campaign_id,
        campaign_run_id: campaign_run_id,
        email_status: 'FAILED_NO_CONTACT',
        email_error_message: noContactError
      });
    } catch (e: unknown) {
      let detailMessage = 'Unknown error during FAILED_NO_CONTACT logging.';
      if (e instanceof Error) detailMessage = e.message;
      else if (typeof e === 'string') detailMessage = e;
      console.error(`ELI5_CAMPAIGN_HANDLER: Logging failure for FAILED_NO_CONTACT on lead ${leadId}: ${detailMessage}`);
      processingErrors.push({ leadId, error: 'logging_failed', contact_email: 'N/A', details: `FAILED_NO_CONTACT: ${e instanceof Error ? e.message : String(e)}` });
    }
    failureCount++;
    processingErrors.push({ leadId, error: 'no_valid_contact', contact_email: 'N/A', details: noContactError });
    continue; // Next lead
  }

  // ...

  let emailSubject: string = '';
  let emailBody: string = '';
  try {
    emailSubject = nunjucks.renderString(emailTemplate.subject, personalizationDataForEmail);
    emailBody = nunjucks.renderString(emailTemplate.body, personalizationDataForEmail);
  } catch (renderError: any) {
    const renderErrorMsg = `Email template rendering failed for lead ${leadId}: ${renderError.message}`;
    console.error(`ELI5_CAMPAIGN_HANDLER: ${renderErrorMsg}`);
    if (logId !== null) {
      if (logId !== null) {
          await updateEmailLogStatus(supabase, logId, 'FAILED_PREPARATION', null, renderErrorMsg);
        }
        const emailConfig: EmailConfig = {
          recipientEmail: contactEmail,
          recipientName: contactName,
          leadId: leadId,
          senderEmail: selectedSender.email,
          senderName: selectedSender.name,
          emailSubjectTemplate: emailSubject, // Already rendered
          emailBodyTemplate: emailBody,       // Already rendered
          personalizationData: personalizationDataForEmail,
          pdfSettings: {
            generate: !!documentTemplate, // Generate PDF if a document template is associated
            personalizationData: personalizationDataForEmail, // Use the same data for PDF
            filenamePrefix: documentTemplate?.file_name_pattern || `LOI_${campaignDetails.name.replace(/\s+/g, '_')}`,
          },
          campaignId: campaign_id,
          campaignRunId: campaign_run_id,
          dryRun: dryRun
        };

        if (dryRun) {
          console.log(`ELI5_CAMPAIGN_HANDLER: [DRY RUN] Would send email to ${contactEmail} from ${selectedSender.email} for lead ${leadId}.`);
          await updateEmailLogStatus(supabase, logId, 'DRY_RUN_SENT', new Date().toISOString(), 'Dry run simulation.');
          successCount++;
          // Simulate sender updates for dry run consistency if needed for testing flows
          // selectedSender.in_memory_sent_today++; 
          // selectedSender.can_send_after_timestamp = Date.now() + (Math.floor(Math.random() * (5.5 * 60000 - 3.5 * 60000 + 1)) + 3.5 * 60000);
        } else {
          const sendResult = await sendConfiguredEmail(emailConfig);
          if (sendResult.success && sendResult.messageId) {
            console.log(`ELI5_CAMPAIGN_HANDLER: Email sent successfully to ${contactEmail} from ${selectedSender.email} for lead ${leadId}. Message ID: ${sendResult.messageId}`);
            await updateEmailLogStatus(supabase, logId, 'SENT', new Date().toISOString());
            successCount++;
            selectedSender.in_memory_sent_today++;
            const cooldownMs = Math.floor(Math.random() * (5.5 * 60 * 1000 - 3.5 * 60 * 1000 + 1)) + 3.5 * 60 * 1000; // 3.5 to 5.5 minutes
            selectedSender.can_send_after_timestamp = Date.now() + cooldownMs;
            console.log(`ELI5_CAMPAIGN_HANDLER: Sender ${selectedSender.email} on cooldown for ${cooldownMs / 1000 / 60} minutes. Next send at ${new Date(selectedSender.can_send_after_timestamp).toLocaleTimeString()}`);
            await incrementSenderSentCount(supabase, selectedSender.id);
          } else {
            const sendFailReason = sendResult.error || 'Unknown send failure';
            let failureStatus = 'FAILED_SENDING_API_ERROR';
            if (sendFailReason.startsWith('PDF_GENERATION_FAILED')) failureStatus = 'FAILED_PDF_GENERATION';
            else if (sendFailReason.startsWith('PDF_GENERATION_EXCEPTION')) failureStatus = 'FAILED_PDF_GENERATION_EXCEPTION';
            else if (sendFailReason.startsWith('Missing or invalid critical EmailConfig fields') || sendFailReason.startsWith('Missing critical keys in personalizationData')) failureStatus = 'FAILED_PREPARATION';
            
            console.error(`ELI5_CAMPAIGN_HANDLER: Failed to send email for lead ${leadId}. Reason: ${sendFailReason}`);
            await updateEmailLogStatus(supabase, logId, failureStatus, null, sendFailReason);
            processingErrors.push({ leadId, contact_email: contactEmail, error: 'send_email_failed', details: sendFailReason });
            failureCount++;
          }
        }
        senderAssignedAndEmailProcessed = true; // Mark as processed to break from this lead's sender loop

      } else { // No senders currently available (all on cooldown or over quota)
        const sendersStillInRotation = allSenders.filter(s => s.in_memory_sent_today < s.daily_limit);
        if (sendersStillInRotation.length === 0) {
          const allQuotaMsg = 'All active senders have reached their daily quotas for this run.';
          console.log(`ELI5_CAMPAIGN_HANDLER: ${allQuotaMsg} Lead ${leadId} cannot be processed further.`);
          await updateEmailLogStatus(supabase, logId, 'FAILED_ALL_SENDERS_QUOTA', null, allQuotaMsg);
          processingErrors.push({ leadId, contact_email: contactEmail, error: 'all_senders_quota', details: allQuotaMsg });
          failureCount++;
          senderAssignedAndEmailProcessed = true; // Break from while loop for current lead
          // Consider if the entire campaign should stop here. For now, it fails this lead and continues to the next if any.
        } else {
          // All available are on cooldown, wait for the earliest one
          const earliestNextSendTime = Math.min(...sendersStillInRotation.map(s => s.can_send_after_timestamp));
          const waitTime = Math.max(1000, earliestNextSendTime - now); // Wait at least 1s to prevent tight loops
          console.log(`ELI5_CAMPAIGN_HANDLER: No senders immediately available for lead ${leadId}. All are on cooldown. Waiting for ${Math.ceil(waitTime / 1000)}s for sender ${allSenders.find(s=>s.can_send_after_timestamp === earliestNextSendTime)?.email}.`);
          await updateEmailLogStatus(supabase, logId, 'PENDING_SENDER_COOLDOWN', null, `Waiting for sender cooldown: ${Math.ceil(waitTime / 1000)}s`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          // Loop will continue to find an available sender
        }
      }
    } // End of while(!senderAssignedAndEmailProcessed)
  } // End of for...of leads loop

  // Final summary response
  const totalAttempted = successCount + failureCount;
  const summaryMessage = `Campaign run ${campaign_run_id} for campaign ${campaign_id} completed. Attempted: ${totalAttempted}, Sent: ${successCount}, Failed: ${failureCount}.`;
  console.log(`ELI5_CAMPAIGN_HANDLER: ${summaryMessage}`);
  console.log('ELI5_CAMPAIGN_HANDLER: Processing Errors:', JSON.stringify(processingErrors, null, 2));

  // Log overall campaign run status (optional, could be a separate table or log entry)
  // Example: await logCampaignRunSummary(supabase, { campaign_id, campaign_run_id, successCount, failureCount, totalAttempted, processingErrors });

  return res.status(200).json({
    success: true,
    message: summaryMessage,
    campaign_id: campaign_id,
    campaign_run_id: campaign_run_id,
    summary: {
      total_leads_processed_in_batch: leads.length, // Number of leads fetched for this batch
      emails_sent_successfully: successCount,
      emails_failed_to_send: failureCount,
      processing_errors_details: processingErrors,
    }
  });
} // End of handler function
