import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Schema for email template validation matching the email_templates table
const emailTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  subject: z.string().min(1, 'Email subject is required'),
  body_html: z.string().min(1, 'Email content is required'),
  body_text: z.string().optional(),
  is_active: z.boolean().optional().default(true)
});

// Helper to get Supabase client
async function getSupabaseRouteHandlerClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string): Promise<string | undefined> {
          const cookieStore = await cookies();
          return cookieStore.get(name)?.value;
        },
        async set(name: string, value: string, options: CookieOptions): Promise<void> {
          const cookieStore = await cookies();
          cookieStore.set({ name, value, ...options });
        },
        async remove(name: string, options: CookieOptions): Promise<void> {
          const cookieStore = await cookies();
          cookieStore.delete({ name, ...options });
        },
      },
    }
  );
}

// List email templates for the authenticated user
export async function GET(_req: NextRequest) {
  try {
    const supabase = await getSupabaseRouteHandlerClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get email templates for this user
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('created_by', user.id);
      
    if (error) {
      console.error('Error listing email templates:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error('Error listing email templates:', err);
    return NextResponse.json(
      { error: 'An error occurred while fetching email templates' },
      { status: 500 }
    );
  }
}

// Create a new email template
export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseRouteHandlerClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Validate request body
    const body = await req.json();
    const validation = emailTemplateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.format() },
        { status: 400 }
      );
    }
    
    // Check if template with this name already exists for this user
    const { data: existingTemplate, error: checkError } = await supabase
      .from('email_templates')
      .select('id')
      .eq('created_by', user.id)
      .eq('name', validation.data.name)
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
    
    // Create the new email template
    const templateData = {
      name: validation.data.name,
      subject: validation.data.subject,
      body_html: validation.data.body_html,
      body_text: validation.data.body_text || '',
      placeholders: body.placeholders || [],
      is_active: validation.data.is_active, // Will be true by default from schema
      user_id: user.id,
      created_by: user.id
    };
    
    const { data: newTemplate, error: insertError } = await supabase
      .from('email_templates')
      .insert(templateData)
      .select()
      .single();
      
    if (insertError) {
      console.error('Error creating email template:', insertError);
      return NextResponse.json(
        { error: 'Failed to create email template' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(newTemplate, { status: 201 });
  } catch (err: any) {
    console.error('Error creating email template:', err);
    return NextResponse.json(
      { error: 'An error occurred while creating the email template' },
      { status: 500 }
    );
  }
}

// Delete an email template
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await getSupabaseRouteHandlerClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get template ID from query params
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Email template ID is required' },
        { status: 400 }
      );
    }
    
    // Verify the email template belongs to the user before deleting
    const { data: template, error: fetchError } = await supabase
      .from('email_templates')
      .select('id')
      .eq('id', id)
      .eq('created_by', user.id)
      .single();
      
    if (fetchError) {
      return NextResponse.json(
        { error: 'Email template not found or access denied' },
        { status: 404 }
      );
    }
    
    // Delete the email template
    const { error: deleteError } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', id);
      
    if (deleteError) {
      console.error('Error deleting email template:', deleteError);
      throw deleteError;
    }
    
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error('Error deleting email template:', err);
    return NextResponse.json(
      { error: 'An error occurred while deleting the email template' },
      { status: 500 }
    );
  }
}