import fs from 'fs/promises'; // For reading template files and font
import path from 'path';
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib'; // Ensure imports at top
import fontkit from '@pdf-lib/fontkit'; // Added fontkit import

// Define paths (ensure these are correct for your serverless environment)
const templateDir = path.join(process.cwd(), 'pages', 'api', 'eli5-engine', 'templates');
const BLANK_LETTERHEAD_PDF_FILE = path.join(templateDir, 'blank-letterhead.pdf');
const ALEX_BRUSH_FONT_FILE = path.join(templateDir, 'AlexBrush-Regular.ttf');

// Helper function for drawing wrapped text (simplified)
async function drawWrappedText(page: any, text: string, options: any) {
  const { font, fontSize, x, y, maxWidth, lineHeight, color } = options;
  const words = text.split(' ');
  let currentLine = '';
  let currentY = y;

  for (const word of words) {
    const testLine = currentLine + (currentLine === '' ? '' : ' ') + word;
    const { width: textWidth } = font.widthOfTextAtSize(testLine, fontSize);
    if (textWidth > maxWidth && currentLine !== '') {
      page.drawText(currentLine, { x, y: currentY, font, size: fontSize, color });
      currentLine = word;
      currentY -= lineHeight;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine !== '') {
    page.drawText(currentLine, { x, y: currentY, font, size: fontSize, color });
    currentY -= lineHeight; // Adjust Y for the next potential block of text
  }
  return currentY; // Return the Y position after the last line drawn
}


export const generateLoiPdf = async (
  personalizationData: any,
  leadId: string, 
  contactEmail: string 
): Promise<Buffer | null> => {
  console.log('DEBUG_PDFUTILS_ENTRY: generateLoiPdf function started (pdf-lib version).');
  console.log('DEBUG_PDFUTILS_DATA_RECEIVED: Raw personalizationData:', JSON.stringify(personalizationData));
  console.log('DEBUG_PDFUTILS_CONTACT_NAME_RECEIVED: contact_name type:', typeof personalizationData?.contact_name, 'value:', JSON.stringify(personalizationData?.contact_name));
  console.log(`Generating LOI PDF for lead ID: ${leadId}, contact: ${contactEmail} (pdf-lib version)`);

  try {
    // 1. Create New PDF Document for Content
    const contentPdfDoc = await PDFDocument.create();
    contentPdfDoc.registerFontkit(fontkit); // Register fontkit
    const page = contentPdfDoc.addPage(PageSizes.A4); // Using standard A4 size
    const { width, height } = page.getSize();

    // Load Fonts
    const helveticaFont = await contentPdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await contentPdfDoc.embedFont(StandardFonts.HelveticaBold);
    const timesRomanFont = await contentPdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanItalicFont = await contentPdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    
    let alexBrushFont;
    try {
      const alexBrushFontBytes = await fs.readFile(ALEX_BRUSH_FONT_FILE);
      alexBrushFont = await contentPdfDoc.embedFont(alexBrushFontBytes);
    } catch (fontError) {
      console.error("Failed to load Alex Brush font, using Helvetica-Bold as fallback for signature:", fontError);
      alexBrushFont = helveticaBoldFont; // Fallback
    }

    // 2. Draw LOI Content Programmatically
    // Define margins and starting Y position (from top)
    const margin = 50;
    let y = height - margin - 30; // Initial Y, adjusted for potential letterhead space
    const contentWidth = width - 2 * margin;
    const baseFontSize = 10;
    const titleFontSize = 16;
    const subtitleFontSize = 12;
    const signatureFontSize = 24;
    const disclaimerFontSize = 8;
    const lineHeight = baseFontSize * 1.2;
    const smallLineHeight = disclaimerFontSize * 1.2;

    // --- Title ---
    page.drawText("LETTER OF INTENT", {
      x: margin,
      y: y,
      font: helveticaBoldFont,
      size: titleFontSize,
      color: rgb(0, 0, 0),
    });
    y -= titleFontSize * 1.5;

    // --- Property Address Subtitle ---
    page.drawText(personalizationData.property_address || "N/A Property Address", {
      x: margin,
      y: y,
      font: helveticaFont,
      size: subtitleFontSize,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= subtitleFontSize * 1.5;
    
    // --- Date ---
    page.drawText(personalizationData.current_date || "N/A Date", {
        x: width - margin - helveticaFont.widthOfTextAtSize(personalizationData.current_date || "N/A Date", baseFontSize), // Align right
        y: y,
        font: helveticaFont,
        size: baseFontSize,
        color: rgb(0,0,0)
    });
    y -= lineHeight * 2;


    // --- Salutation ---
    page.drawText(`Dear ${personalizationData.greeting_name || "Sir/Madam"},`, {
      x: margin,
      y: y,
      font: helveticaFont,
      size: baseFontSize,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight * 1.5;

    // --- Body Paragraph 1 (Simplified) ---
    const introParagraph = `We are pleased to submit this Letter of Intent ("LOI") to purchase the property located at ${personalizationData.property_address || "N/A"} (the "Property") under the terms and conditions set forth herein. This LOI is an expression of our serious interest in acquiring the Property.`;
    y = await drawWrappedText(page, introParagraph, {font: timesRomanFont, fontSize: baseFontSize, x: margin, y, maxWidth: contentWidth, lineHeight, color: rgb(0,0,0) });
    y -= lineHeight; 

    // --- Offer Summary (Simplified Key-Value) ---
    const offerDetails = [
      { label: "Purchase Price:", value: personalizationData.offer_price || "N/A" },
      { label: "Earnest Money Deposit (EMD):", value: personalizationData.emd_amount || "N/A" },
      { label: "Closing Date:", value: personalizationData.closing_date || "N/A" },
      { label: "Title Company:", value: personalizationData.title_company || "N/A" },
    ];

    for (const detail of offerDetails) {
      page.drawText(detail.label, { x: margin, y: y, font: timesRomanFont, size: baseFontSize, color: rgb(0,0,0) });
      page.drawText(detail.value, { x: margin + 150, y: y, font: helveticaBoldFont, size: baseFontSize, color: rgb(0,0,0) });
      y -= lineHeight;
    }
    y -= lineHeight;


    // --- Closing Paragraph (Simplified) ---
    const closingParagraph = "We look forward to the possibility of working with you on this transaction and are excited about the prospect of acquiring this Property. Please indicate your acceptance of these terms by signing below.";
    y = await drawWrappedText(page, closingParagraph, {font: timesRomanFont, fontSize: baseFontSize, x: margin, y, maxWidth: contentWidth, lineHeight, color: rgb(0,0,0) });
    y -= lineHeight * 2;

    // --- "Warm regards," ---
    page.drawText("Warm regards,", {
      x: margin,
      y: y,
      font: helveticaFont,
      size: baseFontSize,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight * 2; // Space for signature

    // --- Sender Signature Block ---
    page.drawText(personalizationData.sender_name || "N/A Sender Name", {
      x: margin,
      y: y,
      font: alexBrushFont, // Use AlexBrush or fallback
      size: signatureFontSize,
      color: rgb(0.05, 0.2, 0.5), // A blueish color for signature
    });
    y -= signatureFontSize * 0.8; 

    page.drawText(personalizationData.sender_name || "N/A Sender Name", {
      x: margin,
      y: y,
      font: helveticaFont,
      size: baseFontSize,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight;
    page.drawText(personalizationData.sender_title || "N/A Sender Title", {
      x: margin,
      y: y,
      font: helveticaFont,
      size: baseFontSize,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight;
    page.drawText(personalizationData.company_name || "N/A Company Name", {
      x: margin,
      y: y,
      font: helveticaFont,
      size: baseFontSize,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight * 3; // More space before disclaimer

    // --- Disclaimer Footer (Simplified) ---
    const disclaimer = "This Letter of Intent is non-binding and is intended solely as a basis for further discussion and negotiation. No contractual obligations will arise between the parties unless and until a definitive written agreement is executed by both parties.";
    y = height - (height - (y - disclaimerFontSize * 3)); // Approximate bottom placement
    if (y < margin + smallLineHeight * 3) y = margin + smallLineHeight * 3; // Ensure it's not too low
    
    await drawWrappedText(page, disclaimer, {font: timesRomanItalicFont, fontSize: disclaimerFontSize, x: margin, y, maxWidth: contentWidth, lineHeight: smallLineHeight, color: rgb(0.3,0.3,0.3) });

    // ... all page.drawText() and other drawing calls on 'page' from contentPdfDoc are complete ...

     const contentPdfBytes = await contentPdfDoc.save();
     console.log('DEBUG_PDFUTILS: contentPdfBytes type:', typeof contentPdfBytes, 'instanceof Uint8Array:', contentPdfBytes instanceof Uint8Array, 'length:', contentPdfBytes?.length);

     if (!(contentPdfBytes instanceof Uint8Array) || contentPdfBytes.length === 0) {
         console.error('DEBUG_PDFUTILS: contentPdfBytes is invalid or empty. PDF content generation might have failed silently.');
         throw new Error('Generated content PDF bytes are invalid or empty.');
     }

     const BLANK_LETTERHEAD_PDF_FILE = path.join(templateDir, 'blank-letterhead.pdf'); // Ensure templateDir is correctly defined
     const letterheadPdfBytes = await fs.readFile(BLANK_LETTERHEAD_PDF_FILE);

     const letterheadPdfDoc = await PDFDocument.load(letterheadPdfBytes);
     const contentPdfToEmbed = await PDFDocument.load(contentPdfBytes); // This is the dynamically generated content
     
     console.log('DEBUG_PDFUTILS: contentPdfToEmbed (dynamic content) type:', typeof contentPdfToEmbed, 'pageCount:', contentPdfToEmbed?.getPageCount());

     const pagesToEmbed = contentPdfToEmbed.getPages();
     console.log('DEBUG_PDFUTILS: contentPdfToEmbed pages array length:', pagesToEmbed.length);

     if (pagesToEmbed.length === 0) {
         console.error('DEBUG_PDFUTILS: No pages found in dynamically generated content PDF (contentPdfToEmbed).');
         throw new Error('No pages found in the generated content PDF to embed.');
     }
     const firstPageFromContent = pagesToEmbed[0]; // The first page of our dynamically generated content
     console.log('DEBUG_PDFUTILS: firstPageFromContent type:', typeof firstPageFromContent);

     // Copy the first page from the content PDF into the letterhead PDF
     const [copiedPage] = await letterheadPdfDoc.copyPages(contentPdfToEmbed, [0]); // [0] means copy the first page
     console.log('DEBUG_PDFUTILS: copiedPage type:', typeof copiedPage, 'width:', copiedPage.getWidth(), 'height:', copiedPage.getHeight());

     const firstPageOfLetterhead = letterheadPdfDoc.getPages()[0];
     if (!firstPageOfLetterhead) {
         console.error('DEBUG_PDFUTILS: Blank letterhead PDF does not contain any pages.');
         throw new Error('Blank letterhead PDF does not contain any pages.');
     }
     
     // Draw the copied page onto the first page of the letterhead
     // Adjust x, y if content should not start at bottom-left of letterhead page.
     // Common is to overlay directly, or position with slight margins.
     firstPageOfLetterhead.drawPage(copiedPage, {
         x: 0, // Or some margin, e.g., firstPageOfLetterhead.getX() + margin
         y: 0, // Or some margin, e.g., firstPageOfLetterhead.getY() + margin
         width: copiedPage.getWidth(),
         height: copiedPage.getHeight(),
     });

     const mergedPdfBytes = await letterheadPdfDoc.save();
     console.log('DEBUG_PDFUTILS: Merged PDF saved, byte length:', mergedPdfBytes.length);
     return Buffer.from(mergedPdfBytes);

  } catch (error: any) {
    console.error(`Error in generateLoiPdf (pdf-lib) for lead ${leadId}: ${error.message}`, error.stack);
    return null;
  }
};
