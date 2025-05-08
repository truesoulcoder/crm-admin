import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient'; // Adjusted path due to [id] nesting
import { z } from 'zod';

// Zod schema for validating an update to a document template
// All fields are optional, as it's a PATCH-like update
const updateDocumentTemplateSchema = z.object({
  name: z.string().min(1, { message: 'Template name cannot be empty.' }).optional(),
  type: z.string().min(1, { message: 'Template type cannot be empty.' }).optional(),
  content: z.string().min(1, { message: 'Template content cannot be empty.' }).optional(),
  subject: z.string().optional().nullable(),
  available_placeholders: z.array(z.string()).optional().nullable(),
  is_active: z.boolean().optional(),
});

// GET handler to fetch a single document template by ID
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: 'Template ID is required.' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // PostgREST error code for "Not found"
        return NextResponse.json({ error: 'Document template not found.' }, { status: 404 });
      }
      console.error('Error fetching document template by ID:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Document template not found.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error(`Unexpected error in GET /api/document-templates/${id}:`, err);
    return NextResponse.json({ error: err.message || 'An unexpected error occurred.' }, { status: 500 });
  }
}

// PUT handler to update an existing document template
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: 'Template ID is required.' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const validation = updateDocumentTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input.', issues: validation.error.issues }, { status: 400 });
    }

    // Ensure at least one field is being updated
    if (Object.keys(validation.data).length === 0) {
        return NextResponse.json({ error: 'No fields to update provided.' }, { status: 400 });
    }

    const { data: updatedTemplate, error } = await supabase
      .from('document_templates')
      .update(validation.data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating document template:', error);
       if (error.code === 'PGRST116') { 
        return NextResponse.json({ error: 'Document template not found for update.' }, { status: 404 });
      }
      if (error.code === '23505' && error.message.includes('document_templates_name_key')) {
        return NextResponse.json({ error: 'Another template with this name already exists.' }, { status: 409 });
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

// DELETE handler to "soft delete" (mark as inactive) or hard delete a document template
// For now, we'll soft delete by setting is_active = false
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: 'Template ID is required.' }, { status: 400 });
  }

  try {
    // const { data, error } = await supabase
    //   .from('document_templates')
    //   .delete()
    //   .eq('id', id);
    // For soft delete:
    const { data: deletedTemplate, error } = await supabase
      .from('document_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() }) // Also update updated_at
      .eq('id', id)
      .select('id') // select to confirm
      .single();


    if (error) {
      console.error('Error deleting document template:', error);
      if (error.code === 'PGRST116') { 
        return NextResponse.json({ error: 'Document template not found for deletion.' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!deletedTemplate) { // If .single() returns no data (though eq('id', id) and no error should mean it found it)
        return NextResponse.json({ error: 'Document template not found for deletion or no change made.' }, { status: 404 });
    }


    return NextResponse.json({ message: 'Document template marked as inactive.' }, { status: 200 });
    // If hard deleting: return new NextResponse(null, { status: 204 }); // 204 No Content
  } catch (err: any) {
    console.error(`Unexpected error in DELETE /api/document-templates/${id}:`, err);
    return NextResponse.json({ error: err.message || 'An unexpected server error occurred.' }, { status: 500 });
  }
}