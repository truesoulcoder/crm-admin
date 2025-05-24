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
  
  console.log(`DEBUG_WRAP: drawWrappedText called. Initial Y: ${y}, MaxWidth: ${maxWidth}, FontSize: ${fontSize}, LineHeight: ${lineHeight}, Text snippet: "${text.substring(0, 50)}..."`);

  const words = text.split(' ');
  let currentLine = '';
  let currentY = y;

  for (const word of words) {
    // Check for words longer than maxWidth (basic detection, not full handling)
    const wordWidth = font.widthOfTextAtSize(word, fontSize);
    if (wordWidth > maxWidth) {
      // console.log(`DEBUG_WRAP: Word longer than maxWidth: "${word}" (Width: ${wordWidth})`);
      // If currentLine is not empty, draw it first to make space for the long word
      if (currentLine !== '') {
        console.log(`DEBUG_WRAP: Drawing line at Y: ${currentY}, Line: "${currentLine}" (before long word)`);
        page.drawText(currentLine, { x, y: currentY, font, size: fontSize, color });
        currentY -= lineHeight;
        currentLine = '';
      }
      // Draw the long word on its own line (it will overflow if truly too long)
      console.log(`DEBUG_WRAP: Drawing line at Y: ${currentY}, Line (long word): "${word}"`);
      page.drawText(word, { x, y: currentY, font, size: fontSize, color });
      currentY -= lineHeight;
      continue; // Move to next word
    }

    const testLine = currentLine + (currentLine === '' ? '' : ' ') + word;
    const { width: textWidth } = font.widthOfTextAtSize(testLine, fontSize);

    if (textWidth > maxWidth && currentLine !== '') {
      console.log(`DEBUG_WRAP: Drawing line at Y: ${currentY}, Line: "${currentLine}"`);
      page.drawText(currentLine, { x, y: currentY, font, size: fontSize, color });
      currentLine = word;
      currentY -= lineHeight;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine !== '') {
    console.log(`DEBUG_WRAP: Drawing line at Y: ${currentY}, Line (final): "${currentLine}"`);
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
    // Define drawing parameters
    const pageMargin = 25; // Updated page margin
    let currentY = height - pageMargin; // Start from top, below margin
    const textX = pageMargin;
    const textMaxWidth = width - 2 * pageMargin; // Updated textMaxWidth
    
    const baseFontSize = 11; 
    const titleFontSize = 18; 
    const subtitleFontSize = 13;
    const signatureFontSize = 28; 
    const disclaimerFontSize = 9;

    const bodyLineHeight = baseFontSize * 1.2;
    const disclaimerLineHeight = disclaimerFontSize * 1.2;
    const titleColor = rgb(0,0,0);
    const bodyColor = rgb(0,0,0);
    const subtitleColor = rgb(0.1, 0.1, 0.1);
    const signatureColor = rgb(0.05, 0.2, 0.5);
    const disclaimerColor = rgb(0.3,0.3,0.3);

    // --- Title ---
    page.drawText("LETTER OF INTENT", { // Main Title - Assuming this is the one for increased spacing
      x: textX, // Or centered: (width - helveticaBoldFont.widthOfTextAtSize("LETTER OF INTENT", titleFontSize)) / 2
      y: currentY,
      font: helveticaBoldFont,
      size: titleFontSize,
      color: titleColor,
    });
    currentY -= titleFontSize * 1.5;
    currentY -= bodyLineHeight * 0.75; // Added extra spacing (0.75 of a body line) after title

    // --- Property Address Subtitle ---
    const streetAddress = personalizationData.property_address || "N/A Street Address";
    page.drawText(streetAddress, {
      x: textX,
      y: currentY,
      font: helveticaFont,
      size: subtitleFontSize,
      color: subtitleColor,
    });
    currentY -= subtitleFontSize * 1.2; // Line height for subtitle

    const cityStateZip = `${personalizationData.property_city || "N/A City"}, ${personalizationData.property_state || "N/A State"} ${personalizationData.property_postal_code || "N/A Zip"}`;
    page.drawText(cityStateZip, {
      x: textX,
      y: currentY,
      font: helveticaFont,
      size: subtitleFontSize,
      color: subtitleColor,
    });
    currentY -= subtitleFontSize * 1.5; // Space after address block
    
    // --- Date ---
    const dateText = personalizationData.current_date || "N/A Date";
    page.drawText(dateText, {
        x: width - pageMargin - helveticaFont.widthOfTextAtSize(dateText, baseFontSize), // Align right
        y: currentY,
        font: helveticaFont,
        size: baseFontSize,
        color: bodyColor
    });
    currentY -= bodyLineHeight * 2; // Space after date

    // --- Salutation ---
    page.drawText(`Dear ${personalizationData.greeting_name || "Sir/Madam"},`, {
      x: textX,
      y: currentY,
      font: helveticaFont,
      size: baseFontSize,
      color: bodyColor,
    });
    currentY -= bodyLineHeight * 2; // Extra space after salutation

    // --- Body Paragraph 1 (Introductory) ---
    const introParagraph = `We are pleased to submit this Letter of Intent ("LOI") to purchase the property located at ${personalizationData.property_address || "N/A Property Address"} (the "Property") under the terms and conditions set forth herein. This LOI is an expression of our serious interest in acquiring the Property.`;
    currentY = await drawWrappedText(page, introParagraph, {font: timesRomanFont, fontSize: baseFontSize, x: textX, y: currentY, maxWidth: textMaxWidth, lineHeight: bodyLineHeight, color: bodyColor });
    currentY -= bodyLineHeight; // Space after paragraph

    // --- Offer Summary (Simplified Key-Value) ---
    const offerDetails = [
      { label: "Purchase Price:", value: personalizationData.offer_price || "N/A" },
      { label: "Earnest Money Deposit (EMD):", value: personalizationData.emd_amount || "N/A" },
      { label: "Closing Date:", value: personalizationData.closing_date || "N/A" },
      { label: "Title Company:", value: personalizationData.title_company || "N/A" },
      { label: "Buyer’s Assignment Consideration (BAC):", value: "$10" }, // Added BAC item
    ];
    
    const itemIndentX = textX + 10; // Indent for list items if desired, or use textX
    const listFont = timesRomanFont; // Font for list items
    const listFontSize = baseFontSize; // Font size for list items
    const listColor = bodyColor; // Color for list items
    const valueXOffset = 180; // X offset for the value part of the list item

    for (const detail of offerDetails) {
      page.drawText(detail.label, { x: itemIndentX, y: currentY, font: listFont, size: listFontSize, color: listColor });
      page.drawText(detail.value, { x: itemIndentX + valueXOffset, y: currentY, font: helveticaBoldFont, size: listFontSize, color: listColor });
      currentY -= bodyLineHeight;
    }
    currentY -= bodyLineHeight; // Space after offer details

    // --- 72-Hour Validity Paragraph (Placeholder) ---
    // Replace with actual data from personalizationData if available, e.g., personalizationData.validity_paragraph
    const validityText = personalizationData.validity_paragraph || "This offer is valid for a period of seventy-two (72) hours from the date and time of submission. Should this offer not be accepted within this timeframe, it shall be deemed automatically withdrawn.";
    currentY = await drawWrappedText(page, validityText, {font: timesRomanFont, fontSize: baseFontSize, x: textX, y: currentY, maxWidth: textMaxWidth, lineHeight: bodyLineHeight, color: bodyColor });
    currentY -= bodyLineHeight; // Space after paragraph

    // --- Closing Paragraph (Simplified) ---
    const closingParagraph = "We look forward to the possibility of working with you on this transaction and are excited about the prospect of acquiring this Property. Please indicate your acceptance of these terms by signing below.";
    currentY = await drawWrappedText(page, closingParagraph, {font: timesRomanFont, fontSize: baseFontSize, x: textX, y: currentY, maxWidth: textMaxWidth, lineHeight: bodyLineHeight, color: bodyColor });
    currentY -= bodyLineHeight * 2; // Space before "Warm regards,"

    // --- "Warm regards," ---
    page.drawText("Warm regards,", {
      x: textX,
      y: currentY,
      font: helveticaFont,
      size: baseFontSize,
      color: bodyColor,
    });
    currentY -= bodyLineHeight * 2; // Space for signature

    // --- Sender Signature Block ---
    page.drawText(personalizationData.sender_name || "N/A Sender Name", {
      x: textX,
      y: currentY,
      font: alexBrushFont, // Use AlexBrush or fallback
      size: signatureFontSize,
      color: signatureColor, 
    });
    currentY -= signatureFontSize * 0.8; // Adjust based on font visual size

    page.drawText(personalizationData.sender_name || "N/A Sender Name", {
      x: textX,
      y: currentY,
      font: helveticaFont,
      size: baseFontSize,
      color: bodyColor,
    });
    currentY -= bodyLineHeight;
    page.drawText(personalizationData.sender_title || "N/A Sender Title", {
      x: textX,
      y: currentY,
      font: helveticaFont,
      size: baseFontSize,
      color: bodyColor,
    });
    currentY -= bodyLineHeight;
    page.drawText(personalizationData.company_name || "N/A Company Name", {
      x: textX,
      y: currentY,
      font: helveticaFont,
      size: baseFontSize,
      color: bodyColor,
    });
    currentY -= bodyLineHeight * 3; // More space before disclaimer

    // --- Disclaimer Footer (Simplified) ---
    const disclaimer = "This Letter of Intent is non-binding and is intended solely as a basis for further discussion and negotiation. No contractual obligations will arise between the parties unless and until a definitive written agreement is executed by both parties.";
    // For disclaimer, it's often better to position from bottom if possible, or ensure enough space
    // For now, continuing the flow, but ensure currentY does not go off-page.
    // A check: if currentY < pageMargin + (disclaimerLineHeight * ~3 lines), then reposition.
    if (currentY < pageMargin + (disclaimerLineHeight * 4)) { // Estimate 3 lines for disclaimer + padding
        currentY = pageMargin + (disclaimerLineHeight * 4); // Place it at the bottom with some margin
    }
    
    currentY = await drawWrappedText(page, disclaimer, {font: timesRomanItalicFont, fontSize: disclaimerFontSize, x: textX, y: currentY, maxWidth: textMaxWidth, lineHeight: disclaimerLineHeight, color: disclaimerColor });

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
     // const firstPageFromContent = pagesToEmbed[0]; // This line can be removed as firstPageFromContent is no longer used directly here
     // console.log('DEBUG_PDFUTILS: firstPageFromContent type:', typeof firstPageFromContent); // This log can also be removed

     // Embed the first page (index 0) from the contentPdfToEmbed document
     const [embeddedContentPage] = await letterheadPdfDoc.embedPdf(contentPdfToEmbed, [0]); 
     
     console.log('DEBUG_PDFUTILS: embeddedContentPage type:', typeof embeddedContentPage, 'width:', embeddedContentPage.width, 'height:', embeddedContentPage.height);

     const firstPageOfLetterhead = letterheadPdfDoc.getPages()[0];
     if (!firstPageOfLetterhead) {
         console.error('DEBUG_PDFUTILS: Blank letterhead PDF does not contain any pages.');
         throw new Error('Blank letterhead PDF does not contain any pages.');
     }
     
     // Draw the EMBEDDED page onto the first page of the letterhead
     firstPageOfLetterhead.drawPage(embeddedContentPage, { // Use the 'embeddedContentPage' here
         x: 0, 
         y: 0, 
         width: embeddedContentPage.width, 
         height: embeddedContentPage.height,
     });

     const mergedPdfBytes = await letterheadPdfDoc.save();
     console.log('DEBUG_PDFUTILS: Merged PDF saved, byte length:', mergedPdfBytes.length);
     return Buffer.from(mergedPdfBytes);

  } catch (error: any) {
    console.error(`Error in generateLoiPdf (pdf-lib) for lead ${leadId}: ${error.message}`, error.stack);
    return null;
  }
};
