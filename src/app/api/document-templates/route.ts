import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import type { Database } from '@/types/supabase';

type DocumentTemplate = Database['public']['Tables']['document_templates']['Row'];
type InsertDocumentTemplate = Database['public']['Tables']['document_templates']['Insert'];
type UpdateDocumentTemplate = Database['public']['Tables']['document_templates']['Update'];

// Zod schema for document templates
const documentTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  type: z.enum(['email', 'pdf'], { 
    required_error: 'Template type is required',
    invalid_type_error: 'Template type must be either "email" or "pdf"' 
  }),
  subject: z.string().nullish(),
  content: z.string().min(1, 'Template content is required'),
  is_active: z.boolean().optional().default(true)
});

// Helper to get Supabase client for Route Handlers
function getSupabaseRouteHandlerClient() {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const projectAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  return createServerClient<Database>(
    projectUrl,
    projectAnonKey
  );
}

// GET handler to fetch document templates for the authenticated user
export async function GET(req: NextRequest) {
  const supabase = await getSupabaseRouteHandlerClient();
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const filterIsActive = searchParams.get('is_active');
    const type = searchParams.get('type'); // Optional type filter

    if (isNaN(page) || page < 1) {
      return NextResponse.json({ error: 'Invalid page number.' }, { status: 400 });
    }
    if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
      return NextResponse.json({ error: 'Invalid pageSize. Must be between 1 and 100.' }, { status: 400 });
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('document_templates')
      .select('*', { count: 'exact' })
      .eq('created_by', user.id)
      .is('deleted_at', null); // Only include non-deleted templates

    if (filterIsActive === 'true' || filterIsActive === 'false') {
      query = query.eq('is_active', filterIsActive === 'true');
    }
    
    if (type === 'email' || type === 'pdf') {
      query = query.eq('type', type);
    }
    
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error: queryError, count } = await query;

    if (queryError) {
      console.error('Error fetching document templates:', queryError);
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    return NextResponse.json({
      data: data || [],
      totalCount: count || 0,
      page,
      pageSize,
      totalPages: count ? Math.ceil(count / pageSize) : 0,
    });
  } catch (err: any) {
    console.error('Unexpected error in GET /api/document-templates:', err);
    return NextResponse.json(
      { error: err.message || 'An unexpected error occurred while fetching document templates.' }, 
      { status: 500 }
    );
  }
}

// POST handler to create a new document template
export async function POST(request: NextRequest) {
  const supabase = await getSupabaseRouteHandlerClient();
  
  try {
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = documentTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input', 
          details: validation.error.flatten() 
        }, 
        { status: 400 }
      );
    }

    // Check if template with same name already exists for this user
    const { data: existingTemplate, error: checkError } = await supabase
      .from('document_templates')
      .select('id')
      .eq('created_by', user.id)
      .eq('name', validation.data.name)
      .is('deleted_at', null)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking for existing template:', checkError);
      return NextResponse.json(
        { error: 'Error checking for existing template' },
        { status: 500 }
      );
    }

    if (existingTemplate) {
      return NextResponse.json(
        { error: 'A template with this name already exists' },
        { status: 409 }
      );
    }

    // Prepare template data for insertion
    const templateData = {
      name: validation.data.name,
      type: validation.data.type,
      subject: validation.data.subject || null,
      content: validation.data.content,
      created_by: user.id,
      is_active: validation.data.is_active ?? true,
      deleted_at: null
    };

    // Insert the new template
    const { data: newTemplate, error: insertError } = await supabase
      .from('document_templates')
      .insert(templateData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating document template:', insertError);
      return NextResponse.json(
        { error: 'Failed to create document template' },
        { status: 500 }
      );
    }

    return NextResponse.json(newTemplate, { status: 201 });
  } catch (e: any) {
    console.error('Unexpected error in POST /api/document-templates:', e);
    return NextResponse.json(
      { error: 'An unexpected error occurred while creating the document template' },
      { status: 500 }
    );
  }
}

// PUT handler to update an existing document template
export async function PUT(request: NextRequest) {
  const supabase = await getSupabaseRouteHandlerClient();
  
  try {
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get template ID from URL
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = documentTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input', 
          details: validation.error.flatten() 
        }, 
        { status: 400 }
      );
    }

    // Verify the template exists and belongs to the user
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('document_templates')
      .select('id, name')
      .eq('id', id)
      .eq('created_by', user.id)
      .is('deleted_at', null)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: 'Template not found or access denied' },
        { status: 404 }
      );
    }

    // Check if another template with the same name exists (excluding current template)
    if (validation.data.name !== existingTemplate.name) {
      const { data: nameConflict, error: checkError } = await supabase
        .from('document_templates')
        .select('id')
        .eq('created_by', user.id)
        .eq('name', validation.data.name)
        .is('deleted_at', null)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking for name conflict:', checkError);
        return NextResponse.json(
          { error: 'Error checking for existing template name' },
          { status: 500 }
        );
      }

      if (nameConflict) {
        return NextResponse.json(
          { error: 'A template with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Prepare update data
    const updateData = {
      name: validation.data.name,
      type: validation.data.type,
      subject: validation.data.subject || null,
      content: validation.data.content,
      is_active: validation.data.is_active ?? true,
      updated_at: new Date().toISOString()
    };

    // Update the template
    const { data: updatedTemplate, error: updateError } = await supabase
      .from('document_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating document template:', updateError);
      return NextResponse.json(
        { error: 'Failed to update document template' },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedTemplate);
  } catch (e: any) {
    console.error('Unexpected error in PUT /api/document-templates:', e);
    return NextResponse.json(
      { error: 'An unexpected error occurred while updating the document template' },
      { status: 500 }
    );
  }
}

// DELETE handler to soft-delete a document template
export async function DELETE(request: NextRequest) {
  const supabase = await getSupabaseRouteHandlerClient();
  
  try {
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get template ID from URL
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Verify the template exists and belongs to the user
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('document_templates')
      .select('id')
      .eq('id', id)
      .eq('created_by', user.id)
      .is('deleted_at', null)
      .single();

    if (fetchError) {
      return NextResponse.json(
        { error: 'Template not found or access denied' },
        { status: 404 }
      );
    }

    // Soft delete the template by setting deleted_at
    const { error: deleteError } = await supabase
      .from('document_templates')
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting document template:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete document template' },
        { status: 500 }
      );
    }

    return new Response(null, { status: 204 });
  } catch (e: any) {
    console.error('Unexpected error in DELETE /api/document-templates:', e);
    return NextResponse.json(
      { error: 'An unexpected error occurred while deleting the document template' },
      { status: 500 }
    );
  }
}