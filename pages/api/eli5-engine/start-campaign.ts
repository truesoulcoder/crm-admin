import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import nunjucks from 'nunjucks';
import {
  getSupabaseClient,
  getGmailService,
  isValidEmail,
} from './_utils'; // Assuming logToSupabase is not directly used now
import { generateLoiPdf } from './_pdfUtils';
import { SupabaseClient } from '@supabase/supabase-js';
import { sendConfiguredEmail, EmailConfig } from './send-email'; // Added import

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
nunjucks.configure(templateDir, { autoescape: true });

// Sender management
let senders: Array<{id: string, name: string, email: string, daily_limit: number, sent_today: number}> = [];
let currentSenderIndex = 0;

// Function to fetch and update senders from the database
async function updateSendersFromDB(supabase: SupabaseClient, filter_sender_ids?: string[]) {
  try {
    let query = supabase
      .from('senders')
      .select('id, name, email, daily_limit, sent_today')
      .eq('is_active', true)
      .order('sent_today', { ascending: true });

    if (filter_sender_ids && filter_sender_ids.length > 0) {
      query = query.in('id', filter_sender_ids);
      console.log(`Filtering senders by IDs: ${filter_sender_ids.join(', ')}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching senders:', error);
      return []; // Return empty or throw, depending on desired error handling
    }

    console.log(`Senders updated: ${data ? data.length : 0} senders loaded matching criteria.`);
    return data || [];
  } catch (error) {
    console.error('Exception when fetching senders:', error);
    return []; // Return empty or throw
  }
}

// Function to get the next available sender
async function getNextSender(supabase: SupabaseClient, filter_sender_ids?: string[]) {
  // Refresh senders from DB to get latest counts, potentially filtered
  senders = await updateSendersFromDB(supabase, filter_sender_ids);
  
  if (senders.length === 0) {
    // Adjusted error message for clarity
    throw new Error('No active senders found matching the specified criteria (selected_sender_ids or general availability).');
  }

  // Find a sender that hasn't exceeded their daily limit from the (potentially filtered) list
  // The list is already sorted by sent_today ascending by updateSendersFromDB
  for (let i = 0; i < senders.length; i++) {
    // Simple round-robin on the current list might not be ideal if list is very small or filtered.
    // Better to iterate through the sorted list.
    const sender = senders[i]; // Iterate through the sorted list
    if (sender.sent_today < sender.daily_limit) {
      return sender; // This is the least used, available sender
    }
  }
  
  // If all (filtered) senders have hit their daily limit
  // The list is already sorted by sent_today, so senders[0] is among those with least sends.
  // However, the condition is that they are *all* over limit.
  const firstSender = senders[0];
  console.warn(`All available/selected senders have reached their daily limit. Defaulting to the least used sender: ${firstSender.email} (Sent: ${firstSender.sent_today}/${firstSender.daily_limit}). This sender might be over quota.`);
  // Depending on strictness, you might want to throw an error here if NO sender is strictly under quota.
  // For now, it returns the least over-quota sender, which incrementSenderSentCount will still affect.
  // Consider changing this to throw new Error('All (selected) senders have reached their daily limits.');
  // if no sender is strictly under their limit.
  // For now, let's assume we want to proceed even if it means going over, and rely on Gmail's own limits as a final backstop.
  return firstSender; 
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
  } catch (error) {
    console.error('Exception when incrementing sender sent count:', error);
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
  } catch (error) {
    console.error('Error in logInitialAttempt:', error);
    throw error;
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
  } catch (error) {
    console.error(`Error in updateEmailLogStatus for log ID ${logId}:`, error);
  }
}

interface StartCampaignRequestBody {
  market_region: string;
  limit_per_run?: number;
  campaign_id?: string; 
  campaign_run_id?: string; 
  selected_sender_ids?: string[]; // Optional array of sender UUIDs
  timeout_interval_seconds?: number; // Optional, delay between sends
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const {
    market_region,
    limit_per_run = 10, // Default limit
    campaign_id = `campaign-${Date.now()}`, 
    campaign_run_id = `run-${Date.now()}`,
    selected_sender_ids, // Added
    timeout_interval_seconds = 0 // Added, default to 0
  }: StartCampaignRequestBody = req.body;

  if (!market_region || typeof market_region !== 'string') {
    return res.status(400).json({ success: false, error: 'market_region (string) is required.' });
  }
  if (typeof limit_per_run !== 'number' || limit_per_run <= 0) {
    return res.status(400).json({ success: false, error: 'limit_per_run (positive number) is invalid.' });
  }
  if (timeout_interval_seconds < 0) { // Added validation
    return res.status(400).json({ success: false, error: 'timeout_interval_seconds cannot be negative.' });
  }

  const supabase = getSupabaseClient();
  let attemptedCount = 0;
  let successCount = 0;
  let failureCount = 0;
  const processingErrors: { lead_id: string, error: string }[] = [];

  try {
    const { data: leads, error: leadsError } = await supabase
      .from('useful_leads')
      .select('*')
      .eq('market_region', market_region)
      .is('email_sent', null) 
      .neq('property_type', 'Vacant Land')
      .not('contact_email', 'is', null)
      .order('id', { ascending: true })
      .limit(limit_per_run);

    if (leadsError) {
      throw new Error(`Failed to fetch leads: ${leadsError.message}`);
    }

    if (!leads || leads.length === 0) {
      return res.status(200).json({
        success: true, message: 'No eligible leads found for the given criteria.',
        market_region, campaign_id, campaign_run_id, attempted: 0, succeeded: 0, failed: 0, processing_errors: []
      });
    }

    for (const lead of leads) {
      attemptedCount++;
      let logId: number | null = null;

      try {
        if (!lead.contact_email || !isValidEmail(lead.contact_email)) {
          const errMsg = `Invalid or missing contact email: ${lead.contact_email || 'N/A'}`;
          processingErrors.push({ lead_id: lead.id, error: errMsg });
          failureCount++;
          // Try to log this validation failure without it stopping the whole process
          try {
            await logInitialAttempt(supabase, {
              original_lead_id: lead.id, contact_name: lead.contact_name || 'N/A',
              contact_email: lead.contact_email || 'N/A', sender_email_used: 'sender@example.com',
              sender_name: 'Sender Name', campaign_id: campaign_id, campaign_run_id: campaign_run_id,
              email_status: 'VALIDATION_FAILED', email_error_message: errMsg,
            });
          } catch (logErr: any) { console.error(`Lead ID ${lead.id}: Failed to log validation failure: ${logErr.message}`); }
          continue;
        }

        // Get the next available sender
        const sender = await getNextSender(supabase, selected_sender_ids); // Pass selected_sender_ids
        // Error if no sender is now handled by getNextSender throwing an error, which will be caught by leadProcessingError

        logId = await logInitialAttempt(supabase, {
          original_lead_id: lead.id, 
          contact_name: lead.contact_name || 'N/A',
          contact_email: lead.contact_email, 
          sender_email_used: sender.email, // From selected sender
          sender_name: sender.name, // From selected sender
          campaign_id: campaign_id, 
          campaign_run_id: campaign_run_id,
          // email_status is set to PENDING_PROCESSING by default in logInitialAttempt
        });

        if (!logId) {
            // This case should ideally not be reached if logInitialAttempt throws on failure.
            // If it can return null, this is a valid check.
            throw new Error("Failed to create initial log entry, logId is null.");
        }

        const emailTemplatePath = path.join(templateDir, 'email_body_with_subject.html');
        const emailHtmlContent = await fs.readFile(emailTemplatePath, 'utf-8');
        const subjectMatch = emailHtmlContent.match(/<!-- SUBJECT: (.*?) -->/);
        const rawSubjectTemplate = subjectMatch ? subjectMatch[1].trim() : 'Following Up on Your Property';
        const rawBodyTemplate = emailHtmlContent.replace(/<!-- SUBJECT: (.*?) -->/, '').trim();

        // Prepare personalizationData for sendConfiguredEmail
        const personalizationDataForEmail: Record<string, any> = {
          ...lead, // Include all lead properties directly
          contact_name: lead.contact_name || 'Valued Contact', // Ensure contact_name is set
          // sender_name and sender_email will be set by EmailConfig directly
          // Add any other calculated fields needed for templates if not already in lead object:
          // e.g., current_date, closing_date, offer_price, emd_amount from original test-email.ts
          // For this integration, we assume these are either in `lead` or added here.
          // Example: (ensure these calculations are robust and handle missing lead data)
          current_date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          closing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), // 30 days from now
          offer_price: lead.assessed_total ? (parseFloat(String(lead.assessed_total)) * 0.5).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '$0.00', // Example calculation with fallback
          emd_amount: lead.assessed_total ? (parseFloat(String(lead.assessed_total)) * 0.005).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '$0.00', // Example calculation with fallback
          title_company: "Default Title Company", // Make dynamic if needed
          sender_title: "Acquisitions Specialist", // Example
          company_name: "Your Company LLC", // Example
        };
        
        const emailConfig: EmailConfig = {
            recipientEmail: lead.contact_email,
            recipientName: lead.contact_name || 'Valued Contact',
            leadId: lead.id, // For logging within sendConfiguredEmail, maps to original_lead_id
            senderEmail: sender.email,
            senderName: sender.name,
            emailSubjectTemplate: rawSubjectTemplate,
            emailBodyTemplate: rawBodyTemplate,
            personalizationData: personalizationDataForEmail,
            pdfSettings: {
                generate: true, // Assuming PDF is always generated
                personalizationData: { 
                    ...personalizationDataForEmail, // Pass the same data, or a specific subset/superset
                    date_generated: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) 
                },
                // Sanitize property address for filename, provide fallback if null/undefined
                filenamePrefix: `Letter_of_Intent_${(lead.property_address || lead.id || 'UnknownProperty').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '')}`,
            },
            campaignId: campaign_id,
            campaignRunId: campaign_run_id,
        };
        
        // Update log with actual subject template (body preview logged by sendConfiguredEmail)
        // This is a bit redundant as sendConfiguredEmail also logs subject, but keeps some local context.
        await supabase.from('eli5_email_log').update({
            email_subject_sent: rawSubjectTemplate // Storing the template, actual rendered subject logged by sendEmail
        }).eq('id', logId);

        // Call the new sendConfiguredEmail function
        const sendResult = await sendConfiguredEmail(emailConfig);

        if (sendResult.success) {
          const sentAt = new Date().toISOString();
          await updateEmailLogStatus(supabase, logId, 'SENT', sentAt, null); // sendConfiguredEmail logs its own details, this confirms 'SENT'
          await supabase.from('useful_leads').update({ email_sent: true, email_sent_at: sentAt }).eq('id', lead.id);
          successCount++;
          await incrementSenderSentCount(supabase, sender.id); // Increment after successful send

          if (timeout_interval_seconds > 0) {
            console.log(`Waiting for ${timeout_interval_seconds} seconds before next email...`);
            await new Promise(resolve => setTimeout(resolve, timeout_interval_seconds * 1000));
          }
        } else {
          // sendConfiguredEmail already logs the detailed error. Here, we update our campaign log for this lead.
          await updateEmailLogStatus(supabase, logId, 'SEND_FAILED', null, sendResult.error || 'Send failed from module');
          failureCount++; 
          processingErrors.push({ lead_id: lead.id, error: `Email send failed: ${sendResult.error || 'Unknown error from sendConfiguredEmail'}` });
          // Do NOT increment sender count or apply timeout on failure
        }

      } catch (leadProcessingError: any) { // This catches errors from getNextSender, logInitialAttempt, readFile, or sendConfiguredEmail EXCEPTIONs
        console.error(`Error processing lead ID ${lead.id}:`, leadProcessingError.message, leadProcessingError.stack);
        // Ensure failureCount is incremented and error is logged for this lead
        if (!processingErrors.find(e => e.lead_id === lead.id)) { // Avoid double-counting if error was already pushed
            failureCount++;
            processingErrors.push({ lead_id: lead.id, error: leadProcessingError.message });
        }
        
        if (logId) {
          // If logId exists, update its status to reflect the processing failure.
          await updateEmailLogStatus(supabase, logId, 'PROCESSING_FAILED', null, leadProcessingError.message);
        } else {
          // If logId was never created (e.g., error in getNextSender or initial logInitialAttempt)
          // Attempt a new log entry to capture this lead's failure.
          try {
            await logInitialAttempt(supabase, {
              original_lead_id: lead.id, 
              contact_name: lead.contact_name || 'N/A',
              contact_email: lead.contact_email || 'N/A', 
              sender_email_used: 'N/A', // Sender might not have been determined
              sender_name: 'N/A',
              campaign_id: campaign_id, 
              campaign_run_id: campaign_run_id,
              email_status: 'PROCESSING_FAILED', 
              email_error_message: `Outer loop: ${leadProcessingError.message}`,
            });
          } catch (logErr: any) { 
            console.error(`Lead ID ${lead.id}: Critical - Failed to log overall processing failure: ${logErr.message}`); 
          }
        }
        // Decide if a single lead processing error should halt the entire campaign.
        // For now, it continues to the next lead. If getNextSender threw, it might halt if not caught properly.
        // The current structure with getNextSender throwing will be caught here, logged, and loop continues.
        // If the error from getNextSender implies no senders are available AT ALL, the loop might effectively stop.
      }
    } // End of for...of loop for leads

    return res.status(200).json({
      success: true, message: `Campaign batch processing finished for ${market_region}.`,
      market_region, limit_per_run, campaign_id, campaign_run_id,
      selected_sender_ids_count: selected_sender_ids ? selected_sender_ids.length : 0, // Added for info
      timeout_interval_seconds, // Added for info
      attempted: attemptedCount, succeeded: successCount, failed: failureCount,
      processing_errors: processingErrors,
    });

  } catch (error: any) { // Catch-all for errors like initial DB query failure or if getNextSender throws before loop
    console.error('Major error in start-campaign handler:', error.message, error.stack);
    // Ensure processing_errors has the major error if it's not specific to a lead
    if (!processingErrors.some(e => e.error.includes(error.message))) {
        processingErrors.push({lead_id: 'N/A_HANDLER_LEVEL', error: `Major handler error: ${error.message}`});
    }
    return res.status(500).json({
      success: false, error: `Major error: ${error.message}`, market_region, campaign_id, campaign_run_id,
      attempted: attemptedCount, succeeded: successCount, failed: failureCount,
      processing_errors: processingErrors,
    });
  }
}
