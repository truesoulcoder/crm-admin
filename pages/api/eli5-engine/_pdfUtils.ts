// Core Node.js modules
import fs from 'fs/promises';
import path from 'path';

// Third-party libraries
import { configure, render } from 'nunjucks';
import { PDFDocument } from 'pdf-lib';

// Types and configuration
import { CHROMIUM_ARGS } from './config';

import type { Browser, LaunchOptions, Page } from 'puppeteer-core';

interface ChromiumModule {
  default: {
    executablePath: () => Promise<string>;
    headless: string | boolean;
  };
}

// Configure Nunjucks
const templateDir = path.join(process.cwd(), 'pages', 'api', 'eli5-engine', 'templates');
configure(templateDir, { autoescape: true });

// Define paths to templates (adjust as necessary based on actual location)
// For Nunjucks, 'letter_of_intent_text.html' is resolved relative to 'templateDir'
const BLANK_LETTERHEAD_PDF_FILE = path.join(templateDir, 'blank-letterhead.pdf');
// const ALEX_BRUSH_FONT_FILE = path.join(templateDir, 'AlexBrush-Regular.ttf'); // For reference

export const generateLoiPdf = async (
  personalizationData: any,
  leadId: string, // Used for logging or unique naming if saving temporarily
  contactEmail: string // Used for logging, re-added as per current subtask
): Promise<Buffer | null> => {
  console.log('DEBUG_PDFUTILS_ENTRY: generateLoiPdf function started.');
  
  // Dynamic imports to reduce cold start time
  const [chromiumModule, puppeteer] = await Promise.all([
    import('@sparticuz/chromium-min'),
    import('puppeteer-core')
  ]) as [ChromiumModule, typeof import('puppeteer-core')];
  
  // Initialize Chromium
  const chromium = chromiumModule.default;
  const chromiumPath = await chromium.executablePath();
  console.log('Chromium path:', chromiumPath);
  console.log('DEBUG_PDFUTILS_DATA_RECEIVED: Raw personalizationData:', JSON.stringify(personalizationData));
  console.log('DEBUG_PDFUTILS_CONTACT_NAME_RECEIVED: contact_name type:', typeof personalizationData?.contact_name, 'value:', JSON.stringify(personalizationData?.contact_name));
  
  // Existing informative log, now after the critical entry logs
  console.log(`Generating LOI PDF for lead ID: ${leadId}, contact: ${contactEmail}`); 
  try {
    // 1. Render HTML content using Nunjucks
    const renderedHtml = render('letter_of_intent_text.html', personalizationData as object);

    // 2. Convert HTML to PDF using Puppeteer
    let browser: Browser | null = null;
    try {
      console.log('Launching browser...');
      browser = await puppeteer.launch({
        args: CHROMIUM_ARGS,
        defaultViewport: { 
          width: 1200, 
          height: 1600,
          deviceScaleFactor: 1
        },
        executablePath: chromiumPath,
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
        dumpio: true
      } as LaunchOptions);
      
        const page = await browser.newPage();
        await page.setContent(renderedHtml, { waitUntil: 'networkidle0' });
        
        const contentPdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        // browser.close() is in the finally block

        // 3. Merge with Blank Letterhead using pdf-lib
        const letterheadPdfBytes = await fs.readFile(BLANK_LETTERHEAD_PDF_FILE);
        const contentPdfBytes = contentPdfBuffer; 

        const letterheadPdfDoc = await PDFDocument.load(letterheadPdfBytes);
        const contentPdfDoc = await PDFDocument.load(contentPdfBytes);

        const [contentPageToEmbed] = await letterheadPdfDoc.embedPdf(contentPdfDoc);
        
        const firstPageOfLetterhead = letterheadPdfDoc.getPages()[0];
        if (!firstPageOfLetterhead) {
          throw new Error('Blank letterhead PDF does not contain any pages.');
        }
        
        firstPageOfLetterhead.drawPage(contentPageToEmbed, {
          x: 0, 
          y: 0, 
          width: contentPageToEmbed.width, 
          height: contentPageToEmbed.height,
        });

        const mergedPdfBytes = await letterheadPdfDoc.save();
        console.log(`Successfully generated LOI PDF for lead ID: ${leadId}`);
        return Buffer.from(mergedPdfBytes);

    } catch (error: unknown) {
      console.error(`Error during PDF generation for lead ${leadId}:`, error);
      throw error; // Re-throw to be caught by the outer try-catch
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Error closing browser:', errorMessage);
          console.error(`Error closing Puppeteer browser for lead ${leadId}: ${errorMessage}`);
        }
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Outer error in generateLoiPdf for lead ${leadId}:`, error.message);
      console.error('Stack trace:', error.stack);
    } else {
      console.error(`Unknown error in generateLoiPdf for lead ${leadId}`);
    }
    
    // Log to Supabase if needed
    // if (error instanceof Error) {
    //   await logToSupabase({ 
    //     lead_id: leadId, 
    //     contact_email: contactEmail, 
    //     status: 'PDF_GENERATION_UNHANDLED_ERROR', 
    //     error_message: error.message, 
    //     stack_trace: error.stack || 'No stack trace' 
    //   });
    // }
    
    return null;
  }
};

export default generateLoiPdf;
