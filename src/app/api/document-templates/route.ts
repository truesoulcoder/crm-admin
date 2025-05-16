import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr'; // Updated import
import { cookies, type ReadonlyRequestCookies } from 'next/headers'; // For createServerClient
import { z } from 'zod';
import type { Database } from '../../types/supabase'; // TODO: Define Database type in src/types.ts or replace with correct path
// If Database is not defined, temporarily use 'any' and update later.

// Refined Zod schema for document templates, aligning with assumed DB columns
const documentTemplateSchema = z.object({
  name: z.string().min(1, 'Template name cannot be empty.'),
  template_type: z.string().min(1, 'Template type cannot be empty.'), // e.g., 'email', 'loi_document'
  body: z.string().min(1, 'Template body (content) cannot be empty.'),
  subject: z.string().optional().nullable(),
  available_placeholders: z.array(z.string()).optional().nullable(),
  is_active: z.boolean().optional().default(true),
  // created_by will be added from session for create, id/created_at/updated_at are DB managed
});

// Schema for creation (can omit fields like is_active if always defaulted)
const createDocumentTemplateSchema = documentTemplateSchema.omit({ is_active: true });

export interface DocumentTemplate {
  id: string; // UUID
  created_by: string | null; // UUID - Changed from user_id
  name: string;
  template_type: string;
  body: string;
  subject?: string | null;
  available_placeholders?: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Helper to get Supabase client for Route Handlers
function getSupabaseSessionCookie(cookieStore: ReadonlyRequestCookies, projectRef: string) {
  // Try to reassemble chunked cookies if present
  let session = cookieStore.get(`sb-${projectRef}-auth-token`);
  if (!session) {
    // Try chunked
    let i = 0;
    let chunk = '';
    while (cookieStore.get(`sb-${projectRef}-auth-token.${i}`)) {
      chunk += cookieStore.get(`sb-${projectRef}-auth-token.${i}`).value;
      i++;
    }
    if (chunk) {
      session = { value: chunk };
    }
  }
  return session;
}

async function getSupabaseRouteHandlerClient() {
  const cookieStore = await cookies();
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.split('https://')[1].split('.')[0];
  // DEBUG: Output cookies to help diagnose auth/session issues
  console.log('Cookies in API route:', cookieStore.getAll());
  // Fix for chunked cookies
  const sessionCookie = getSupabaseSessionCookie(cookieStore, projectRef);

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          if (name === `sb-${projectRef}-auth-token` && sessionCookie) {
            return sessionCookie.value;
          }
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }); },
        remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }); },
      },
    }
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
    const filterIsActive = searchParams.get('is_active'); // Optional filter

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
      .eq('created_by', user.id);

    if (filterIsActive === 'true' || filterIsActive === 'false') {
      query = query.eq('is_active', filterIsActive === 'true');
    } else {
      // Default to fetching active templates if no specific filter is provided
      query = query.eq('is_active', true);
    }
    
    query = query.order('name', { ascending: true }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching document templates:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      totalCount: count,
      page,
      pageSize,
      totalPages: count ? Math.ceil(count / pageSize) : 0,
    });
  } catch (err: any) {
    console.error('Unexpected error in GET /api/document-templates:', err);
    return NextResponse.json({ error: err.message || 'An unexpected error occurred.' }, { status: 500 });
  }
}

// POST handler to create a new document template
export async function POST(request: NextRequest) {
  const supabase = await getSupabaseRouteHandlerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    // Use createDocumentTemplateSchema which expects DB-aligned field names
    // If API receives 'content' and 'type', they need to be mapped before validation or Zod schema adjusted
    // Assuming API client sends 'name', 'template_type', 'body', 'subject', etc.
    const validation = createDocumentTemplateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
    }

    const templateData = {
      ...validation.data,
      created_by: user.id, // Changed from user_id
      is_active: true, // Explicitly set, though create schema defaults it if not omitted
    };

    const { data, error } = await supabase
      .from('document_templates')
      .insert(templateData)
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating template:', error);
      if (error.code === '23505') { // Postgres unique violation error code
        return NextResponse.json({ error: 'A template with this name already exists for your account.' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message || 'Failed to create template' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (e: any) {
    console.error('Error in POST /api/document-templates:', e);
    return NextResponse.json({ error: e.message || 'An unexpected error occurred' }, { status: 500 });
  }
}