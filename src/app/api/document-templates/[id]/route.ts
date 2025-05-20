import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import type { Database } from '@/types/supabase';

// Zod schema for validating an update to a document template
const updateDocumentTemplateSchema = z.object({
  name: z.string().min(1, { message: 'Template name cannot be empty.' }).optional(),
  template_type: z.string().min(1, { message: 'Template type cannot be empty.' }).optional(),
  body: z.string().min(1, { message: 'Template body (content) cannot be empty.' }).optional(),
  subject: z.string().optional().nullable(),
  available_placeholders: z.array(z.string()).optional().nullable(),
  is_active: z.boolean().optional(),
});

// Helper to get Supabase client for Route Handlers
function getSupabaseRouteHandlerClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// UUID validation function
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Extract UUID from a string that might have a suffix
function extractUUID(id: string): string | null {
  const uuidPart = id.split('-').slice(0, 5).join('-');
  return isValidUUID(uuidPart) ? uuidPart : null;
}

// GET handler to fetch a single document template by ID for the authenticated user
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await getSupabaseRouteHandlerClient();
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: 'Template ID is required.' }, { status: 400 });
  }
  
  const templateId = extractUUID(id);
  if (!templateId) {
    return NextResponse.json({ error: 'Invalid template ID format. Must be a valid UUID.' }, { status: 400 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Document template not found or access denied.' }, { status: 404 });
      }
      console.error('Error fetching document template by ID:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Document template not found or access denied.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error(`Unexpected error in GET /api/document-templates/${id}:`, err);
    return NextResponse.json({ error: err.message || 'An unexpected error occurred.' }, { status: 500 });
  }
}

// PUT handler to update an existing document template for the authenticated user
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await getSupabaseRouteHandlerClient();
  const { id } = params;
  
  const templateId = extractUUID(id);
  if (!templateId) {
    return NextResponse.json({ error: 'Invalid template ID format. Must be a valid UUID.' }, { status: 400 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validation = updateDocumentTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input.', issues: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const updateData = validation.data;
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update provided.' }, { status: 400 });
    }

    const { data: updatedTemplate, error } = await supabase
      .from('document_templates')
      .update(updateData)
      .eq('id', templateId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating document template:', error);
      if (error.code === 'PGRST116') { 
        return NextResponse.json({ error: 'Document template not found for update or access denied.' }, { status: 404 });
      }
      if (error.code === '23505' && error.message.includes('document_templates_user_id_name_key')) {
        return NextResponse.json({ error: 'Another template with this name already exists for your account.' }, { status: 409 });
      } else if (error.code === '23505') {
        return NextResponse.json({ error: 'A template with this name already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (!updatedTemplate) {
      return NextResponse.json({ error: 'Document template not found for update or no changes made.' }, { status: 404 });
    }

    return NextResponse.json(updatedTemplate);
  } catch (err: any) {
    console.error(`Unexpected error in PUT /api/document-templates/${id}:`, err);
    return NextResponse.json({ error: err.message || 'An unexpected server error occurred.' }, { status: 500 });
  }
}

// DELETE handler to "soft delete" (mark as inactive) a document template for the authenticated user
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await getSupabaseRouteHandlerClient();
  const { id } = params;
  
  const templateId = extractUUID(id);
  if (!templateId) {
    return NextResponse.json({ error: 'Invalid template ID format. Must be a valid UUID.' }, { status: 400 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: softDeletedTemplate, error } = await supabase
      .from('document_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', templateId)
      .eq('user_id', user.id)
      .select('id') 
      .single();

    if (error) {
      console.error('Error soft deleting document template:', error);
      if (error.code === 'PGRST116') { 
        return NextResponse.json({ error: 'Document template not found for deletion or access denied.' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!softDeletedTemplate) { 
      return NextResponse.json({ error: 'Document template not found for deletion or no change made.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Document template marked as inactive.' }, { status: 200 });
  } catch (err: any) {
    console.error(`Unexpected error in DELETE /api/document-templates/${id}:`, err);
    return NextResponse.json({ error: err.message || 'An unexpected server error occurred.' }, { status: 500 });
  }
}
