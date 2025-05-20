import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { generatePdfFromTemplate } from '@/services/templateService';


// Sample data for template preview
const SAMPLE_DATA = {
  property_address: '123 Main St',
  property_city: 'Sample City',
  property_state: 'CA',
  property_zip_code: '12345',
  current_date: new Date().toLocaleDateString(),
  contact_name: 'John Doe',
  company_name: 'Sample Company',
  title_company: 'Sample Title Co',
  senders_name: 'Your Name',
  closing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
  offer_price: '$500,000',
  emd_amount: '$10,000'
};

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const templateId = params.id;
    
    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Create Supabase client with environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      }
    );
    
    // Get the template
    const { data: template, error: fetchError } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (fetchError || !template) {
      console.error('Error fetching template:', fetchError);
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Generate PDF from template
    const { buffer } = await generatePdfFromTemplate({
      templateContent: template.content,
      data: SAMPLE_DATA,
      fileName: `${template.name.replace(/\s+/g, '-').toLowerCase()}-preview.pdf`
    });

    if (!buffer) {
      console.error('Error generating PDF: No buffer returned');
      return NextResponse.json(
        { error: 'Failed to generate PDF' },
        { status: 500 }
      );
    }

    // Return the PDF as a response
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${template.name}-preview.pdf"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error generating PDF preview:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF preview' },
      { status: 500 }
    );
  }
}
