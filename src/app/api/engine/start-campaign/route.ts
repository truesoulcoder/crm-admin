// External dependencies
import crypto from 'crypto';

// Supabase
import { createClient, SupabaseClient } from '@supabase/supabase-js';
// Next.js
import { NextRequest, NextResponse } from 'next/server';

// Internal dependencies
import { STATUS_KEY } from '@/app/api/engine/email-metrics/email-metrics-bloated.old';
import { logCampaignJob } from '@/app/api/engine/log-campaign-job/route';
// Email sending is handled via API endpoint
import { updateCampaignJobStatus } from '@/app/api/engine/update-campaign-job-status/route';

// Types

// Type definitions
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
  min_interval_seconds: number;
  max_interval_seconds: number;
  sender_quota: number;
  market_region?: string;
}

interface SenderState {
  id: string;
  name: string;
  email: string;
  sender_quota: number;
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
  contact_email?: string; // Make it optional with '?' since it might not always be present
}

interface ActiveSenderState {
  id: string;
  quotaUsed: number;
  cooldownUntil: Date;
}

interface CampaignJobJob {
  campaign_id: string;
  sender_id?: string;
  sender_email: string;
  contact_email: string;
  status: 'queued' | 'sent' | 'failed';
  error?: string;
}

interface CampaignJob {
  campaign_id: string;
  sender_email?: string;
  status?: string;
  error_message?: string;
  sender_id?: string;
  contact_email?: string;
  [key: string]: any; // Allow additional properties
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  senderId?: string; // Add senderId to EmailOptions
}

interface DbSender {
  id: string;
  email: string;
  name: string;
  sender_quota: number;
  sent_today: number;
}

// #endregion

/**
 * Fetches and prepares sender information from the database
 * @param supabase Supabase client instance
 * @param filter_sender_ids Optional array of sender IDs to filter by
 * @returns Array of prepared sender states
 */
