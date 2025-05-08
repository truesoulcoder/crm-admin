import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server'; // Corrected import path
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js'; // Import SupabaseClient type

// Zod schema for validating the request body when creating a template
const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'), // e.g., 'email', 'loi_document'
  content: z.string().min(1, 'Content is required'),
  subject: z.string().optional().nullable(),
  available_placeholders: z.array(z.string()).optional().nullable(),
  // user_id will be added from session, not from client payload directly for security
});

// Zod schema for validating a new document template
const documentTemplateSchema = z.object({
  name: z.string().min(1, { message: 'Template name cannot be empty.' }),
  type: z.string().min(1, { message: 'Template type cannot be empty.' }), // e.g., 'email', 'loi_document'
  content: z.string().min(1, { message: 'Template content cannot be empty.' }),
  subject: z.string().optional().nullable(),
  available_placeholders: z.array(z.string()).optional().nullable(), // Expecting an array of strings
  is_active: z.boolean().optional().default(true),
});

export interface DocumentTemplate {
  id: string; // UUID
  name: string;
  type: string;
  content: string;
  subject?: string | null;
  available_placeholders?: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// GET handler to fetch all document templates (initially, all active ones)
export async function GET(req: NextRequest) {
  try {
    const supabase: SupabaseClient<any, "public", any> = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching document templates:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Unexpected error in GET /api/document-templates:', err);
    return NextResponse.json({ error: err.message || 'An unexpected error occurred.' }, { status: 500 });
  }
}

// POST handler to create a new document template
export async function POST(request: NextRequest) {
  const supabase: SupabaseClient<any, "public", any> = await createClient();

  // Check user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = createTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
    }

    const { name, type, content, subject, available_placeholders } = validation.data;

    // Insert the new template with the user_id from the session
    const { data, error } = await supabase
      .from('document_templates')
      .insert([
        {
          name,
          type,
          content,
          subject,
          available_placeholders,
          user_id: user.id, // Add the authenticated user's ID
          is_active: true // Default to active
        }
      ])
      .select()
      .single(); // Assuming you want to return the created object

    if (error) {
      console.error('Supabase error creating template:', error);
      // Check for unique constraint violation (e.g., template name)
      if (error.code === '23505') { // Postgres unique violation error code
        return NextResponse.json({ error: 'A template with this name already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message || 'Failed to create template' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    console.error('Error in POST /api/document-templates:', e);
    return NextResponse.json({ error: e.message || 'An unexpected error occurred' }, { status: 500 });
  }
}