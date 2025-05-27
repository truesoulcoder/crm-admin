import { SupabaseClient } from '@supabase/supabase-js';

import { getGmailService, getSupabaseClient, isValidEmail } from './_utils';
import { STATUS_KEY, logCampaignAttempt } from './email-metrics';
import { sendConfiguredEmail, type EmailOptions } from './send-email';

import type { Tables, Json } from '@/types/db_types'; 
import type { NextApiRequest, NextApiResponse } from 'next'; 

// #region Type Interfaces
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
  campaign_id?: string;
  [key: string]: any; 
}

interface CampaignDetails {
  campaign_id: string;
  name: string;
  dry_run: boolean;
  sender_quota: number;
  min_interval_seconds: number;
  max_interval_seconds: number;
  daily_limit: number;
  market_region?: string;
}

interface SenderState {
  id: string;
  name: string;
  email: string;
  daily_limit: number;
  in_memory_sent_today: number; // Tracks sends during this specific run, initialized from DB
  can_send_after_timestamp: number; // Timestamp (ms) when this sender can send next
}

interface StartCampaignRequestBody {
  campaign_id: string;
  template_id: string;
  market_region?: string | null;
  selected_sender_ids?: string[];
  selected_lead_ids?: string[];
  dry_run?: boolean;
  sender_quota?: number;
  min_interval_seconds?: number;
  max_interval_seconds?: number;
}

interface Lead {
  id: string;
  email: string;
}

interface ActiveSenderState {
  id: string;
  quotaUsed: number;
  cooldownUntil: Date;
}

interface CampaignAttempt {
  campaign_id: string;
  sender_email?: string;
  success?: boolean;
  error_message?: string;
}

