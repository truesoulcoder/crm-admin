import { NextResponse } from 'next/server';

import { generatePdfFromHtml } from '@/services/pdfService';

export async function POST(request: Request) {
  try {
    const { html } = await request.json();
    
    if (!html) {
      return NextResponse.json(
        { error: 'HTML content is required' },
        { status: 400 }
      );
    }

    const pdfBuffer = await generatePdfFromHtml(html, {
      format: 'A4',
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
      printBackground: true
    });

    // Convert buffer to base64 to send over HTTP
    const pdfBase64 = pdfBuffer.toString('base64');
    
    return NextResponse.json({ pdf: pdfBase64 });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

// Ensure this route is only available on the server side
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
