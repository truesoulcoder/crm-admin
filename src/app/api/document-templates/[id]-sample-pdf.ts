import { NextRequest } from 'next/server';

import { generatePdfFromHtml } from '@/services/pdfService';
import { getAdminSupabaseClient } from '@/services/supabaseAdminService';
import { renderTemplate } from '@/services/templateService';

// Mock data for template preview
const mockData = {
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
  const supabase = getAdminSupabaseClient();
  const { id } = params;
  const { data: template, error } = await supabase
    .from('document_templates')
    .select('body')
    .eq('id', id)
    .single();
  if (error || !template?.body) {
    return new Response('Template not found', { status: 404 });
  }
  const html = renderTemplate(template.body, mockData);
  const pdfBuffer = await generatePdfFromHtml(html);
  return new Response(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="sample.pdf"',
    },
  });
}
