import { getAdminSupabaseClient } from '../services/supabaseAdminService';
import { renderTemplate } from './templateService';
import { generatePdfFromHtml } from './pdfService';
import { sendEmail } from './gmailService';
import { Campaign, CampaignJob, EmailTask, CampaignUserAllocation, NormalizedLead } from '../types/engine';

const supabase = getAdminSupabaseClient();

/**
 * Main loop to process a campaign.
 */
export async function processCampaign(campaignId: string) {
  // Fetch campaign with templates
  const { data: campaignData, error: campErr } = await supabase
    .from('campaigns')
    .select(`*, template:templates(id,subject,content), pdf_template:templates(id,content)`)
    .eq('id', campaignId)
    .single();
  if (campErr || !campaignData) throw new Error('Campaign not found');
  const campaign = campaignData;

  // Main processing loop
  while (true) {
    // Check campaign status
    const { data: statusRow } = await supabase.from('campaigns').select('status').eq('id', campaignId).single();
    if (statusRow?.status === 'STOPPING') {
      await supabase.from('campaigns').update({ status: 'STOPPED' }).eq('id', campaignId);
      break;
    }

    // Quota enforcement
    if (campaign.quota > 0) {
      const { count } = await supabase
        .from('campaign_jobs')
        .select('id', { count: 'exact' })
        .eq('campaign_id', campaignId)
        .eq('status', 'COMPLETED_SUCCESS');
      if (count! >= campaign.quota) {
        await supabase.from('campaigns').update({ status: 'COMPLETED' }).eq('id', campaignId);
        break;
      }
    }

    // Get processed lead IDs
    const { data: jobRows } = await supabase.from('campaign_jobs').select('lead_id').eq('campaign_id', campaignId) as { data: { lead_id: number }[] };
    const usedIds = jobRows?.map(r => r.lead_id) || [];

    // Select next lead
    const query = supabase.from('normalized_leads').select('*').limit(1);
    if (campaign.market_region) query.eq('market_region', campaign.market_region);
    if (usedIds.length) query.not('id', 'in', `(${usedIds.join(',')})`);
    const { data: leads } = await query as { data: NormalizedLead[] };
    if (!leads || leads.length === 0) {
      await supabase.from('campaigns').update({ status: 'COMPLETED' }).eq('id', campaignId);
      break;
    }

    const lead = leads[0];

    // Create job
    const { data: jobData } = await supabase.from('campaign_jobs').insert({ campaign_id: campaignId, lead_id: lead.id, status: 'PROCESSING', started_at: new Date().toISOString() }).single() as { data: CampaignJob };
    const jobId = jobData!.id;
    let jobErrors = false;

    // Iterate contact emails
    const contacts = [lead.contact1_email_1, lead.contact2_email_1, lead.contact3_email_1]
      .filter((e): e is string => !!e);
    for (const email of contacts) {
      // Pick user allocation
      const { data: allocs } = await supabase
        .from('campaign_user_allocations')
        .select('*')
        .eq('campaign_id', campaignId)
        .lt('sent_today', 'daily_quota')
        .order('total_sent', { ascending: true })
        .limit(1);
      const alloc = allocs?.[0];
      if (!alloc) break;

      // Draft email task
      const subject = renderTemplate(campaign.template.subject || '', lead);
      const body = renderTemplate(campaign.template.content || '', lead);
      const { data: task } = await supabase.from('email_tasks').insert({ campaign_job_id: jobId, assigned_user_id: alloc.user_id, contact_email: email, subject, body, status: 'SENDING' }).single() as { data: EmailTask };

      try {
        // Generate PDF if needed
        let attachments;
        if (campaign.pdf_template && campaign.pdf_template.content) {
          const pdfHtml = renderTemplate(campaign.pdf_template.content, lead);
          const pdfBuf = await generatePdfFromHtml(pdfHtml);
          attachments = [{ filename: 'attachment.pdf', content: pdfBuf }];
        }

        const res = await sendEmail(alloc.user_id, email, subject, body, attachments);

        // Update task
        await supabase.from('email_tasks').update({ status: res.success ? 'SENT' : 'FAILED_TO_SEND', gmail_message_id: res.messageId, error: res.error }).eq('id', task!.id);

        // Update allocation counts
        await supabase.from('campaign_user_allocations').update({ sent_today: alloc.sent_today + 1, total_sent: alloc.total_sent + 1 }).eq('id', alloc.id);

        if (!res.success) jobErrors = true;
      } catch (err) {
        jobErrors = true;
        console.error('Email send error:', err);
      }
    }

    // Complete job
    await supabase.from('campaign_jobs').update({ status: jobErrors ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED_SUCCESS', completed_at: new Date().toISOString() }).eq('id', jobId);
  }
}

/**
 * Starts a campaign: marks active and triggers processing asynchronously.
 */
export async function startCampaign(campaignId: string) {
  await supabase
    .from('campaigns')
    .update({ status: 'ACTIVE' })
    .eq('id', campaignId);
  processCampaign(campaignId).catch(error => {
    console.error('Campaign processing error:', error);
    // Optionally log to system_event_logs
  });
}

/**
 * Signals the campaign loop to stop after current job.
 */
export async function stopCampaign(campaignId: string) {
  await supabase
    .from('campaigns')
    .update({ status: 'STOPPING' })
    .eq('id', campaignId);
}
