// This module should only be used in server-side code (API routes)
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { logInfo } from './logService.js';
import { chromium } from '@sparticuz/chromium';
import { fontkit } from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';
import { Browser, PDFOptions, launch } from 'puppeteer-core';

// Only import server-side dependencies
const isProduction = process.env.NODE_ENV === 'production';

// Logging function that works without the full logService
const logSystemEvent = async (event: { event_type: string; message: string; details?: any }) => {
  if (isProduction) {
    console.log(`[${event.event_type}] ${event.message}`, event.details || '');
  }
};

export interface PdfGenerationOptions extends Omit<PDFOptions, 'path'> {
  format?: 'A4' | 'Letter' | PDFOptions['format'];
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

/**
 * Generates a PDF buffer from provided HTML content using Puppeteer.
 * Works in both local development and Vercel environments.
 */
/**
 * Generates a PDF using a branded template with overlaid content
 * @param htmlContent - HTML content to overlay on the template
 * @param options - PDF generation options
 * @returns PDF buffer
 */
export async function generatePdfFromTemplateWithBranding(
  htmlContent: string,
  options: PdfGenerationOptions = {}
): Promise<Buffer> {
  const templatePath = join(process.cwd(), 'public', 'letter_of_intent_branded_watermarked.pdf');
  const templateBuffer = readFileSync(templatePath);
  
  // Generate the content PDF with transparent background
  const contentBuffer = await generatePdfFromHtml(htmlContent, {
    ...options,
    displayHeaderFooter: false,
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  
  try {
    // Load the template and content PDFs
    const templatePdf = await PDFDocument.load(templateBuffer);
    const contentPdf = await PDFDocument.load(contentBuffer);
    
    // Embed fonts from the template
    templatePdf.registerFontkit(fontkit);
    
    // Copy pages from content to template
    const pages = await templatePdf.copyPages(contentPdf, contentPdf.getPageIndices());
    
    // Add each page to the template
    for (const page of pages) {
      templatePdf.addPage(page);
    }
    
    // Save the merged PDF
    const mergedPdf = await templatePdf.save();
    return Buffer.from(mergedPdf);
  } catch (error) {
    console.error('Error merging PDFs:', error);
    // Fallback to just the content if merging fails
    return contentBuffer;
  }
}

// This function should only be called from server-side code
export async function generatePdfFromHtml(
  htmlContent: string,
  options: PdfGenerationOptions = {},
  isOverlay: boolean = false
): Promise<Buffer> {
  // Ensure we're running in a Node.js environment
  if (typeof window !== 'undefined') {
    throw new Error('This function can only be used server-side');
  }
  let browser: Browser | null = null;
  const startTime = Date.now();
  
  try {
    // Configure launch options based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    const launchOptions = isProduction
      ? {
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
          ignoreHTTPSErrors: true,
        }
      : {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
          executablePath: process.platform === 'win32'
            ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
            : process.platform === 'darwin'
            ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            : '/usr/bin/google-chrome',
        };

    // Launch browser
    browser = await launch({
      ...launchOptions,
      headless: true,
    });

    if (!browser) {
      throw new Error('Failed to launch browser');
    }

    const page = await browser.newPage();

    // Set HTML content
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 30000, // 30 seconds timeout
    });

    // Prepare PDF options
    const pdfOptions: PDFOptions = {
      format: 'Letter',
      printBackground: true,
      margin: isOverlay ? {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0',
      } : {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm',
      },
      ...options,
    };

    // Generate PDF
    const pdfData = await page.pdf(pdfOptions);
    
    // Convert Uint8Array to Buffer if needed
    const pdfBuffer = Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(pdfData.buffer);
    
    // Log successful generation
    await logSystemEvent({
      event_type: 'PDF_GENERATED',
      message: `PDF generated successfully (${pdfBuffer.length} bytes)`,
      details: {
        contentLength: htmlContent.length,
        generationTime: Date.now() - startTime,
      },
    });

    return pdfBuffer;
  } catch (err) {
    const error = err as Error;
    const errorMessage = error?.message || 'Unknown error';
    
    await logSystemEvent({
      event_type: 'PDF_GENERATION_ERROR',
      message: 'Failed to generate PDF',
      details: {
        error: errorMessage,
        contentLength: htmlContent?.length || 0,
      },
    });

    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    }
  }
}

/**
 * Generates a PDF from a template with data
 */
export async function generatePdfFromTemplate(
  template: string,
  data: Record<string, unknown>,
  options: PdfGenerationOptions = {}
): Promise<Buffer> {
  const { renderTemplate } = await import('./templateService');
  const htmlContent = renderTemplate(template, data);
  return generatePdfFromHtml(htmlContent, options);
}
