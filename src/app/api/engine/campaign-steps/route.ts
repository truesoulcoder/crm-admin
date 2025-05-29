import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/utils/supabase-admin';

// Create a server client for authentication
function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, ...options }) => {
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              // Handle error if needed
            }
          });
        },
      },
    }
  );
}

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

// GET - Get all steps for a campaign or a specific step
export async function GET(
  request: Request,
  { params }: { params: { campaignId: string[] } }
) {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [campaignId, stepId] = params.campaignId || [];
    
    if (!campaignId) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      );
    }

    if (stepId) {
      // Get a specific step
      const { data, error } = await supabaseAdmin
        .from('campaign_steps')
        .select('*')
        .eq('id', stepId)
        .eq('campaign_id', campaignId)
        .single();

      if (error) throw error;
      if (!data) {
        return NextResponse.json(
          { error: 'Step not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(data);
    } else {
      // Get all steps for the campaign
      const { data, error } = await supabaseAdmin
        .from('campaign_steps')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('step_number');

      if (error) throw error;
      return NextResponse.json(data || []);
    }
  } catch (error: any) {
    console.error('GET Campaign Steps Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get steps' },
      { status: 500 }
    );
  }
}

// POST - Create a new step for a campaign
export async function POST(
  request: Request,
  { params }: { params: { campaignId: string[] } }
) {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [campaignId] = params.campaignId || [];
    
    if (!campaignId) {
      return NextResponse.json(
        { error: 'Campaign ID is required' },
        { status: 400 }
      );
    }

    const stepData = await request.json() as Partial<CampaignStep>;

    // Validate required fields
    if (!stepData.action_type) {
      return NextResponse.json(
        { error: 'Action type is required' },
        { status: 400 }
      );
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
    return NextResponse.json(data, { status: 201 });

  } catch (error: any) {
    console.error('Create Step Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create step' },
      { status: 500 }
    );
  }
}

// PUT - Update an existing step
export async function PUT(
  request: Request,
  { params }: { params: { campaignId: string[] } }
) {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [campaignId, stepId] = params.campaignId || [];
    
    if (!campaignId || !stepId) {
      return NextResponse.json(
        { error: 'Campaign ID and Step ID are required' },
        { status: 400 }
      );
    }

    const updates = await request.json() as Partial<CampaignStep>;

    // Verify the step exists and belongs to the campaign
    const { data: existingStep, error: fetchError } = await supabaseAdmin
      .from('campaign_steps')
      .select('id')
      .eq('id', stepId)
      .eq('campaign_id', campaignId)
      .single();

    if (fetchError || !existingStep) {
      return NextResponse.json(
        { error: 'Step not found' },
        { status: 404 }
      );
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
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Update Step Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update step' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a step
export async function DELETE(
  request: Request,
  { params }: { params: { campaignId: string[] } }
) {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [campaignId, stepId] = params.campaignId || [];
    
    if (!campaignId || !stepId) {
      return NextResponse.json(
        { error: 'Campaign ID and Step ID are required' },
        { status: 400 }
      );
    }

    // Verify the step exists and belongs to the campaign
    const { data: existingStep, error: fetchError } = await supabaseAdmin
      .from('campaign_steps')
      .select('id, step_number')
      .eq('id', stepId)
      .eq('campaign_id', campaignId)
      .single();

    if (fetchError || !existingStep) {
      return NextResponse.json(
        { error: 'Step not found' },
        { status: 404 }
      );
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

    return new Response(null, { status: 204 });

  } catch (error: any) {
    console.error('Delete Step Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete step' },
      { status: 500 }
    );
  }
}