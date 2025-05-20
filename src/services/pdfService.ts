import chromium from '@sparticuz/chromium';
import puppeteer, { Browser } from 'puppeteer-core';

/**
 * Generates a PDF buffer from provided HTML content using Puppeteer.
 * Works in both local development and Vercel environments.
 */
export async function generatePdfFromHtml(htmlContent: string): Promise<Buffer> {
  let browser: Browser | null = null;
  
  try {
    // Configure launch options based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    const options = isProduction
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
    browser = await puppeteer.launch({
      ...options,
      headless: 'new',
    });

    const page = await browser.newPage();

    // Set HTML content
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 30000, // 30 seconds timeout
    });

    // Generate PDF with proper page settings
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm',
      },
      preferCSSPageSize: true,
    });

    return Buffer.from(pdf);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF preview');
  } finally {
    if (browser) {
      await browser.close().catch(console.error);
    }
  }
}
