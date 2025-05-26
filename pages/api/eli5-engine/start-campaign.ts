import path from 'path';

import { SupabaseClient } from '@supabase/supabase-js';
import { configure as nunjucksConfigure, renderString as nunjucksRenderString } from 'nunjucks';

import { generateLoiPdf } from './_pdfUtils';
import { getGmailService, getSupabaseClient, isValidEmail } from './_utils';
import { sendConfiguredEmail } from './send-email';

// Core campaign types
type EmailConfig = {
  recipientEmail: string;
  recipientName: string;
  leadId: string;
  senderEmail: string;
  senderName: string;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
  personalizationData: Record<string, unknown>;
  pdfSettings?: {
    generate: boolean;
    personalizationData: Record<string, unknown>;
    filenamePrefix: string;
  };
  dryRun: boolean;
};

type ProcessLeadResult = {
  success: boolean;
  senderEmail?: string;
  messageId?: string;
  error?: string;
};

type ProcessingError = {
  error: string;
  leadId: string;
  contact_email: string;
  details?: string;
  timestamp: string;
};

type EmailTemplate = {
  subject: string;
  body_html: string;
  body_text: string;
  placeholders: string[];
};

type DocumentTemplate = {
  name: string;
  content: string;
  type: string;
  available_placeholders: string[];
};

type Lead = {
  id: string | number;
  contact_email?: string | null;
  contact_name?: string | null;
  property_address?: string | null;
  property_city?: string | null;
  property_state?: string | null;
  property_postal_code?: string | null;
  property_type?: string | null;
  beds?: string | number | null;
  baths?: string | number | null;
  square_footage?: string | number | null;
  lot_size_sqft?: string | number | null;
  year_built?: string | number | null;
  mls_curr_status?: string | null;
  mls_curr_days_on_market?: string | number | null;
  market_region?: string | null;
};

type StartCampaignRequestBody = {
  market_region?: string | null;
  selected_lead_ids?: string[];
  selected_sender_ids?: string[];
  leads_per_run?: number;
  min_interval_seconds?: number;
  max_interval_seconds?: number;
  dry_run?: boolean;
  dryRun?: boolean;
  email_subject?: string;
  email_body?: string;
  document_content?: string;
};

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
  contact_name?: string;
  contact_email?: string;
  sender_name?: string;
  sender_email_used?: string;
  email_subject_sent?: string;
  email_body_preview_sent?: string;
  email_status?: string; 
  email_error_message?: string | null;
  email_sent_at?: string | null; 
  created_at?: string; 
  is_converted_status_updated_by_webhook?: boolean | null;
  [key: string]: any; 
}

const templateDir = path.join(process.cwd(), 'pages', 'api', 'eli5-engine', 'templates');
nunjucksConfigure(templateDir, { autoescape: true });

// Sender management: File-level state for senders is removed. Senders are fetched and managed within the handler.

