import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { Database } from '@/types_db'; // Assuming this is your Supabase generated types path

// Zod schema for validating an update to a document template
// All fields are optional. Uses DB-aligned field names.
const updateDocumentTemplateSchema = z.object({
  name: z.string().min(1, { message: 'Template name cannot be empty.' }).optional(),
  template_type: z.string().min(1, { message: 'Template type cannot be empty.' }).optional(), // Updated
  body: z.string().min(1, { message: 'Template body (content) cannot be empty.' }).optional(), // Updated
  subject: z.string().optional().nullable(),
  available_placeholders: z.array(z.string()).optional().nullable(),
  is_active: z.boolean().optional(),
});

// Helper to get Supabase client for Route Handlers
function getSupabaseRouteHandlerClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }); },
        remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }); },
      },
    }
  );
}

// GET handler to fetch a single document template by ID for the authenticated user
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = getSupabaseRouteHandlerClient();
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: 'Template ID is required.' }, { status: 400 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id) // Enforce user ownership
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Document template not found or access denied.' }, { status: 404 });
      }
      console.error('Error fetching document template by ID:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // data will be null if not found for this user, PGRST116 should catch it
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
  const supabase = getSupabaseRouteHandlerClient();
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: 'Template ID is required.' }, { status: 400 });
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
      .update(updateData) // Zod schema uses DB-aligned names
      .eq('id', id)
      .eq('user_id', user.id) // Enforce user ownership
      .select()
      .single();

    if (error) {
      console.error('Error updating document template:', error);
       if (error.code === 'PGRST116') { 
        return NextResponse.json({ error: 'Document template not found for update or access denied.' }, { status: 404 });
      }
      // Check for unique constraint on 'name' scoped to 'user_id' (if such a constraint exists)
      // The default Supabase error for unique constraint is 23505.
      if (error.code === '23505' && error.message.includes('document_templates_user_id_name_key')) { // Example unique constraint name
        return NextResponse.json({ error: 'Another template with this name already exists for your account.' }, { status: 409 });
      } else if (error.code === '23505') {
         return NextResponse.json({ error: 'A template with this name already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // .single() with .update() and .select() should return the updated row or error if not found/matched.
    // PGRST116 should have been caught if no row matched the .eq conditions.
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
  const supabase = getSupabaseRouteHandlerClient();
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: 'Template ID is required.' }, { status: 400 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: softDeletedTemplate, error } = await supabase
      .from('document_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id) // Enforce user ownership
      .select('id') 
      .single();

    if (error) {
      console.error('Error soft deleting document template:', error);
      if (error.code === 'PGRST116') { 
        return NextResponse.json({ error: 'Document template not found for deletion or access denied.' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // .single() will error if no row matched. If it didn't error, softDeletedTemplate should have the id.
    if (!softDeletedTemplate) { 
        return NextResponse.json({ error: 'Document template not found for deletion or no change made.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Document template marked as inactive.' }, { status: 200 });
  } catch (err: any) {
    console.error(`Unexpected error in DELETE /api/document-templates/${id}:`, err);
    return NextResponse.json({ error: err.message || 'An unexpected server error occurred.' }, { status: 500 });
  }
}