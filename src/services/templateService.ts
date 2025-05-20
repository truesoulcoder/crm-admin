import { createClient } from '@supabase/supabase-js';

import { logSystemEvent } from './logService';
import { generatePdfFromHtml } from './pdfService';

const BUCKET_NAME = 'pdf-templates';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * Renders a template string with the provided context
 * @param template - Template string with {{variable}} placeholders
 * @param context - Object containing key-value pairs for template variables
 * @returns Rendered template string
 */
interface TemplateContext {
  [key: string]: unknown;
}

export function renderTemplate(template: string, context: TemplateContext): string {
  if (!template) return '';
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const value = context[key.trim()];
    return value !== undefined && value !== null ? String(value) : '';
  });
}

interface UploadPdfTemplateParams {
  file: File;
  templateName: string;
  userId: string;
}

/**
 * Uploads a PDF template to Supabase Storage
 * @param params - Object containing file, templateName, and userId
 * @returns Public URL of the uploaded template
 */
export async function uploadPdfTemplate({
  file,
  templateName,
  userId,
}: UploadPdfTemplateParams): Promise<string> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${templateName}-${Date.now()}.${fileExt}`;
    const filePath = fileName; // Save directly to root of the bucket

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    if (!publicUrl) {
      throw new Error('Failed to get public URL for uploaded template');
    }

    return publicUrl;
  } catch (err) {
    const error = err as Error;
    await logSystemEvent({
      event_type: 'TEMPLATE_UPLOAD_ERROR',
      message: 'Failed to upload PDF template',
      details: {
        error: error.message,
        templateName,
        userId,
      },
    });
    throw error;
  }
}

interface TemplateData {
  content: string;
}

interface RenderTemplateWithDataParams {
  template: string;
  data: Record<string, unknown>;
}

/**
 * Renders a template with data and returns the result
 * @param params - Object containing template and data
 * @returns Rendered template string
 */
export async function renderTemplateWithData({
  template,
  data,
}: RenderTemplateWithDataParams): Promise<string> {
  try {
    // Fetch template content if it's a reference
    let templateContent = template;
    if (template.startsWith('template:')) {
      const templateId = template.replace('template:', '');
      const { data: templateData, error } = await supabase
        .from('templates')
        .select('content')
        .eq('id', templateId)
        .single<TemplateData>();

      if (error) throw error;
      if (!templateData) throw new Error(`Template not found: ${templateId}`);

      templateContent = templateData.content;
    }

    return renderTemplate(templateContent, data);
  } catch (err) {
    const error = err as Error;
    await logSystemEvent({
      event_type: 'TEMPLATE_RENDER_ERROR',
      message: 'Failed to render template',
      details: {
        error: error.message,
        template: template.substring(0, 100) + (template.length > 100 ? '...' : ''),
      },
    });
    throw error;
  }
}

interface GeneratePdfFromTemplateParams {
  templateContent: string;
  data: Record<string, unknown>;
  fileName: string;
}

/**
 * Generates a PDF from a template with data
 */
export async function generatePdfFromTemplate({
  templateContent,
  data,
  fileName = `document-${Date.now()}.pdf`,
}: GeneratePdfFromTemplateParams): Promise<{ buffer: Buffer; fileName: string }> {
  try {
    // Render the template with provided data
    const renderedHtml = renderTemplate(templateContent, data);
    
    // Generate PDF from the rendered HTML
    const pdfBuffer = await generatePdfFromHtml(renderedHtml);
    
    return {
      buffer: pdfBuffer,
      fileName: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`
    };
  } catch (err) {
    const error = err as Error;
    await logSystemEvent({
      event_type: 'PDF_GENERATION_ERROR',
      message: 'Failed to generate PDF from template',
      details: {
        error: error.message,
        templateLength: templateContent?.length || 0,
      },
    });
    throw error;
  }
}


