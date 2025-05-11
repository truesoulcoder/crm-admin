import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { google } from 'googleapis';

// Initialize Supabase client
// Ensure your environment variables are set up for these
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!supabaseServiceRoleKey) {
  throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Zod schema for validating POST request body
const createSenderSchema = z.object({
  employee_name: z.string().min(1, { message: 'Employee name is required' }),
  employee_email: z.string().email({ message: 'Invalid email address' }),
  is_active: z.boolean().optional().default(true),
});

export interface EmailSender {
  id: number;
  employee_name: string;
  employee_email: string;
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
 *       500:
 *         description: Internal server error
 */
export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('email_senders')
      .select('*')
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
      key: serviceKeyParsed.private_key, // Directly use the parsed private key
      scopes: ['https://www.googleapis.com/auth/admin.directory.user.readonly'],
      subject: process.env.GOOGLE_DELEGATED_ADMIN_EMAIL // User to impersonate for Admin SDK
    });

    const directory = google.admin({ version: 'directory_v1', auth });

    // Fetch profile photos for each sender
    const senders: EmailSender[] = data as EmailSender[];
    const sendersWithPhoto = await Promise.all(
      senders.map(async (sender) => {
        try {
          const res = await directory.users.get({ userKey: sender.employee_email, fields: 'thumbnailPhotoUrl' });
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
 *               - employee_name
 *               - employee_email
 *             properties:
 *               employee_name:
 *                 type: string
 *                 example: 'John Doe'
 *               employee_email:
 *                 type: string
 *                 format: email
 *                 example: 'john.doe@example.com'
 *               is_active:
 *                 type: boolean
 *                 example: true
 *                 default: true
 *     responses:
 *       201:
 *         description: Email sender created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmailSender'
 *       400:
 *         description: Invalid request body
 *       409:
 *         description: Conflict - Email address already exists
 *       500:
 *         description: Internal server error
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = createSenderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validation.error.flatten() }, { status: 400 });
    }

    const { employee_name, employee_email, is_active } = validation.data;

    // Check if email already exists to prevent duplicates (as per UNIQUE constraint)
    const { data: existingSender, error: existingError } = await supabase
      .from('email_senders')
      .select('id')
      .eq('employee_email', employee_email)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') { // PGRST116: Row not found, which is fine
        console.error('Error checking for existing sender:', existingError);
        return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    if (existingSender) {
      return NextResponse.json({ error: 'Conflict: Email address already exists.' }, { status: 409 });
    }

    const { data: newSender, error: insertError } = await supabase
      .from('email_senders')
      .insert([{ employee_name, employee_email, is_active }])
      .select()
      .single(); // Assuming you want the created object back

    if (insertError) {
      console.error('Error creating email sender:', insertError);
      // Check for unique constraint violation specifically if the above check somehow missed it
      if (insertError.code === '23505') { // PostgreSQL unique_violation
        return NextResponse.json({ error: 'Conflict: Email address already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(newSender as EmailSender, { status: 201 });
  } catch (err: any) {
    console.error('Unexpected error in POST /api/email-senders:', err);
    // Check if it's a JSON parsing error
    if (err instanceof SyntaxError && err.message.includes('JSON')) {
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || 'An unexpected error occurred' }, { status: 500 });
  }
}

// Basic schema definition for Swagger documentation (can be expanded)
/**
 * @swagger
 * components:
 *   schemas:
 *     EmailSender:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated ID of the email sender.
 *         employee_name:
 *           type: string
 *           description: The name of the employee.
 *         employee_email:
 *           type: string
 *           format: email
 *           description: The email address of the employee used for sending.
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
 *         id: 1
 *         employee_name: 'Jane Doe'
 *         employee_email: 'jane.doe@example.com'
 *         is_active: true
 *         created_at: '2023-10-26T10:00:00Z'
 *         updated_at: '2023-10-26T10:00:00Z'
 *         photo_url: 'https://lh3.googleusercontent.com/.../photo.jpg'
 */