import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!supabaseServiceRoleKey) {
  throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY');
}

const supabaseAdmin = createSupabaseAdminClient(supabaseUrl, supabaseServiceRoleKey);

// Zod schema for validating PUT request body (all fields optional for partial updates)
const updateSenderSchema = z.object({
  name: z.string().min(1, { message: 'Sender name cannot be empty' }).optional(),
  email: z.string().email({ message: 'Invalid email address' }).optional(),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
});

export interface EmailSender {
  id: string;
  user_id: string;
  name: string;
  email: string;
  is_default: boolean;
  credentials_json?: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  photo_url?: string;
}

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * @swagger
 * /api/email-senders/{id}:
 *   put:
 *     summary: Update an existing email sender
 *     description: Updates details of a specific email sender by their ID.
 *     tags:
 *       - Email Senders
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: UUID of the email sender to update.
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: 'John Doe'
 *               email:
 *                 type: string
 *                 format: email
 *                 example: 'john.doe@example.com'
 *               is_active:
 *                 type: boolean
 *                 example: false
 *               is_default:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Email sender updated successfully.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/EmailSender' }
 *       400:
 *         description: Invalid request body or ID
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Email sender not found
 *       409:
 *         description: Conflict - Email address already exists for this user or violates default uniqueness
 *       500:
 *         description: Internal server error
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const cookieStore = await cookies();
  const supabaseUserClient = createServerClient(
    supabaseUrl!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }) },
        remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }) },
      },
    }
  );

  const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const userId = user.id;
  const senderId = params.id;

  try {
    const body = await req.json();
    const validation = updateSenderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validation.error.flatten() }, { status: 400 });
    }

    const { name, email, is_active, is_default } = validation.data;

    // If email is being updated, check if the new email already exists for another sender OF THIS USER
    if (email) {
      const { data: existingSender, error: checkError } = await supabaseAdmin
        .from('senders')
        .select('id')
        .eq('email', email)
        .eq('user_id', userId)
        .neq('id', senderId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking for conflicting email:', checkError);
        return NextResponse.json({ error: checkError.message }, { status: 500 });
      }
      if (existingSender) {
        return NextResponse.json({ error: 'Conflict: Email address already exists for this user.' }, { status: 409 });
      }
    }

    const updateData: Partial<Omit<EmailSender, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'photo_url' | 'credentials_json'>> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (is_default !== undefined) updateData.is_default = is_default;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No update fields provided' }, { status: 400 });
    }

    // If setting this sender to be the default, unset any other default for this user first
    if (is_default === true) {
      const { error: unsetDefaultError } = await supabaseAdmin
        .from('senders')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('is_default', true)
        .neq('id', senderId);

      if (unsetDefaultError) {
        console.error('Error unsetting existing default sender during update:', unsetDefaultError);
      }
    }

    const { data: updatedSender, error: updateError } = await supabaseAdmin
      .from('senders')
      .update(updateData)
      .eq('id', senderId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating sender:', updateError);
      if (updateError.code === 'PGRST116' || updateError.code === 'PGRST204') {
        const { data: exists, error: existenceError } = await supabaseAdmin
          .from('senders')
          .select('id')
          .eq('id', senderId)
          .eq('user_id', userId)
          .maybeSingle();

        if (existenceError) {
          console.error('Error checking sender existence:', existenceError);
          return NextResponse.json({ error: 'Error confirming sender status after update attempt.' }, { status: 500 });
        }
        if (!exists) {
          return NextResponse.json({ error: 'Sender not found for this user.' }, { status: 404 });
        }

        const { data: currentSenderData, error: currentSenderError } = await supabaseAdmin
          .from('senders')
          .select('*')
          .eq('id', senderId)
          .eq('user_id', userId)
          .single();

        if (currentSenderError) {
          return NextResponse.json({ error: 'Failed to retrieve sender after update (no changes made).' }, { status: 500 });
        }
        return NextResponse.json(currentSenderData as EmailSender, { status: 200 });
      }
      if (updateError.code === '23505') {
        return NextResponse.json({ error: 'Conflict: Email address already exists for this user or violates default uniqueness.' }, { status: 409 });
      }
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!updatedSender) {
      return NextResponse.json({ error: 'Sender not found for this user or no changes made.' }, { status: 404 });
    }

    return NextResponse.json(updatedSender as EmailSender, { status: 200 });
  } catch (err: any) {
    console.error('Unexpected error in PUT /api/email-senders/[id]:', err);
    return NextResponse.json({ error: err.message || 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/email-senders/{id}:
 *   delete:
 *     summary: Delete an email sender
 *     description: Removes a specific email sender by their ID.
 *     tags:
 *       - Email Senders
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: UUID of the email sender to delete.
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Email sender deleted successfully
 *       400:
 *         description: Invalid ID format
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Email sender not found
 *       500:
 *         description: Internal server error
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const cookieStore = await cookies();
  const supabaseUserClient = createServerClient(
    supabaseUrl!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }) },
        remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }) },
      },
    }
  );

  const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const userId = user.id;
  const senderId = params.id;

  try {
    // Check if the sender is the default one before deleting.
    const { data: senderToDelete, error: fetchError } = await supabaseAdmin
      .from('senders')
      .select('is_default')
      .eq('id', senderId)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching sender before delete:', fetchError);
      return NextResponse.json({ error: 'Error verifying sender before deletion.' }, { status: 500 });
    }

    if (!senderToDelete) {
      return NextResponse.json({ error: 'Sender not found for this user.' }, { status: 404 });
    }

    const { error: deleteError, count } = await supabaseAdmin
      .from('senders')
      .delete()
      .eq('id', senderId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting sender:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    if (count === 0) {
      return NextResponse.json({ error: 'Sender not found for this user or already deleted.' }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error('Unexpected error in DELETE /api/email-senders/[id]:', err);
    return NextResponse.json({ error: err.message || 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/email-senders/{id}:
 *   get:
 *     summary: Retrieve a specific email sender
 *     description: Fetches details of a specific email sender by their ID, ensuring it belongs to the authenticated user.
 *     tags:
 *       - Email Senders
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: UUID of the email sender to retrieve.
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Email sender details.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/EmailSender' }
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Email sender not found for this user
 *       500:
 *         description: Internal server error
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const cookieStore = await cookies();
  const supabaseUserClient = createServerClient(
    supabaseUrl!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }) },
        remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }) },
      },
    }
  );

  const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const userId = user.id;
  const senderId = params.id;

  try {
    const { data: sender, error } = await supabaseAdmin
      .from('senders')
      .select('*')
      .eq('id', senderId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching sender by ID:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!sender) {
      return NextResponse.json({ error: 'Sender not found for this user.' }, { status: 404 });
    }

    return NextResponse.json(sender as EmailSender, { status: 200 });
  } catch (err: any) {
    console.error('Unexpected error in GET /api/email-senders/[id]:', err);
    return NextResponse.json({ error: err.message || 'An unexpected error occurred' }, { status: 500 });
  }
}