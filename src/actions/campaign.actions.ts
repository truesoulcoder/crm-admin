'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { z } from 'zod';

import { createAdminServerClient } from '@/lib/supabase/server'; // Correct alias path
import { Database } from '@/types/supabase';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

// supabaseUrl, supabaseServiceRoleKey, and supabaseAnonKey are now defined within client creation functions
// or are environment variables accessed directly by those functions.

export const CampaignStatusEnum = z.enum([
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'STOPPING',
  'STOPPED',
  'COMPLETED',
  'ARCHIVED',
]);
export type CampaignStatus = z.infer<typeof CampaignStatusEnum>;

export const ScheduleTypeEnum = z.enum(['immediate', 'scheduled']);
export type ScheduleType = z.infer<typeof ScheduleTypeEnum>;

export const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required.'),
  description: z.string().optional().nullable(),
  status: CampaignStatusEnum.default('DRAFT'),
  email_template_id: z.string().uuid('Invalid email template ID.').optional().nullable(),
  pdf_template_id: z.string().uuid('Invalid PDF template ID.').optional().nullable(), // Formerly document_template_id
  target_market_region: z.string().optional().nullable(), // Changed from UUID to string
  lead_status_trigger: z.string().optional().nullable(),
  daily_sending_limit_per_sender: z.number().int().positive('Daily sending limit must be a positive integer.').optional().nullable(), // Matched DB name, made nullable for explicit absence vs default
  total_quota: z.number().int().positive('Total quota must be a positive integer.').optional().nullable(),
  // Fields not in DB table, but kept for form logic if needed elsewhere (will be excluded from insert):
  schedule_type: ScheduleTypeEnum.default('immediate'),
  start_date: z.string().datetime({ message: 'Invalid start date format.' }).optional().nullable(),
  end_date: z.string().datetime({ message: 'Invalid end date format.' }).optional().nullable(),
});

// Type for form state, using null for initial/empty state
export type CampaignFormFields = {
  message: string;
  fields?: Record<string, string>;
  issues?: string[];
};
export type CampaignFormState = CampaignFormFields | null;

// Helper to get Supabase client with new cookie handling for server actions
async function getSupabaseUserClient() { // Made async
  const cookieStoreActual = await cookies(); // Await the cookies() call

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!supabaseUrl) throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL for user client");
  if (!supabaseAnonKey) throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY for user client");

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          // Use the resolved cookie store
          return cookieStoreActual.getAll().map(cookie => ({ name: cookie.name, value: cookie.value }));
        },
        async setAll(cookiesToSet) { // Made async
          // For setting, await cookies() to get the actual cookie store with the .set method
          const cookieSetter = await cookies(); 
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieSetter.set(name, value, options as CookieOptions);
            } catch (error) {
              console.warn(`User client: Failed to set cookie '${name}':`, error);
            }
          });
        },
      },
    }
  );
}

// Server Action: Create Campaign
export async function createCampaign(
  prevState: CampaignFormState, // prevState is CampaignFormFields | null
  formData: FormData
): Promise<CampaignFormState> { // Returns CampaignFormFields | null
  const supabaseUserClient = await getSupabaseUserClient(); // Await the async helper

  const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();
  if (authError || !user) {
    return {
      message: 'Authentication failed: You must be logged in to create a campaign.',
      issues: ['User not authenticated.']
    };
  }
  const userId = user.id;

  const preprocessFormDataField = (value: FormDataEntryValue | null): string | undefined => {
    if (value === null || String(value).trim() === '') return undefined;
    return String(value);
  };

  const preprocessFormDataNumberField = (value: FormDataEntryValue | null): number | undefined => {
    const strValue = preprocessFormDataField(value);
    if (strValue === undefined) return undefined;
    const num = parseInt(strValue, 10);
    return isNaN(num) ? undefined : num;
  };

  const rawData = {
    name: preprocessFormDataField(formData.get('name')),
    description: preprocessFormDataField(formData.get('description')),
    status: preprocessFormDataField(formData.get('status')) as CampaignStatus | undefined,
    email_template_id: preprocessFormDataField(formData.get('email_template_id')),
    pdf_template_id: preprocessFormDataField(formData.get('pdf_template_id')), // Formerly document_template_id
    target_market_region: preprocessFormDataField(formData.get('target_market_region')), 
    lead_status_trigger: preprocessFormDataField(formData.get('lead_status_trigger')),
    daily_sending_limit_per_sender: preprocessFormDataNumberField(formData.get('daily_sending_limit_per_sender')),
    total_quota: preprocessFormDataNumberField(formData.get('total_quota')),
    // Fields not in DB table, but kept for form logic if needed elsewhere:
    schedule_type: preprocessFormDataField(formData.get('schedule_type')) as ScheduleType | undefined,
    start_date: preprocessFormDataField(formData.get('start_date')),
    end_date: preprocessFormDataField(formData.get('end_date')),
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

  // Prepare data for insertion, ensuring it matches DB schema
  const campaignInsertData = {
    user_id: userId,
    name: validated.data.name, // Required
    description: validated.data.description ?? null,
    status: validated.data.status, // Will have Zod default 'DRAFT'
    email_template_id: validated.data.email_template_id ?? null,
    pdf_template_id: validated.data.pdf_template_id ?? null,
    target_market_region: validated.data.target_market_region ?? null,
    lead_status_trigger: validated.data.lead_status_trigger ?? null,
    daily_sending_limit_per_sender: validated.data.daily_sending_limit_per_sender ?? null,
    total_quota: validated.data.total_quota ?? null,
    // schedule_type, start_date, end_date are not in the 'campaigns' table based on provided DDL
    // and are thus excluded from campaignInsertData.
  };

  const supabaseAdmin = await createAdminServerClient(); // Use the centralized admin client

  const { data: insertedCampaign, error: insertError } = await supabaseAdmin
    .from('campaigns')
    .insert(campaignInsertData)
    .select() // Optionally select the inserted row to confirm
    .single(); // If you expect only one row to be inserted and want it back

  if (insertError) {
    console.error('Error creating campaign:', insertError);
    return {
      message: `Database error: ${insertError.message}`,
      issues: [`Failed to save campaign. Code: ${insertError.code}`]
    };
  }

  // console.log('Campaign created successfully:', insertedCampaign); // Optional: log inserted data
  revalidatePath('/campaigns'); 

  return {
    message: 'Campaign created successfully!',
  };
}

// TODO: Implement updateCampaign
// TODO: Implement deleteCampaign
// TODO: Implement startCampaign
// TODO: Implement stopCampaign
