import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { google } from 'googleapis';

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

// Zod schema for validating POST request body
const createSenderSchema = z.object({
  name: z.string().min(1, { message: 'Sender name is required' }),
  email: z.string().email({ message: 'Invalid email address' }),
  is_active: z.boolean().optional().default(true),
  is_default: z.boolean().optional().default(false),
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

/**
 * @swagger
 * /api/email-senders:
 *   get:
 *     summary: Retrieve a list of email senders
 *     description: Fetches all configured email senders from the database.
 *     tags:
 *       - Email Senders
 *     responses:
 *       200:
 *         description: A list of email senders.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EmailSender'
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Internal server error
 */
export async function GET(req: NextRequest) {
  const cookieStorePromise = cookies(); // Renaming for clarity
  const cookieStore = await cookieStorePromise;
  console.log('Cookies in email-senders API route:', cookieStore.getAll());
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
    console.error('Error fetching user for email senders:', authError);
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const userId = user.id;

  try {
    const { data, error } = await supabaseAdmin
      .from('senders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching email senders:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Initialize Google Admin SDK client
    const googleServiceAccountKeyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!googleServiceAccountKeyJson) {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not defined. ' +
        'This is required for Google Admin SDK. Please ensure it is set.'
      );
    }

    let serviceKeyParsed;
    try {
      serviceKeyParsed = JSON.parse(googleServiceAccountKeyJson);
    } catch (e) {
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:', e);
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON. ' +
        'Please ensure it is a correctly formatted JSON string.'
      );
    }

    if (!serviceKeyParsed.client_email || !serviceKeyParsed.private_key) {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_KEY JSON is missing client_email or private_key.'
      );
    }

    const auth = new google.auth.JWT({
      email: serviceKeyParsed.client_email,
      key: serviceKeyParsed.private_key,
      scopes: ['https://www.googleapis.com/auth/admin.directory.user.readonly'],
      subject: process.env.GOOGLE_DELEGATED_ADMIN_EMAIL
    });

    const directory = google.admin({ version: 'directory_v1', auth });

    // Fetch profile photos for each sender
    const senders: EmailSender[] = data as EmailSender[];
    const sendersWithPhoto = await Promise.all(
      senders.map(async (sender) => {
        try {
          const res = await directory.users.get({ userKey: sender.email, fields: 'thumbnailPhotoUrl' });
          return { ...sender, photo_url: res.data.thumbnailPhotoUrl! };
        } catch {
          return sender;
        }
      })
    );
    return NextResponse.json(sendersWithPhoto, { status: 200 });
  } catch (err: any) {
    console.error('Unexpected error in GET /api/email-senders:', err);
    return NextResponse.json({ error: err.message || 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * @swagger
 * /api/email-senders:
 *   post:
 *     summary: Create a new email sender
 *     description: Adds a new employee email address that can be used for sending emails.
 *     tags:
 *       - Email Senders
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
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
 *                 example: true
 *                 default: true
 *               is_default:
 *                 type: boolean
 *                 example: false
 *                 default: false
 *     responses:
 *       201:
 *         description: Email sender created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmailSender'
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Not authenticated
 *       409:
 *         description: Conflict - Email address already exists
 *       500:
 *         description: Internal server error
 */
export async function POST(req: NextRequest) {
  const cookieStorePromise = cookies();
  const cookieStore = await cookieStorePromise;
  const supabaseUserClient = createServerClient(
    supabaseUrl!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
    console.error('Error authenticating user for creating sender:', authError);
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const userId = user.id;

  try {
    const body = await req.json();
    const validation = createSenderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validation.error.flatten() }, { status: 400 });
    }

    const { name, email, is_active, is_default } = validation.data;

    // Check if email already exists for this user to prevent duplicates
    const { data: existingSender, error: existingError } = await supabaseAdmin
      .from('senders')
      .select('id')
      .eq('email', email)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('Error checking for existing sender:', existingError);
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (existingSender) {
      return NextResponse.json({ error: 'Conflict: Email address already exists.' }, { status: 409 });
    }

    // TODO: If is_default is true, implement transaction to set other senders for this user_id to is_default = false.
    // For now, the DB unique index uq_default_sender_per_user will prevent multiple defaults per user.
    // If this insert attempts to create a second default for the same user, it will fail due to that index.

    const { data: newSender, error: insertError } = await supabaseAdmin
      .from('senders')
      .insert([{ name, email, is_active, user_id: userId, is_default }])
      .select()
      .single();

    if (insertError) {
      console.error('Error creating email sender:', insertError);
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Conflict: Email address already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(newSender as EmailSender, { status: 201 });
  } catch (err: any) {
    console.error('Unexpected error in POST /api/email-senders:', err);
    if (err instanceof SyntaxError && err.message.includes('JSON')) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || 'An unexpected error occurred' }, { status: 500 });
  }
}

/**
 * @swagger
 * components:
 *   schemas:
 *     EmailSender:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated ID of the email sender.
 *         user_id:
 *           type: string
 *           description: The ID of the user who owns this sender.
 *         name:
 *           type: string
 *           description: The name of the sender.
 *         email:
 *           type: string
 *           format: email
 *           description: The email address of the sender used for sending.
 *         is_default:
 *           type: boolean
 *           description: Whether this sender is the default for the user.
 *         credentials_json:
 *           type: object
 *           description: The JSON credentials for the sender (not handled in this API yet).
 *         is_active:
 *           type: boolean
 *           description: Whether the sender account is active.
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: The date and time the sender was created.
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: The date and time the sender was last updated.
 *         photo_url:
 *           type: string
 *           format: uri
 *           description: The URL of the sender's Google profile picture.
 *       example:
 *         id: '123e4567-e89b-12d3-a456-426614174000'
 *         user_id: '123e4567-e89b-12d3-a456-426614174000'
 *         name: 'Jane Doe'
 *         email: 'jane.doe@example.com'
 *         is_default: true
 *         credentials_json: {}
 *         is_active: true
 *         created_at: '2023-10-26T10:00:00Z'
 *         updated_at: '2023-10-26T10:00:00Z'
 *         photo_url: 'https://lh3.googleusercontent.com/.../photo.jpg'
 */