import fs from 'fs/promises'; // For reading template files
import path from 'path';
// import puppeteer from 'puppeteer'; // Removed puppeteer
import puppeteer from 'puppeteer-core'; // Added puppeteer-core
import chromium from '@sparticuz/chromium-min'; // Switched to @sparticuz/chromium-min
import nunjucks from 'nunjucks';
import { PDFDocument } from 'pdf-lib';
// import { logToSupabase } from './_utils'; // Assuming logToSupabase is available

// Configure Nunjucks
const templateDir = path.join(process.cwd(), 'pages', 'api', 'eli5-engine', 'templates');
nunjucks.configure(templateDir, { autoescape: true });

// Define paths to templates (adjust as necessary based on actual location)
// For Nunjucks, 'letter_of_intent_text.html' is resolved relative to 'templateDir'
const BLANK_LETTERHEAD_PDF_FILE = path.join(templateDir, 'blank-letterhead.pdf');
// const ALEX_BRUSH_FONT_FILE = path.join(templateDir, 'AlexBrush-Regular.ttf'); // For reference

export const generateLoiPdf = async (
  personalizationData: any,
  leadId: string, // Used for logging or unique naming if saving temporarily
  contactEmail: string // Used for logging, re-added as per current subtask
): Promise<Buffer | null> => {
  // <<< NEW LOGS MUST BE THE VERY FIRST LINES HERE >>>
  console.log('DEBUG_PDFUTILS_ENTRY: generateLoiPdf function started.');
  console.log('DEBUG_PDFUTILS_DATA_RECEIVED: Raw personalizationData:', JSON.stringify(personalizationData));
  console.log('DEBUG_PDFUTILS_CONTACT_NAME_RECEIVED: contact_name type:', typeof personalizationData?.contact_name, 'value:', JSON.stringify(personalizationData?.contact_name));
  
  // Existing informative log, now after the critical entry logs
  console.log(`Generating LOI PDF for lead ID: ${leadId}, contact: ${contactEmail}`); 
  try {
    // 1. Render HTML content using Nunjucks
    const renderedHtml = nunjucks.render('letter_of_intent_text.html', personalizationData);

    // 2. Convert HTML to PDF using Puppeteer
    let browser = null; 
    try {
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(), // For Vercel, this is usually sufficient.
                                                        // Alternatively, use process.env.CHROME_EXECUTABLE_PATH if defined.
        headless: chromium.headless, // This ensures it's 'new' or true as needed for serverless.
        ignoreHTTPSErrors: true, // Often helpful in serverless.
      });
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

    } catch (pdfError: any) {
      console.error(`Error during PDF generation for lead ${leadId}: ${pdfError.message}`, pdfError.stack);
      // await logToSupabase({ lead_id: leadId, contact_email: contactEmail, status: 'PDF_GENERATION_FAILED', error_message: pdfError.message, stack_trace: pdfError.stack });
      return null;
    } finally {
      if (browser && browser.isConnected()) { 
        try {
          await browser.close();
        } catch (closeError: any) {
          console.error(`Error closing Puppeteer browser for lead ${leadId}: ${closeError.message}`, closeError.stack);
        }
      } else if (browser) {
        // If browser is not null but not connected, it might mean it crashed or was already closed.
        // Attempting to close again might not be necessary or could error, but generally puppeteer's close is robust.
        // console.warn(`Puppeteer browser for lead ${leadId} was not connected upon finally block.`);
        // For safety, ensure close is attempted if browser object exists.
         try {
          await browser.close();
        } catch (closeError: any) {
          // Suppress or log differently if it's an error from closing an already disconnected browser
          console.warn(`Error closing (potentially disconnected) Puppeteer browser for lead ${leadId}: ${closeError.message}`);
        }
      }
    }
  } catch (error: any) {
    console.error(`Outer error in generateLoiPdf for lead ${leadId}: ${error.message}`, error.stack);
    // await logToSupabase({ lead_id: leadId, contact_email: contactEmail, status: 'PDF_GENERATION_UNHANDLED_ERROR', error_message: error.message, stack_trace: error.stack });
    return null;
  }
};
