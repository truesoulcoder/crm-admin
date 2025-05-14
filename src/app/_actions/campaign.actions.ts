'use server';

import { z } from 'zod';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { Database } from '@/types_db'; // Assuming this is your generated Supabase types path

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Define Zod enums for status and schedule_type
export const CampaignStatusEnum = z.enum([
  'draft',
  'active',
  'paused',
  'completed',
  'archived',
]);
export type CampaignStatus = z.infer<typeof CampaignStatusEnum>;

export const ScheduleTypeEnum = z.enum(['immediate', 'scheduled']);
export type ScheduleType = z.infer<typeof ScheduleTypeEnum>;

// Zod schema for campaign creation and updates
// For creation, user_id is added programmatically. For updates, id is required.
export const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required.'),
  description: z.string().optional(),
  target_market_region_id: z.string().uuid('Invalid market region ID.').optional().nullable(),
  document_template_id: z.string().uuid('Invalid document template ID.').optional().nullable(),
  sender_id: z.string().uuid('Invalid sender ID.').optional().nullable(),
  status: CampaignStatusEnum.default('draft'),
  schedule_type: ScheduleTypeEnum.default('immediate'),
  start_date: z.string().datetime({ message: 'Invalid start date format.' }).optional().nullable(),
  end_date: z.string().datetime({ message: 'Invalid end date format.' }).optional().nullable(),
  daily_send_limit: z.number().int().positive('Daily send limit must be a positive number.').optional().default(100),
});

export type CampaignFormState = {
  message: string;
  fields?: Record<string, string>;
  issues?: string[];
} | undefined;

// Helper to get Supabase client for server actions
function getSupabaseClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }); },
        remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }); },
      },
    }
  );
}

// Server Action: Create Campaign
export async function createCampaign(
  prevState: CampaignFormState,
  formData: FormData
): Promise<CampaignFormState> {
  const supabase = getSupabaseClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      message: 'Authentication failed: You must be logged in to create a campaign.',
      issues: ['User not authenticated.']
    };
  }
  const userId = user.id;

  // Extract data from FormData
  const rawData = {
    name: formData.get('name'),
    description: formData.get('description'),
    target_market_region_id: formData.get('target_market_region_id') || null, // Ensure null if empty
    document_template_id: formData.get('document_template_id') || null,
    sender_id: formData.get('sender_id') || null,
    status: formData.get('status'),
    schedule_type: formData.get('schedule_type'),
    start_date: formData.get('start_date') || null,
    end_date: formData.get('end_date') || null,
    daily_send_limit: formData.get('daily_send_limit') ? parseInt(formData.get('daily_send_limit') as string, 10) : undefined,
  };

  const validated = campaignSchema.safeParse(rawData);

  if (!validated.success) {
    const fieldErrors: Record<string, string> = {};
    validated.error.issues.forEach(issue => {
      if (issue.path.length > 0) {
        fieldErrors[issue.path[0].toString()] = issue.message;
      }
    });
    return {
      message: 'Validation failed. Please check the form fields.',
      fields: fieldErrors,
      issues: validated.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`),
    };
  }

  const campaignData = {
    ...validated.data,
    user_id: userId,
    // Ensure optional UUID fields are null if not provided or empty string
    target_market_region_id: validated.data.target_market_region_id === '' ? null : validated.data.target_market_region_id,
    document_template_id: validated.data.document_template_id === '' ? null : validated.data.document_template_id,
    sender_id: validated.data.sender_id === '' ? null : validated.data.sender_id,
    start_date: validated.data.start_date || null,
    end_date: validated.data.end_date || null,
  };

  // Use admin client for insert if RLS allows user based on user_id in the row
  // Or if you have specific policies that need service_role bypass for inserts by authenticated users into their own rows.
  // For now, assuming RLS is set up for users to insert into campaigns with their user_id.
  const supabaseAdmin = createServerClient<Database>(
    supabaseUrl, 
    supabaseServiceRoleKey, 
    { cookies: { /* ... cookie handling ... */ } } // Add cookie handling if service client needs it (usually not for service_role key)
  );

  const { error: insertError } = await supabaseAdmin
    .from('campaigns')
    .insert(campaignData);

  if (insertError) {
    console.error('Error creating campaign:', insertError);
    return {
      message: `Database error: ${insertError.message}`,
      issues: [`Failed to save campaign. Code: ${insertError.code}`]
    };
  }

  revalidatePath('/dashboard/campaigns'); // Or your campaigns list page
  // Potentially revalidatePath for other related paths if necessary

  return {
    message: 'Campaign created successfully!',
  };
}

// TODO: Implement updateCampaign
// TODO: Implement deleteCampaign
// TODO: Implement startCampaign
// TODO: Implement stopCampaign