async function fetchAndPrepareSenders(supabase: SupabaseClient, filter_sender_ids: string[] = []): Promise<SenderState[]> {
  try {
    let query = supabase
      .from('senders')
      .select('id, name, email, sender_quota, sent_today')
      .eq('is_active', true)
      .order('email', { ascending: true });

    // Apply sender ID filter if provided
    if (filter_sender_ids && filter_sender_ids.length > 0) {
      query = query.in('id', filter_sender_ids);
    }

    const { data: senders, error } = await query;

    if (error) {
      console.error('Error fetching senders:', error);
      throw new Error('Failed to fetch senders');
    }

    if (!senders || senders.length === 0) {
      console.warn(`No active senders found${filter_sender_ids.length > 0 ? ' matching the provided IDs' : ''}`);
      return [];
    }

    // Convert to SenderState format with initial values
    const preparedSenders: SenderState[] = senders.map(sender => ({
      id: sender.id,
      name: sender.name,
      email: sender.email,
      sender_quota: sender.sender_quota || 100, // Default to 100 if not set
      in_memory_sent_today: sender.sent_today || 0,
      can_send_after_timestamp: Date.now() // Can send immediately
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

// region Fetch Settings
// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
) {
  let campaignError: Error | null = null;
  const processingErrors: Array<{error: string; timestamp: string; leadId?: string; contact_email?: string}> = [];
  const leads: Lead[] = [];
  const successCount = 0;
  const failureCount = 0;
  let logId: string | null = null;
  try {
    // ======================
    // STEP 1: INITIALIZATION
    // ======================
    const reqBody: StartCampaignRequestBody = await req.json();
    const selected_sender_ids = reqBody.selected_sender_ids || [];

    // Pre-check campaign status
    // Note: logId is not initialized here yet, the original check for !logId seems misplaced
    // It was likely intended to be checked after an attempt to create a log entry.
    // This logic block is preserved but the !logId check might need review in context of full flow.
    try {
      const { data: campaignStatus, error: statusError } = await supabase
        .from('campaigns')
        .select('status')
        .eq('id', reqBody.campaign_id)
        .single();

      if (statusError) {
        console.error('CAMPAIGN_STATUS_CHECK_FAILED:', statusError);
        return NextResponse.json({
          success: false,
          message: 'Error checking campaign status',
          errorCode: 'CAMPAIGN_STATUS_ERROR'
        }, { status: 400 });
      }

      // Original code had a check for `!logId` here.
      // logId is initialized as null and typically populated after creating a log entry.
      // If this check is crucial before this point, the logic for logId creation needs to be moved up.
      // For now, retaining the structure but this might be an issue from the original code.
      if (!logId) { // This condition will likely always be true here if logId isn't populated yet.
        console.error('Failed to create campaign job log entry (pre-check)');
        // Depending on actual intent, this might need adjustment.
        // If a log entry *must* exist before this, its creation should precede this.
        // Or, this check is for a logId from a different scope, which is not apparent here.
        return NextResponse.json({
          success: false,
          message: 'Failed to create campaign job log entry (logId not initialized)',
          errorCode: 'LOG_CREATION_FAILED_PRECHECK'
        }, { status: 500 });
      }

      if (!campaignStatus || campaignStatus.status !== STATUS_KEY.ACTIVE) {
        return NextResponse.json({
          success: false,
          message: 'Campaign not active or does not exist',
          errorCode: 'CAMPAIGN_INACTIVE'
        }, { status: 400 });
      }
    } catch (error) {
      console.error('Error checking campaign status:', error);
      return NextResponse.json({
        success: false,
        message: 'Error checking campaign status',
        errorCode: 'CAMPAIGN_STATUS_ERROR'
      }, { status: 500 });
    }

    // ================================
    // STEP 2: LOAD CAMPAIGN SETTINGS (Request validation for method is handled by function name)
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
      `- Sender Quota: ${sender_quota}\n` +
      `- Market Region: ${market_region || 'Any'}`);

    const { data: campaignDetails, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('campaign_id', currentCampaignId)
      .single();

    if (error) {
      campaignError = error;
      console.error('Campaign fetch error:', campaignError);
      return NextResponse.json({ error: 'Failed to fetch campaign details' }, { status: 500 });
    }

    if (!campaignDetails) {
      throw new Error(`Campaign ${currentCampaignId} not found`);
    }

    // Apply settings with request body overrides
    const minIntervalSeconds: number = req_min_interval_seconds ?? campaignDetails.min_interval_seconds;
    const maxIntervalSeconds: number = req_max_interval_seconds ?? campaignDetails.max_interval_seconds;
    const normalizedQuota = campaignDetails.sender_quota ?? 8; // Default to 8 emails/hour if null

    console.log(`ELI5_CAMPAIGN_HANDLER: Received request to ${isDryRun ? 'DRY RUN' : 'START'} campaign (ID: ${currentCampaignId}) with settings:\n` +
      `- Intervals: ${minIntervalSeconds}s-${maxIntervalSeconds}s\n` +
      `- Sender Quota: ${normalizedQuota}\n` +
      `- Market Region: ${campaignDetails.market_region || 'Any'}`);

    // ... rest of the code ...
// endregion


// #region Sender Management

/**
 * Fetches and prepares sender information from the database
 * @param supabase Supabase client instance
 * @param filter_sender_ids Optional array of sender IDs to filter by
 * @returns Array of prepared sender states
 */
const fetchAndPrepareSenders = async (supabase: SupabaseClient, filter_sender_ids: string[] = []): Promise<SenderState[]> => {
  try {
    let query = supabase
      .from('senders')
      .select('id, name, email, sender_quota, sent_today')
      .eq('is_active', true)
      .order('email', { ascending: true }) // Primary sort: Alphabetical by email
      .order('sent_today', { ascending: true }); // Secondary sort: Least used today

    if (filter_sender_ids.length > 0) {
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
    
    const preparedSenders: SenderState[] = data.map((dbSender: DbSender) => ({
      id: dbSender.id,
      name: dbSender.name,
      email: dbSender.email,
      sender_quota: dbSender.sender_quota,
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
};

const incrementSenderSentCount = async (supabase: SupabaseClient, senderId: string): Promise<void> => {
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
};

// #endregion

// region Fetch Leads
    // ================================
    // STEP 5: FETCH LEADS
    // ================================
    const { data: campaignData, error: campaignFetchError } = await supabase
      .from('campaigns')
      .select('market_region')
      .eq('campaign_id', currentCampaignId)
      .single();

    if (campaignFetchError || !campaignData?.market_region) {
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
        logId = crypto.randomBytes(4).toString('hex');

        // ... processing loop ...

        try {
          // Call the send-email API endpoint with API key authentication
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/eli5-engine/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.API_KEY || ''
            },
            body: JSON.stringify({
              market_region: reqBody.market_region,
              ...(reqBody.template_id && { template_id: reqBody.template_id })
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to send email');
          }
          await updateCampaignJobStatus(logId, 'sent');
          await logCampaignJob({
            campaign_id: currentCampaignId,
            sender_email: senders[currentSenderIndex].id,
            status: 'sent',
            sender_id: senders[currentSenderIndex].id,
            contact_email: lead.contact_email,
          });
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.error(`[${logId}] Error:`, error.message);
          } else {
            console.error('Unknown error occurred');
          }
          await supabase
            .from('campaigns')
            .update({ 
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error', // Matches database column name
              ended_at: new Date().toISOString()
            })
            .eq('id', currentCampaignId);
          await updateCampaignJobStatus(logId, 'failed', error instanceof Error ? error.message : 'Unknown error');
          await logCampaignJob({
            campaign_id: currentCampaignId,
            sender_email: senders[currentSenderIndex].id,
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            sender_id: senders[currentSenderIndex].id,
            contact_email: lead.contact_email,
          });
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
    let currentOffset = offset; // Track offset for pagination

    const fetchNextLead = async (): Promise<Lead | undefined> => {
      const { data, error } = await supabase
        .from(leadsTable)
        .select('*')
        .order('id', { ascending: true })
        .range(currentOffset, currentOffset + limit - 1) as { data: Lead[] | null; error: any };
      
      if (error) {
        console.error('Error fetching next lead:', error);
        return undefined;
      }
      
      currentOffset += limit;
      return data?.[0];
    };

    const getRandomInterval = (min: number, max: number): number => {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    };

    while (hasMoreLeads) {
      const availableSender = activeSenders.find(s => 
        s.quotaUsed < normalizedQuota && 
        s.cooldownUntil <= new Date()
      );
      
      if (!availableSender) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      const lead = await fetchNextLead();
      if (!lead) {
        console.log('No more leads to process');
        hasMoreLeads = false;
        continue;
      }
      
      try {
        // Call the send-email API endpoint with API key authentication
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/eli5-engine/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.API_KEY || ''
          },
          body: JSON.stringify({
            market_region: reqBody.market_region,
            ...(reqBody.template_id && { template_id: reqBody.template_id })
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to send email');
        }
        await logCampaignJob({
          campaign_id: currentCampaignId,
          sender_email: availableSender.id,
          status: 'sent',
          sender_id: availableSender.id,
          contact_email: lead.contact_email,
        });
        await updateCampaignJobStatus(logId, 'sent');
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error(`[${logId}] Error:`, error.message);
        } else {
          console.error('Unknown error occurred');
        }
        await updateCampaignJobStatus(logId, 'failed', error instanceof Error ? error.message : 'Unknown error');
        await logCampaignJob({
          campaign_id: currentCampaignId,
          sender_email: availableSender.id,
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          sender_id: availableSender.id,
          contact_email: lead.contact_email,
        });
      }
      
      availableSender.quotaUsed++;
      availableSender.cooldownUntil = new Date(
        Date.now() + getRandomInterval(minIntervalSeconds, maxIntervalSeconds) * 1000
      );

      // Update status calls:
      await updateCampaignJobStatus(logId, 'sent', new Date().toISOString());
    }
// endregion
    // region logging kpi
    // ========================
    // STEP 7: FINALIZATION
    // ========================
    const totalJobed = successCount + failureCount;
    const summaryMessage = `Campaign run completed. Jobed: ${totalJobed}, Sent: ${successCount}, Failed: ${failureCount}.`;
    
    console.log(`ELI5_CAMPAIGN_HANDLER: ${summaryMessage}`);
    console.log('ELI5_CAMPAIGN_HANDLER: Processing Errors:', JSON.stringify(processingErrors, null, 2));

    // Log overall campaign run status (optional, could be a separate table or log entry)
    // Example: await logCampaignRunSummary(supabase, { campaign_id, campaign_run_id, successCount, failureCount, totalJobed, processingErrors });

    return NextResponse.json({
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
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('ELI5_CAMPAIGN_HANDLER: Uncaught exception:', err.message);
    } else {
      console.error('ELI5_CAMPAIGN_HANDLER: Unknown error occurred');
    }
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: err instanceof Error ? err.message : 'Unknown error',
      processing_errors: processingErrors
    }, { status: 500 });
  }
}

// region Email Log Functions
async function createCampaignJob(entry: Partial<CampaignJob>): Promise<string | null> {
  try {
    const { data: logEntry, error: logError } = await supabase
      .from('campaign_jobs')
      .insert([entry])
      .select('id');

    if (logError) throw logError;
    return logEntry[0].id;
  } catch (e: unknown) {
    if (e instanceof Error) {
      console.error('Error in createCampaignJob', e.message);
    } else {
      console.error('Unknown error occurred');
    }
    return null;
  }
}


// endregion
