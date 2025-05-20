import { NextRequest } from 'next/server';

import { generatePdfFromHtml } from '@/services/pdfService';
import { getAdminSupabaseClient } from '@/services/supabaseAdminService';
import { renderTemplate } from '@/services/templateService';

// Define interface for template variables
interface TemplateVariables {
  [key: string]: string | number | Date;
}

// Mock data for template preview
const mockData: TemplateVariables = {
  property_address: '123 Main St',
  property_city: 'Austin',
  property_state: 'TX',
  property_zip_code: '78701',
  current_date: new Date().toLocaleDateString(),
  contact_name: 'Jane Doe',
  company_name: 'True Soul Partners',
  title_company: 'Best Title Co.',
  senders_name: 'Chris Phillips',
  closing_date: '2025-06-01',
  offer_price: '500,000',
  emd_amount: '10,000',
};

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    console.log(`Generating PDF preview for template ID: ${id}`);
    
    // Get template from database
    const supabase = getAdminSupabaseClient();
    const { data: template, error } = await supabase
      .from('document_templates')
      .select('body')
      .eq('id', id)
      .single();
      
    if (error) {
      console.error('Database error:', error);
      return new Response(JSON.stringify({ error: 'Database error', details: error.message }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!template?.body) {
      console.error('Template not found');
      return new Response(JSON.stringify({ error: 'Template not found' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Ensure template body is a string
    const templateBody: string = template.body && typeof template.body === 'string' ? template.body : '';
    
    if (!templateBody) {
      console.error('Template body is empty or not a string');
      return new Response(JSON.stringify({ error: 'Template body is empty or invalid' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Render template with mock data
    console.log('Rendering template with mock data');
    const html = renderTemplate(templateBody, mockData);
    
    // Generate PDF
    console.log('Generating PDF...');
    const pdfBuffer = await generatePdfFromHtml(html);
    
    // Return PDF response
    console.log('PDF generated successfully');
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="sample.pdf"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    });
    
  } catch (error: unknown) {
    console.error('Error generating PDF preview:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate PDF', 
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