// #endregion
// region Fetch Settings
export async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  let campaignError: Error | null = null;
  const processingErrors: Array<{error: string; timestamp: string; leadId?: string; contact_email?: string}> = [];
  const leads: Lead[] = [];
  const successCount = 0;
  const failureCount = 0;
  try {
    // ======================
    // STEP 1: INITIALIZATION
    // ======================
    const reqBody: StartCampaignRequestBody = req.body;
    const supabase = getSupabaseClient();
    const selected_sender_ids = reqBody.selected_sender_ids || [];

    // Pre-check campaign status
    const { data: campaignStatus, error: statusError } = await supabase
      .from('campaigns')
      .select('status')
      .eq('id', reqBody.campaign_id)
      .single();

    if (statusError || !campaignStatus || campaignStatus.status !== STATUS_KEY.ACTIVE) {
      console.error('CAMPAIGN_STATUS_CHECK_FAILED:', statusError);
      return res.status(400).json({
        success: false,
        message: 'Campaign not active or does not exist',
        errorCode: 'CAMPAIGN_INACTIVE'
      });
    }

    // ===========================
    // STEP 2: REQUEST VALIDATION
    // ===========================
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // ================================
    // STEP 3: LOAD CAMPAIGN SETTINGS
    // ================================
    const { 
      campaign_id, 
      market_region, 
      selected_lead_ids, 
      dry_run,
      sender_quota = 100, 
      min_interval_seconds: req_min_interval_seconds,
      max_interval_seconds: req_max_interval_seconds,
    } = reqBody;

    const isDryRun = dry_run;
    
    console.log(`ELI5_CAMPAIGN_HANDLER: Campaign settings: dryRun=${isDryRun}, senderQuota=${sender_quota}, minInterval=${req_min_interval_seconds}s, maxInterval=${req_max_interval_seconds}s, selectedSenders=${selected_sender_ids?.join(',') || 'ALL'}`);

    const currentCampaignId = campaign_id || 'adhoc-campaign';

    console.log(`ELI5_CAMPAIGN_HANDLER: Received request to ${isDryRun ? 'DRY RUN' : 'START'} campaign (ID: ${currentCampaignId}) at ${new Date().toISOString()}`);

    console.log(`ELI5_CAMPAIGN_HANDLER: Received request to ${isDryRun ? 'DRY RUN' : 'START'} campaign (ID: ${currentCampaignId}) with settings:\n` +
      `- Intervals: ${req_min_interval_seconds}s-${req_max_interval_seconds}s\n` +
      `- Daily Limit: ${sender_quota}\n` +
      `- Market Region: ${market_region || 'Any'}`);

    const { data: campaignDetails, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('campaign_id', currentCampaignId)
      .single();

    if (error) {
      campaignError = error;
      console.error('Campaign fetch error:', campaignError);
      return res.status(500).json({ error: 'Failed to fetch campaign details' });
    }

    if (!campaignDetails) {
      throw new Error(`Campaign ${currentCampaignId} not found`);
    }

    // Apply settings with request body overrides
    const minIntervalSeconds = req_min_interval_seconds ?? campaignDetails.min_interval_seconds;
    const maxIntervalSeconds = req_max_interval_seconds ?? campaignDetails.max_interval_seconds;

    console.log(`ELI5_CAMPAIGN_HANDLER: Received request to ${isDryRun ? 'DRY RUN' : 'START'} campaign (ID: ${currentCampaignId}) with settings:\n` +
      `- Intervals: ${minIntervalSeconds}s-${maxIntervalSeconds}s\n` +
      `- Daily Limit: ${campaignDetails.daily_limit}\n` +
      `- Market Region: ${campaignDetails.market_region || 'Any'}`);

    // ... rest of the code ...
// endregion


// #region Fetch Senders
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
// #endregion
// region Fetch Leads
    // ================================
    // STEP 5: FETCH LEADS
    // ================================
    const { data: campaignData, error: campaignError } = await supabase
      .from('campaigns')
      .select('market_region')
      .eq('campaign_id', currentCampaignId)
      .single();

    if (campaignError || !campaignData?.market_region) {
      throw new Error('Invalid campaign or missing market region');
    }

    const leadsTable = `${campaignData.market_region.toLowerCase()}_fine_cut_leads`;
    let offset = 0;
    const limit = 1;
    let hasMore = true;

    // Initialize sender quotas once
    const senderQuotas = new Map<string, number>();
    const senders = await fetchAndPrepareSenders(supabase, selected_sender_ids || []);

    while (hasMore) {
      const { data } = await supabase
        .from(leadsTable)
        .select('*')
        .order('id', { ascending: true })
        .range(offset, offset + limit - 1);

      if (!data?.length) break;

      let currentSenderIndex = 0;

      for (const lead of data) {
        const leadId = lead.id;
        const contactEmail = lead.email;
        const { data: logEntry, error: logError } = await supabase
          .from('email_logs')
          .insert({
            campaign_id: currentCampaignId,
            contact_email: contactEmail,
            status: 'pending'
          })
          .select('id');

        if (logError) throw logError;
        const logId = logEntry[0].id;

        // ... processing loop ...

        try {
          await sendConfiguredEmail({
            senderId: senders[currentSenderIndex].id,
            leadEmail: contactEmail,
            templateId: reqBody.template_id
          });
          await updateEmailLogStatus(logId, 'sent');
        } catch (error) {
          await updateEmailLogStatus(logId, 'failed');
        }

        // Update quota
        senderQuotas.set(senders[currentSenderIndex].id, (senderQuotas.get(senders[currentSenderIndex].id) || 0) + 1);
        currentSenderIndex++;
      }

      offset += limit;
      hasMore = data.length === limit;
    }
// endregion
// region active engine loop

    // Active engine loop implementation
    const activeSenders: ActiveSenderState[] = selected_sender_ids.map(id => ({
      id,
      quotaUsed: 0,
      cooldownUntil: new Date(0)
    }));

    let hasMoreLeads = true;

    async function fetchNextLead() {
      const { data } = await supabase
        .from(leadsTable)
        .select('*')
        .order('id', { ascending: true })
        .range(offset, offset + limit - 1);
      offset += limit;
      return data?.[0];
    }

    function getRandomInterval(min: number, max: number): number {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    while (hasMoreLeads) {
      const availableSender = activeSenders.find(s => 
        s.quotaUsed < sender_quota && 
        s.cooldownUntil <= new Date()
      );
      
      if (!availableSender) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      const lead = await fetchNextLead();
      try {
        await sendConfiguredEmail({
          senderId: availableSender.id,
          leadEmail: lead.email,
          templateId: reqBody.template_id
        });
        await logCampaignAttempt({
          campaign_id: currentCampaignId,
          sender_email: availableSender.id,
          success: true,
        });
        await updateEmailLogStatus(logId, 'sent');
      } catch (error) {
        await logCampaignAttempt({
          campaign_id: currentCampaignId,
          sender_email: availableSender.id,
          success: false,
          error_message: String(error)
        });
        await updateEmailLogStatus(logId, 'failed');
      }
      
      availableSender.quotaUsed++;
      availableSender.cooldownUntil = new Date(
        Date.now() + getRandomInterval(minIntervalSeconds, maxIntervalSeconds) * 1000
      );

      // Update status calls:
      await updateEmailLogStatus(logId, 'sent', new Date().toISOString());
    }
// endregion
    // region logging kpi
    // ========================
    // STEP 7: FINALIZATION
    // ========================
    const totalAttempted = successCount + failureCount;
    const summaryMessage = `Campaign run completed. Attempted: ${totalAttempted}, Sent: ${successCount}, Failed: ${failureCount}.`;
    
    console.log(`ELI5_CAMPAIGN_HANDLER: ${summaryMessage}`);
    console.log('ELI5_CAMPAIGN_HANDLER: Processing Errors:', JSON.stringify(processingErrors, null, 2));

    // Log overall campaign run status (optional, could be a separate table or log entry)
    // Example: await logCampaignRunSummary(supabase, { campaign_id, campaign_run_id, successCount, failureCount, totalAttempted, processingErrors });

    return res.status(200).json({
      success: true,
      message: summaryMessage,
      campaign_id: currentCampaignId,
      summary: {
        total_leads_processed_in_batch: leads.length, // Number of leads fetched for this batch
        emails_sent_successfully: successCount,
        emails_failed_to_send: failureCount,
        processing_errors_details: processingErrors || [] // Initialize empty array if processingErrors is undefined
      }
    });
    // ========================
  } catch (err) {
    const campaignError = new Error('Failed to start campaign');
    console.error('ELI5_CAMPAIGN_HANDLER: Uncaught exception:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err instanceof Error ? err.message : 'Unknown error',
      processing_errors: processingErrors
    });
  }
}

