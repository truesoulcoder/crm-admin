import puppeteer from 'puppeteer';

/**
 * Generates a PDF buffer from provided HTML content using Puppeteer.
 */
export async function generatePdfFromHtml(htmlContent: string): Promise<Buffer> {
  // Launch headless browser
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  // Set HTML
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  // Create PDF
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });

  await browser.close();
  return pdfBuffer;
}
