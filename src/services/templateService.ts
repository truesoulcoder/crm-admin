import { createClient } from '@supabase/supabase-js';

import { logSystemEvent } from './logService';
import { generatePdfFromHtml, generatePdfFromTemplateWithBranding } from './pdfService';
import { EmailTemplate } from '@/types';

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
    // Sanitize the template name to create a clean filename
    const sanitizedTemplateName = templateName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')  // Replace non-alphanumeric with underscores
      .replace(/_+/g, '_')          // Replace multiple underscores with single
      .replace(/^_+|_+$/g, '');     // Remove leading/trailing underscores
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${sanitizedTemplateName}.${fileExt}`;
    
    // Remove any existing file with this name
    await supabase.storage
      .from(BUCKET_NAME)
      .remove([fileName]);

    // Upload the file with the template name
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

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

/**
 * Fetches an email template by its ID from the database
 * @param templateId - The ID of the template to fetch
 * @returns The email template if found, null otherwise
 */
export async function getEmailTemplate(templateId: string): Promise<EmailTemplate | null> {
  try {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      throw error;
    }

    return data as EmailTemplate;
  } catch (error) {
    console.error('Error fetching email template:', error);
    await logSystemEvent({
      event_type: 'TEMPLATE_FETCH_ERROR',
      message: 'Failed to fetch email template',
      details: {
        templateId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    return null;
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
export async function generatePdfFromTemplate(
  params: GeneratePdfFromTemplateParams & { useBrandedTemplate?: boolean }
): Promise<{ buffer: Buffer; fileName: string }> {
  const {
    templateContent,
    data,
    fileName,
    useBrandedTemplate = true
  } = params;
  try {
    // Render the template with data
    const renderedContent = renderTemplate(templateContent, data);
    
    // Generate PDF from the rendered content
    const pdfBuffer = useBrandedTemplate 
      ? await generatePdfFromTemplateWithBranding(renderedContent, {
          format: 'Letter',
          margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
        })
      : await generatePdfFromHtml(renderedContent, {
          format: 'Letter',
          margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
        });

    return {
      buffer: pdfBuffer,
      fileName: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
    };
  } catch (error: unknown) {
    console.error('Error generating PDF from template:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    await logSystemEvent({
      event_type: 'PDF_GENERATION_ERROR',
      message: 'Failed to generate PDF from template',
      details: {
        error: errorMessage,
        stack: errorStack,
        templateLength: templateContent?.length || 0,
      },
    });
    
    // Re-throw the error with a more specific message if needed
    const errorToThrow = new Error(`Failed to generate PDF: ${errorMessage}`);
    if (error instanceof Error) {
      errorToThrow.stack = error.stack;
    }
    throw errorToThrow;
  }
}