export default handler;

// region Email Log Functions
async function createEmailLogEntry(entry: Partial<Eli5EmailLogEntry>): Promise<number | null> {
  const supabase = getSupabaseClient();
  try {
    const { data: logEntry, error: logError } = await supabase
      .from('email_logs')
      .insert([entry])
      .select('id');

    if (logError) throw logError;
    return logEntry[0].id;
  } catch (e: unknown) {
    let errorMessage = 'Unknown error creating email log entry';
    let errorStack: string | undefined;
    if (e instanceof Error) {
      errorMessage = e.message;
      errorStack = e.stack;
    } else if (typeof e === 'string') {
      errorMessage = e;
    }
    console.error('Error in createEmailLogEntry:', errorMessage, errorStack);
    return null;
  }
}

async function updateEmailLogStatus(logId: number, status: string, timestamp?: string): Promise<void> {
  const supabase = getSupabaseClient();
  try {
    const { error } = await supabase
      .from('email_logs')
      .update({ status, email_sent_at: timestamp })
      .eq('id', logId);

    if (error) {
      console.error('Error updating email log status:', error);
    }
  } catch (e: unknown) {
    let errorMessage = 'Unknown error updating email log status';
    let errorStack: string | undefined;
    if (e instanceof Error) {
      errorMessage = e.message;
      errorStack = e.stack;
    } else if (typeof e === 'string') {
      errorMessage = e;
    }
    console.error('Error in updateEmailLogStatus:', errorMessage, errorStack);
  }
}
// endregion
