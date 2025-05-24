// Core Node.js modules
import fs from 'fs/promises';
import path from 'path';

// Third-party libraries
import { configure, renderString } from 'nunjucks';
import { PDFDocument } from 'pdf-lib';
import { launch, Browser, LaunchOptions as PuppeteerLaunchOptions } from 'puppeteer-core';

// Shared configuration
import { CHROMIUM_ARGS, getChromePath } from './config';

// Extend LaunchOptions to include ignoreHTTPSErrors
interface LaunchOptions extends PuppeteerLaunchOptions {
  ignoreHTTPSErrors?: boolean;
}

// Type for the personalization data
interface PersonalizationData {
  [key: string]: any;
}

// Set environment variable for Chromium path
const CHROME_PATH = getChromePath();
process.env.CHROME_PATH = CHROME_PATH;

// Configure Nunjucks
try {
  const templateDir = path.join(process.cwd(), 'pages', 'api', 'eli5-engine', 'templates');
  configure(templateDir, { autoescape: true });
} catch (error: unknown) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error('Failed to configure Nunjucks:', errorMessage);
  throw new Error(`Nunjucks configuration failed: ${errorMessage}`);
}

const BLANK_LETTERHEAD_PDF_FILE = path.join(
  process.cwd(), 
  'pages', 
  'api', 
  'eli5-engine', 
  'templates',
  'blank-letterhead.pdf'
);

export const generateLoiPdf = async (
  personalizationData: any,
  leadId: string,
  contactEmail: string
): Promise<Buffer | null> => {
  console.log(`Starting PDF generation for lead ID: ${leadId}`);
  
    let browser: Browser | null = null;

  try {
    // Get Chromium executable path
    const chromiumPath = process.env.CHROME_PATH || CHROME_PATH;
    console.log('Chromium initialized at:', chromiumPath);
    
    // Verify Chromium binary exists
    try {
      await fs.access(chromiumPath);
      console.log('Chromium binary found at:', chromiumPath);
    } catch (accessError: unknown) {
      const errorMessage = accessError instanceof Error ? accessError.message : 'Unknown error';
      console.error('Chromium binary not found at:', chromiumPath, 'Error:', errorMessage);
      throw new Error(`Chromium binary not found: ${chromiumPath}. ${errorMessage}`);
    }
    
    // Render HTML with Nunjucks
    const templateContent = await fs.readFile(
      path.join(process.cwd(), 'pages', 'api', 'eli5-engine', 'templates', 'letter_of_intent_text.html'), 
      'utf-8'
    );
    const renderedHtml = renderString(templateContent, personalizationData as object);
    
    // 2. Launch browser and generate PDF
    console.log('Launching browser...');
    // Create launch options with proper typing for Vercel
    const launchOptions: LaunchOptions = {
      args: [...CHROMIUM_ARGS],
      defaultViewport: {
        width: 1200,
        height: 1600,
        deviceScaleFactor: 1
      },
      executablePath: chromiumPath,
      headless: true,
      ignoreHTTPSErrors: true,
      dumpio: true,
      protocolTimeout: 60000,
      timeout: 30000
    } satisfies LaunchOptions;
    
    // Log launch options without sensitive data
    const { executablePath, ...safeOptions } = launchOptions;
    console.log('Launching browser with options:', {
      ...safeOptions,
      executablePath: '***',
      args: launchOptions.args
    });
    
    // Launch browser with the properly typed options
    browser = await launch(launchOptions);
    
    const page = await browser.newPage();
    await page.setContent(renderedHtml, {
      waitUntil: 'networkidle0',
      timeout: 30000 // 30 seconds timeout
    });
  
    // Generate PDF with proper margins
    const contentPdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });
    
    // 3. Load the blank letterhead
    const letterheadBytes = await fs.readFile(BLANK_LETTERHEAD_PDF_FILE);
    
    // 4. Merge PDFs
    const letterheadPdfDoc = await PDFDocument.load(letterheadBytes);
    const contentPdfDoc = await PDFDocument.load(contentPdfBuffer);
    
    // Copy all pages from content to letterhead
    const [contentPage] = await letterheadPdfDoc.embedPdf(contentPdfDoc);
    const firstPage = letterheadPdfDoc.getPages()[0];
    
    if (!firstPage) {
      throw new Error('Blank letterhead PDF does not contain any pages');
    }
    
    // Draw the content on the letterhead
    firstPage.drawPage(contentPage, {
      x: 0,
      y: 0,
      width: firstPage.getWidth(),
      height: firstPage.getHeight(),
    });
    
    // Save the merged PDF
    const mergedPdfBytes = await letterheadPdfDoc.save();
    console.log(`Successfully generated LOI PDF for lead ID: ${leadId}`);
    
    return Buffer.from(mergedPdfBytes);

  } catch (error) {
    console.error(`Error generating PDF for lead ${leadId}:`, error);
    throw error;
  } finally {
    // Ensure browser is always closed
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
};