// Helper function to process email and document
async function processEmailAndDocument(config: EmailConfig): Promise<ProcessLeadResult> {
  const {
    recipientEmail,
    recipientName,
    leadId,
    senderEmail,
    senderName,
    emailSubjectTemplate,
    emailBodyTemplate,
    personalizationData,
    pdfSettings,
    dryRun = false
  } = config;

  try {
    if (dryRun) {
      console.log(`[DRY RUN] Would send email to ${recipientEmail} from ${senderEmail} for lead ${leadId}`);
      return { success: true, senderEmail };
    }

    // TODO: Implement actual email sending logic here
    // This is a placeholder implementation
    console.log(`Sending email to ${recipientEmail} from ${senderEmail} for lead ${leadId}`);
    
    return {
      success: true,
      senderEmail,
      messageId: `mock-message-id-${Date.now()}`
    };
  } catch (error) {
    console.error(`Error sending email to ${recipientEmail}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      senderEmail
    };
  }
}

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

interface EmailTemplate {
  subject: string;
  body_html: string;
  body_text: string;
  placeholders: string[];
}

interface DocumentTemplate {
  name: string;
  content: string;
  type: string;
  available_placeholders: string[];
}

interface StartCampaignRequestBody {
  // Lead selection
  market_region?: string | null;
  selected_lead_ids?: string[];
  
  // Sender configuration
  selected_sender_ids?: string[];
  
  // Campaign controls
  leads_per_run: number;
  min_interval_seconds: number;
  max_interval_seconds: number;
  dry_run?: boolean;
  dryRun?: boolean; // Alias for dry_run for backward compatibility
  
  // Optional template overrides
  email_subject?: string;
  email_body?: string;
  document_content?: string;
}

interface Lead {
  id: string;
  contact_email?: string;
  contact_name?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_postal_code?: string;
  property_type?: string;
  beds?: string;
  baths?: string;
  square_footage?: string;
  lot_size_sqft?: string;
  year_built?: string;
  mls_curr_status?: string;
  mls_curr_days_on_market?: string;
  market_region?: string;
  [key: string]: any; // For any additional properties
}

interface Sender {
  id: string;
  email: string;
  name: string;
  in_memory_sent_today: number;
  can_send_after_timestamp: number;
  [key: string]: any; // For any additional properties
}

interface ProcessingError {
  error: string;
  leadId?: string;
  contact_email?: string;
  details?: any;
  timestamp: string;
}

interface ProcessLeadResult {
  success: boolean;
  error?: string;
  senderEmail?: string;
  messageId?: string;
}

interface EmailConfig {
  recipientEmail: string;
  recipientName: string;
  leadId: string;
  senderEmail: string;
  senderName: string;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
  personalizationData: Record<string, any>;
  pdfSettings?: {
    generate: boolean;
    personalizationData: Record<string, any>;
}

export async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const supabase = getSupabaseClient();
    const processingErrors: ProcessingError[] = [];
    let leads: Lead[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Get campaign settings from request body
    const body = req.body as StartCampaignRequestBody;
    const {
      market_region,
      selected_lead_ids = [],
      selected_sender_ids = [],
      leads_per_run = 100,
      min_interval_seconds = 30,
      max_interval_seconds = 90,
      dry_run = false,
      dryRun = false,
      email_subject = '',
      email_body = '',
      document_content = ''
    } = body;

    const isDryRun = Boolean(dry_run || dryRun);

    console.log(`ELI5_CAMPAIGN_HANDLER: Received request to ${isDryRun ? 'DRY RUN' : 'START'} at ${new Date().toISOString()}`);

    // Create template objects from frontend settings
    const emailTemplate = {
      subject: email_subject,
      body_html: email_body,
      body_text: email_body.replace(/<[^>]*>?/gm, ''), // Simple HTML to text conversion
      placeholders: [] as string[]
    };

    const documentTemplate = document_content ? {
      name: 'Document',
      content: document_content,
      type: 'document',
      available_placeholders: [] as string[]
    } : undefined;

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

    // Helper function to log initial attempt
    const logInitialAttempt = async (
      supabase: any, 
      data: {
        contact_name: string | null;
        contact_email: string;
        email_status: string;
        lead_id: string;
        error_message?: string;
      }
    ): Promise<number | null> => {
      try {
        const { data: result, error } = await supabase
          .from('email_logs')
          .insert([{
            contact_name: data.contact_name,
            contact_email: data.contact_email,
            email_status: data.email_status,
            lead_id: data.lead_id,
            error_message: data.error_message,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select('id')
          .single();

        if (error) throw error;
        return result?.id;
      } catch (error) {
        console.error('Error in logInitialAttempt:', error);
        return null;
      }
    };

    // Helper function to update email log status
    const updateEmailLogStatus = async (
      supabase: any,
      logId: number,
      status: string,
      sentAt: string | null,
      errorMessage: string | null
    ) => {
      const { error } = await supabase
        .from('email_logs')
        .update({
          email_status: status,
          sent_at: sentAt,
          error_message: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', logId);

      if (error) throw error;
    };

    // Process leads with rate limiting
    const processLead = async (lead: Lead, index: number): Promise<ProcessLeadResult> => {
      const leadId = String(lead.id);
      let contactEmail: string | null = null;
      let contactName: string | null = null;
      let logId: number | null = null;
      const noContactError = 'No valid contact email found for lead';

      // Determine primary contact from lead fields
      if (lead.contact_email && isValidEmail(lead.contact_email)) {
        contactEmail = lead.contact_email;
        contactName = lead.contact_name || 'Valued Prospect';
      } else {
        console.error(`No valid email for lead ${leadId}`);
        try {
          logId = await logInitialAttempt(supabase, {
            contact_email: 'N/A',
            email_status: 'FAILED_NO_CONTACT',
            email_error_message: noContactError,
            lead_id: leadId
          });
          processingErrors.push({
            error: 'no_valid_contact',
            leadId,
            contact_email: 'N/A',
            details: noContactError,
            timestamp: new Date().toISOString()
          });
          return { success: false, error: noContactError };
        } catch (logError) {
          console.error('Error logging failed attempt:', logError);
          return { success: false, error: 'Failed to log attempt' };
        }
      }

      // Process the lead with error handling
      try {
        // Log initial attempt
        if (logId === null) {
          try {
            logId = await logInitialAttempt(supabase, {
              contact_name: contactName,
              contact_email: contactEmail,
              email_status: 'PENDING',
              lead_id: leadId
            });
          } catch (logError) {
            console.error('Error logging initial attempt:', logError);
            return { success: false, error: 'Failed to log initial attempt' };
          }
        }

        // Rest of the processLead function remains the same
      } catch (error) {
        console.error('Error processing lead:', error);
        return { success: false, error: 'Failed to process lead' };
      }
    };

    // Rest of the handler function remains the same
  } catch (error) {
    console.error('Error in handler:', error);
    return res.status(500).json({
      success: false,
      });
      processingErrors.push({
        error: 'no_valid_contact',
        leadId,
        contact_email: 'N/A',
        details: noContactError,
        timestamp: new Date().toISOString()
      });
      return { success: false, error: noContactError };
    } catch (logError) {
      console.error('Error logging failed attempt:', logError);
      return { success: false, error: 'Failed to log attempt' };
    }
      message: 'Internal server error',
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

export default handler;
