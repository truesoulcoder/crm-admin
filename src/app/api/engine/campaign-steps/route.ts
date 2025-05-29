import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

import { supabaseServerClient } from '@/lib/supabase/server';

// Initialize Supabase admin client with service role
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Type definitions for campaign steps
interface CampaignStep {
  id?: string;
  campaign_id: string;
  step_number: number;
  action_type: 'email' | 'delay' | 'other';
  template_id?: string | null;
  delay_days?: number;
  delay_hours?: number;
  subject_template?: string | null;
  created_at?: string;
  updated_at?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Authenticate the request
  const supabase = supabaseServerClient;
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { method, query, body } = req;
  const campaignId = query.campaignId as string;
  const stepId = query.stepId as string | undefined;

  // Validate campaign ID
  if (!campaignId) {
    return res.status(400).json({ error: 'Campaign ID is required' });
  }

  try {
    switch (method) {
      case 'GET':
        return handleGetSteps(campaignId, stepId, res);
      case 'POST':
        return handleCreateStep(campaignId, body, res);
      case 'PUT':
        if (!stepId) {
          return res.status(400).json({ error: 'Step ID is required for update' });
        }
        return handleUpdateStep(campaignId, stepId, body, res);
      case 'DELETE':
        if (!stepId) {
          return res.status(400).json({ error: 'Step ID is required for deletion' });
        }
        return handleDeleteStep(campaignId, stepId, res);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error: any) {
    console.error('Campaign steps API error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}

// Get all steps for a campaign or a specific step if stepId is provided
async function handleGetSteps(
  campaignId: string,
  stepId: string | undefined,
  res: NextApiResponse
) {
  try {
    if (stepId) {
      // Get a specific step
      const { data, error } = await supabaseAdmin
        .from('campaign_steps')
        .select('*')
        .eq('id', stepId)
        .eq('campaign_id', campaignId)
        .single();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Step not found' });

      return res.status(200).json(data);
    } else {
      // Get all steps for the campaign
      const { data, error } = await supabaseAdmin
        .from('campaign_steps')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('step_number');

      if (error) throw error;
      return res.status(200).json(data || []);
    }
  } catch (error: any) {
    throw new Error(`Failed to get steps: ${error.message}`);
  }
}

// Create a new step for a campaign
async function handleCreateStep(
  campaignId: string,
  stepData: Partial<CampaignStep>,
  res: NextApiResponse
) {
  try {
    // Validate required fields
    if (!stepData.action_type) {
      return res.status(400).json({ error: 'Action type is required' });
    }

    // Get the next step number
    const { count } = await supabaseAdmin
      .from('campaign_steps')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    const newStep: Partial<CampaignStep> = {
      ...stepData,
      campaign_id: campaignId,
      step_number: (count || 0) + 1,
    };

    const { data, error } = await supabaseAdmin
      .from('campaign_steps')
      .insert([newStep])
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (error: any) {
    throw new Error(`Failed to create step: ${error.message}`);
  }
}

// Update an existing step
async function handleUpdateStep(
  campaignId: string,
  stepId: string,
  updates: Partial<CampaignStep>,
  res: NextApiResponse
) {
  try {
    // Verify the step exists and belongs to the campaign
    const { data: existingStep, error: fetchError } = await supabaseAdmin
      .from('campaign_steps')
      .select('id')
      .eq('id', stepId)
      .eq('campaign_id', campaignId)
      .single();

    if (fetchError || !existingStep) {
      return res.status(404).json({ error: 'Step not found' });
    }

    // Don't allow updating campaign_id or id
    const { campaign_id, id, ...safeUpdates } = updates;

    const { data, error } = await supabaseAdmin
      .from('campaign_steps')
      .update({
        ...safeUpdates,
        updated_at: new Date().toISOString()
      })
      .eq('id', stepId)
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json(data);
  } catch (error: any) {
    throw new Error(`Failed to update step: ${error.message}`);
  }
}

// Delete a step
async function handleDeleteStep(
  campaignId: string,
  stepId: string,
  res: NextApiResponse
) {
  try {
    // Verify the step exists and belongs to the campaign
    const { data: existingStep, error: fetchError } = await supabaseAdmin
      .from('campaign_steps')
      .select('id, step_number')
      .eq('id', stepId)
      .eq('campaign_id', campaignId)
      .single();

    if (fetchError || !existingStep) {
      return res.status(404).json({ error: 'Step not found' });
    }

    // Delete the step
    const { error: deleteError } = await supabaseAdmin
      .from('campaign_steps')
      .delete()
      .eq('id', stepId);

    if (deleteError) throw deleteError;

    // Reorder remaining steps
    await supabaseAdmin.rpc('reorder_steps_after_delete', {
      p_campaign_id: campaignId,
      p_deleted_step_number: existingStep.step_number
    });

    return res.status(204).end();
  } catch (error: any) {
    throw new Error(`Failed to delete step: ${error.message}`);
  }
}
