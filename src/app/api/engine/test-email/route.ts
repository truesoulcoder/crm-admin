import fs from 'fs/promises';
import path from 'path';

import { configure, renderString } from 'nunjucks';

import type { NextApiRequest, NextApiResponse } from 'next';

import { generateLoiPdf } from '@/app/api/engine/send-email/_pdfUtils.ts';
import {
  getSupabaseClient,
  getGmailService,
  logToSupabase,
  isValidEmail,
} from '@/app/api/engine/send-email/_utils.ts';


// Nunjucks environment setup (can be shared if multiple routes use Nunjucks)
const templateDir = path.join(process.cwd(), 'pages', 'api', 'eli5-engine', 'templates');
configure(templateDir, { autoescape: true });

// Hardcoded sender details (replace with dynamic loading or env variables later)
// const TEST_SENDER_EMAIL = process.env.TEST_SENDER_EMAIL || 'chrisphillips@truesoulpartners.com'; // Ensure this is a valid sender for the Gmail service
// const TEST_SENDER_NAME = process.env.TEST_SENDER_NAME || 'Chris Phillips';
// Hardcoded recipient for testing (replace with dynamic or lead's email later)
const TEST_RECIPIENT_EMAIL = process.env.TEST_RECIPIENT_EMAIL || 'chrisphillips@truesoulpartners.com';


// Simplified MIME message creation function
const createMimeMessage = (
  to: string,
  from: string,
  fromName: string,
  subject: string,
  htmlBody: string,
  pdfAttachment?: { filename: string; content: Buffer },
  inlineLogo?: { contentId: string; contentType: string; content: Buffer } // New parameter
): string => {
  const boundary = `----=_Part_Boundary_${Math.random().toString(36).substring(2)}`;
  
  let email = `From: "${fromName}" <${from}>\r\n`;
  email += `To: ${to}\r\n`;
  email += `Subject: ${subject}\r\n`;
  email += `MIME-Version: 1.0\r\n`;
  email += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

  // HTML part
  email += `--${boundary}\r\n`;
  email += `Content-Type: text/html; charset="utf-8"\r\n`;
  email += `Content-Transfer-Encoding: 7bit\r\n\r\n`; // Use 7bit for simple HTML, or quoted-printable/base64 for complex content
  email += `${htmlBody}\r\n\r\n`;

  // PDF attachment part
  if (pdfAttachment) {
    email += `--${boundary}\r\n`;
    email += `Content-Type: application/pdf; name="${pdfAttachment.filename}"\r\n`;
    email += `Content-Disposition: attachment; filename="${pdfAttachment.filename}"\r\n`;
    email += `Content-Transfer-Encoding: base64\r\n\r\n`;
    email += `${pdfAttachment.content.toString('base64')}\r\n\r\n`;
  }

  // Inline Logo part
  if (inlineLogo && inlineLogo.content && inlineLogo.contentType) {
    email += `--${boundary}\r\n`;
    email += `Content-Type: ${inlineLogo.contentType}; name="logo.png"\r\n`; // name can be generic
    email += `Content-Transfer-Encoding: base64\r\n`;
    email += `Content-ID: <${inlineLogo.contentId}>\r\n`;
    email += `Content-Disposition: inline; filename="logo.png"\r\n\r\n`; // inline disposition
    email += `${inlineLogo.content.toString('base64')}\r\n\r\n`;
  }

  email += `--${boundary}--`;
  return email;
};


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const supabase = getSupabaseClient();
  let lead: any = null; // Declare lead here to make it accessible in the catch block
  let intendedRecipientEmail: string | undefined = undefined; // Declare for broader scope
  
  const { market_region } = req.body;

  try {
    // 1. Fetch Active Sender from Supabase (remains the same)
    const { data: sender, error: senderError } = await supabase
      .from('senders')
      .select('email, name, credentials_json')
      .eq('is_active', true)
      .eq('status', 'active')
      .order('is_default', { ascending: false })
      .limit(1)
      .single();

    if (senderError) {
      console.error('Supabase error fetching sender:', senderError);
      // Log to Supabase before throwing, or ensure the main catch block handles it if it's a critical setup issue
      await logToSupabase({ email_status: 'FAILED_PREPARATION', email_error_message: `Error fetching active sender: ${senderError.message}`, campaign_id: null });
      // For consistency, return a JSON response rather than just throwing, which might lead to an unhandled promise rejection if not caught upstream.
      return res.status(500).json({ success: false, error: `Error fetching active sender: ${senderError.message}` });
    }
    if (!sender) {
      // This is a critical setup issue.
      await logToSupabase({ email_status: 'FAILED_PREPARATION', email_error_message: 'No active sender found in Supabase.', campaign_id: null });
      return res.status(500).json({ success: false, error: 'No active sender found in Supabase.' });
    }

    const activeSenderEmail = sender.email;
    const activeSenderName = sender.name;

    // 2. Fetch Sample Lead (Dynamically)
    let fetchedLeadData: any = null;
    let leadFetchError: any = null; 
    let leadSourceTable: string = '';

    if (!market_region) {
      console.warn('TEST_EMAIL_HANDLER: Market region not provided in the request.');
      // Log before returning the response
      await logToSupabase({ email_status: 'FAILED_PREPARATION', email_error_message: 'Market region is required for sending a test email.'});
      return res.status(400).json({ 
        success: false, 
        error: 'Market region is required for sending a test email.' 
      });
    }

    console.log(`TEST_EMAIL_HANDLER: Market region provided: ${market_region}. Fetching normalized name.`);
    
    // First, get the normalized name for the market region
    const { data: regionData, error: regionFetchDbError } = await supabase
      .from('market_regions')
      .select('normalized_name')
      .eq('name', market_region)
      .single();

    if (regionFetchDbError) {
      const errorMsg = `Error fetching details for market region '${market_region}': ${regionFetchDbError.message}`;
      console.error(`TEST_EMAIL_HANDLER: ${errorMsg}`);
      await logToSupabase({ email_status: 'FAILED_PREPARATION', email_error_message: errorMsg, campaign_id: null });
      return res.status(500).json({ success: false, error: `Error fetching details for market region '${market_region}'.` });
    }

    if (!regionData || !regionData.normalized_name) {
      const msg = `Market region '${market_region}' not found or has no normalized name. Cannot fetch test lead.`;
      console.warn(`TEST_EMAIL_HANDLER: ${msg}`);
      await logToSupabase({ email_status: 'FAILED_PREPARATION', email_error_message: msg, campaign_id: null });
      return res.status(404).json({ 
        success: false,
        error: msg,
      });
    }
    
    // Construct the table name by combining normalized_name with _fine_cut_leads suffix
    leadSourceTable = `${regionData.normalized_name}_fine_cut_leads`;
    console.log(`TEST_EMAIL_HANDLER: Constructed lead source table name: ${leadSourceTable}`);
    console.log(`TEST_EMAIL_HANDLER: Attempting to fetch lead from dynamic table: ${leadSourceTable}`);

    try {
      const { data: dynamicLeadData, error: dynamicLeadQueryError } = await supabase
        .from(leadSourceTable)
        .select('*')
        .limit(1)
        .maybeSingle();
      
      fetchedLeadData = dynamicLeadData;
      leadFetchError = dynamicLeadQueryError;

    } catch (e:any) { 
       const errorMsg = `Database query construction error for table '${leadSourceTable}': ${e.message}`;
       console.error(`TEST_EMAIL_HANDLER: ${errorMsg}`);
       await logToSupabase({ email_status: 'FAILED_PREPARATION', email_error_message: errorMsg, campaign_id: null });
       return res.status(500).json({ success: false, error: `Internal error preparing query for table '${leadSourceTable}'.` });
    }

    if (leadFetchError) {
      let userMessage = `Error fetching lead from '${leadSourceTable}'.`;
      console.error(`TEST_EMAIL_HANDLER: Supabase error fetching lead from '${leadSourceTable}':`, leadFetchError.message, leadFetchError);
      if (leadFetchError.code === '42P01') { 
         userMessage = `The specific leads table '${leadSourceTable}' for market region '${market_region}' was not found. Please ensure it exists.`;
      }
      await logToSupabase({ email_status: 'FAILED_PREPARATION', email_error_message: `${userMessage} DB Code: ${leadFetchError.code}`, campaign_id: null });
      return res.status(500).json({ success: false, error: userMessage });
    }

    if (!fetchedLeadData) {
      const noLeadMsg = `No lead found in table '${leadSourceTable}' for market region '${market_region}' for testing.`;
      console.warn(`TEST_EMAIL_HANDLER: ${noLeadMsg}`);
      await logToSupabase({ email_status: 'FAILED_PREPARATION', email_error_message: noLeadMsg, campaign_id: null });
      return res.status(404).json({ 
        success: false, 
        error: noLeadMsg,
        details: `The table ${leadSourceTable} was queried, but no leads were returned.`
      });
    }
    lead = fetchedLeadData; 
    console.log(`TEST_EMAIL_HANDLER: Successfully fetched lead from ${leadSourceTable}. Lead ID: ${lead.id}`);

    // ULTRA CRITICAL FIX: Ensure contact_name is a string immediately after fetch (remains important)
    console.log('DEBUG: contact_name BEFORE mutation on lead object:', JSON.stringify(lead.contact_name), typeof lead.contact_name);
    if (lead.contact_name === null || typeof lead.contact_name === 'undefined') {
      lead.contact_name = ""; // Directly mutate the lead object's property
    }
    console.log('DEBUG: contact_name AFTER mutation on lead object:', JSON.stringify(lead.contact_name), typeof lead.contact_name);
    // The useful_leads query uses select('*')

    // Use the lead's ID from useful_leads for the API response.
    const leadIdForApiResponse = lead.id; 

    // Field Compatibility:
    // 1. Essential Lead Fields & Validation
    const essentialLeadFieldKeys: Array<keyof typeof lead> = [
      'property_address',
      'property_city',
      'property_state',
      'property_postal_code',
      'contact_name',
      'assessed_total',
    ];
    const missingFields: string[] = [];

    essentialLeadFieldKeys.forEach(key => {
      const value = lead[key];
      if (key === 'contact_name') {
        if (String(value).trim() === '') { // Ensure value is treated as string for trim
          missingFields.push(key);
        }
      } else if (key === 'assessed_total') {
        if (value === null || typeof value === 'undefined') {
          missingFields.push(key);
        } else {
          const numValue = parseFloat(String(value));
          if (isNaN(numValue) || numValue <= 0) {
            missingFields.push(`${key} (must be a positive number)`);
          }
        }
      } else { // For property_address, property_city, property_state
        if (value === null || typeof value === 'undefined' || (typeof value === 'string' && String(value).trim() === '')) {
          missingFields.push(String(key));
        }
      }
    });
    
    // Check for valid postal code (non-blocking, just log a warning)
    const { property_postal_code, zip_code, property_zipcode } = lead;
    const hasValidPostalCode = [property_postal_code, zip_code, property_zipcode].some(
      code => code && String(code).trim() !== ''
    );
    
    if (!hasValidPostalCode) {
      console.warn('WARNING: No valid postal code found in any field. Continuing anyway for test email.');
      // Don't add to missingFields to prevent blocking the test email
    }

    intendedRecipientEmail = lead.contact_email; // For personalization & logging

    if (missingFields.length > 0) {
      const errorMessage = `Missing/invalid essential lead data: ${missingFields.join(', ')}`;
      await logToSupabase({
        contact_email: intendedRecipientEmail,
        email_status: 'FAILED_PREPARATION',
        email_error_message: errorMessage,
        campaign_id: null,
      });
      return res.status(400).json({
        success: false,
        error: "Missing or invalid essential lead data.",
        missing_fields: missingFields, // Use the collected missingFields
      });
    }

    // 2. Calculated and Hardcoded Fields (if lead data validation passes)
    // Ensure assessed_total is parsed correctly for calculations after validation
    const assessedTotalNumericValidated = parseFloat(String(lead.assessed_total));

    // Fetch Logo Image (early in the handler)
    let logoImageBuffer: Buffer | null = null;
    let logoContentType: string | null = null;
    try {
      const logoUrl = "https://oviiqouhtdajfwhpwbyq.supabase.co/storage/v1/object/public/media//logo-450px.png";
      const response = await fetch(logoUrl);
      if (!response.ok) {
        console.error(`Failed to fetch logo: ${response.status} ${response.statusText}`);
      } else {
        logoContentType = response.headers.get('content-type');
        const arrayBuffer = await response.arrayBuffer();
        logoImageBuffer = Buffer.from(arrayBuffer);
        console.log('DEBUG: Logo fetched successfully, content type:', logoContentType, 'size:', logoImageBuffer.length);
      }
    } catch (e: any) {
      console.error('Error fetching logo image:', e.message);
    }


    const currentDateFormatted = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const closingDateFormatted = thirtyDaysFromNow.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const titleCompany = "Kristin Blay at Ghrist Law - Patten Title"; // Hardcoded
    
    const offerPriceNumericRawTotal = assessedTotalNumericValidated; // Use the validated numeric value
    const offerPriceNumeric = offerPriceNumericRawTotal * 0.5;

    if (offerPriceNumeric <= 0) { // Should be rare due to prior assessed_total check, but good to be safe
        const offerCalcErrorMessage = `Calculated offer_price_numeric is not positive: ${offerPriceNumeric}`;
        await logToSupabase({
            contact_email: intendedRecipientEmail,
            // actual_recipient_email_sent_to: actualTestRecipientEmail, // Temporarily removed
            email_status: 'FAILED_PREPARATION',
            email_error_message: offerCalcErrorMessage,
            campaign_id: null, // Updated campaign_id
        });
        return res.status(400).json({ success: false, error: "Offer price calculation resulted in a non-positive value.", details: offerCalcErrorMessage });
    }

    const offerPriceFormatted = offerPriceNumeric.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const emdAmountNumeric = offerPriceNumeric * 0.01;
    const emdAmountFormatted = emdAmountNumeric.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    
    // Assign validated propertyZipCodeSource to propertyZipCode
    const propertyZipCode = (lead.property_postal_code || lead.zip_code || lead.property_zipcode) as string;


    // If all essential fields are present, proceed with script logic
    const actualTestRecipientEmail = process.env.TEST_RECIPIENT_EMAIL || 'test-recipient@example.com';
    console.log('DEBUG: Initial process.env.TEST_RECIPIENT_EMAIL:', process.env.TEST_RECIPIENT_EMAIL);
    console.log('DEBUG: Initial actualTestRecipientEmail value:', actualTestRecipientEmail);

    if (!isValidEmail(actualTestRecipientEmail)) {
        await logToSupabase({
            contact_email: intendedRecipientEmail,
            // actual_recipient_email_sent_to: actualTestRecipientEmail, // Temporarily removed
            email_status: 'FAILED_TO_SEND',
            email_error_message: `Invalid TEST_RECIPIENT_EMAIL address: ${actualTestRecipientEmail}. Check environment variable.`,
            campaign_id: null, // Updated campaign_id
        });
        return res.status(400).json({ success: false, error: `Invalid TEST_RECIPIENT_EMAIL: ${actualTestRecipientEmail}. Check environment variable.` });
    }

    // 3. Load Email Templates
    const emailTemplatePath = path.join(templateDir, 'email_body_with_subject.html');
    let emailHtmlContent: string;
    try {
        emailHtmlContent = await fs.readFile(emailTemplatePath, 'utf-8');
    } catch (e: any) {
        throw new Error(`Failed to read email template: ${e.message}`);
    }
    
    const subjectMatch = emailHtmlContent.match(/<!-- SUBJECT: (.*?) -->/);
    const rawSubjectTemplate = subjectMatch ? subjectMatch[1].trim() : 'Follow Up';
    const rawBodyTemplate = emailHtmlContent.replace(/<!-- SUBJECT: (.*?) -->/, '').trim();

    // 4. Populate templateData and pdfPersonalizationData
    console.log('DEBUG: lead.contact_name value just before adding to template data obj:', JSON.stringify(lead.contact_name), typeof lead.contact_name);
    
    // Implement greeting_name logic
    let greeting_name_for_template;
    const contactNameValue = lead.contact_name; // This is the string (possibly empty due to prior fix)

    if (contactNameValue && contactNameValue.trim() !== "") {
      greeting_name_for_template = contactNameValue.split(' ')[0];
    } else {
      greeting_name_for_template = "Sir/Madam";
    }
    console.log('DEBUG: Calculated greeting_name_for_template:', greeting_name_for_template);

    const sharedData = {
      contact_name: lead.contact_name as string, // lead.contact_name is now guaranteed string
      greeting_name: greeting_name_for_template, // Add the new pre-processed greeting
      sender_name: activeSenderName,
      property_address: lead.property_address as string, // Validated
      property_city: lead.property_city as string, // Validated
      property_state: lead.property_state as string, // Validated
      property_postal_code: propertyZipCode, // Corrected key for zip code
      assessed_total: lead.assessed_total, // For reference
      current_date: currentDateFormatted,
      closing_date: closingDateFormatted,
      title_company: titleCompany,
      offer_price: offerPriceFormatted,
      emd_amount: emdAmountFormatted,
      sender_title: "Acquisitions Specialist", // Hardcoded
      company_name: "True Soul Partners LLC", // Hardcoded
      contact_email: intendedRecipientEmail,
      sender_email: activeSenderEmail,
      // Add any other fields from `lead` that are safe and needed by templates, e.g.,
      // property_type: lead.property_type, (if it exists and is needed)
    };

    const templateData = { ...sharedData };
    const pdfPersonalizationData = { ...sharedData };
    // Note: current_date is already in sharedData, so it's in both.
    // No need to delete pdfPersonalizationData.date_generated as it's not used/added.


    // 5. Personalize Templates (Subject and Body)
    const emailSubject = renderString(rawSubjectTemplate, templateData) as string;
    const emailBodyHtml = renderString(rawBodyTemplate, templateData) as string;

    // 6. Generate PDF
    console.log('DEBUG_TESTEMAIL: Preparing to call generateLoiPdf.');
    console.log('DEBUG_TESTEMAIL: pdfPersonalizationData.contact_name being passed:', JSON.stringify(pdfPersonalizationData?.contact_name), typeof pdfPersonalizationData?.contact_name);
    console.log('DEBUG_TESTEMAIL: Full pdfPersonalizationData being passed:', JSON.stringify(pdfPersonalizationData));
    
    let pdfBuffer: Buffer | undefined | null = null;
    let pdfFailed = false;
    let pdfErrorMessage = 'PDF generation failed. Ensure all required data is available.'; // Default error message

    try {
      if (typeof generateLoiPdf === 'function') {
        console.log('DEBUG_TESTEMAIL: generateLoiPdf is a function, calling it.');
        pdfBuffer = await generateLoiPdf(pdfPersonalizationData, lead.id, intendedRecipientEmail || actualTestRecipientEmail);
        if (!pdfBuffer) {
            pdfFailed = true;
            pdfErrorMessage = 'PDF generation completed but returned no buffer. Check pdfPersonalizationData.';
            console.warn('WARN_TESTEMAIL:', pdfErrorMessage);
        }
      } else {
        pdfFailed = true;
        pdfErrorMessage = 'PDF generation service is not available (generateLoiPdf is not a function).';
        console.error('CRITICAL_ERROR_TESTEMAIL:', pdfErrorMessage, 'Type:', typeof generateLoiPdf);
      }
    } catch (e: unknown) { // Catch 'unknown' for better type safety
      pdfFailed = true;
      if (e instanceof Error) {
        pdfErrorMessage = `PDF generation caught error: ${e.message}`;
        console.error('ERROR_TESTEMAIL: Error during PDF generation call:', e);
      } else {
        pdfErrorMessage = 'An unknown error occurred during PDF generation.';
        console.error('ERROR_TESTEMAIL: Unknown error during PDF generation call:', e);
      }
    }

    if (pdfFailed || !pdfBuffer) { 
      await logToSupabase({
        contact_name: sharedData.contact_name, // Use from sharedData
        contact_email: intendedRecipientEmail, 
        // actual_recipient_email_sent_to: actualTestRecipientEmail, // Temporarily removed
        sender_name: activeSenderName,
        sender_email_used: activeSenderEmail,
        email_subject_sent: emailSubject,
        email_status: 'FAILED_TO_SEND',
        email_error_message: pdfErrorMessage, 
        campaign_id: null,
      });
      return res.status(500).json({ success: false, error: pdfErrorMessage });
    }

    // 7. Sanitize Property Address and Construct Dynamic PDF Filename
    const sanitizeFilename = (name: string | undefined | null): string => {
      if (!name) return 'unknown_address';
      // Replace spaces with underscores, then remove characters not suitable for filenames.
      // Allows alphanumeric, underscore, hyphen, dot.
      return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
    };

    // lead.property_address is validated as an essential field and is present in sharedData.property_address
    let sanitizedPropertyAddress = sanitizeFilename(sharedData.property_address);
    if (!sanitizedPropertyAddress) { // Fallback if sanitization results in empty string
        sanitizedPropertyAddress = 'default_address_name';
    }
    const dynamicPdfFilename = `Letter_of_Intent_${sanitizedPropertyAddress}.pdf`;

    // 8. Create MIME Message (adjusted numbering)
    console.log('DEBUG: Just before createMimeMessage - intendedRecipientEmail (for personalization):', intendedRecipientEmail);
    console.log('DEBUG: Just before createMimeMessage - actualTestRecipientEmail (should be To):', actualTestRecipientEmail);
    console.log('DEBUG: Just before createMimeMessage - direct process.env.TEST_RECIPIENT_EMAIL:', process.env.TEST_RECIPIENT_EMAIL);
    
    // Define this right before the createMimeMessage call to ensure the freshest .env read
    const finalRecipientForSend = process.env.TEST_RECIPIENT_EMAIL || 'test-recipient@example.com'; 
    console.log('DEBUG: Final recipient being passed to createMimeMessage:', finalRecipientForSend);

    const rawEmail = createMimeMessage(
      finalRecipientForSend, // Ensures the most direct .env var usage
      activeSenderEmail,
      activeSenderName,
      emailSubject,
      emailBodyHtml,
      { filename: dynamicPdfFilename, content: pdfBuffer },
      logoImageBuffer && logoContentType ? { contentId: 'company_logo', contentType: logoContentType, content: logoImageBuffer } : undefined
    );
    const base64EncodedEmail = Buffer.from(rawEmail).toString('base64url');

    // 9. Send Email (adjusted numbering)
    const gmail = getGmailService(activeSenderEmail); // Impersonate the sender
    await gmail.users.messages.send({
      userId: 'me', // 'me' refers to the impersonated user (activeSenderEmail)
      requestBody: {
        raw: base64EncodedEmail,
      },
    });

    // 10. Logging Success (adjusted numbering)
    await logToSupabase({
      contact_name: sharedData.contact_name, // Use from sharedData
      contact_email: intendedRecipientEmail, 
      // actual_recipient_email_sent_to: actualTestRecipientEmail, // Temporarily removed
      sender_name: activeSenderName,
      sender_email_used: activeSenderEmail,
      email_subject_sent: emailSubject,
      email_body_preview_sent: emailBodyHtml.substring(0, 200), // Preview
      email_status: 'SENT',
      email_sent_at: new Date().toISOString(),
      campaign_id: null, // Updated campaign_id
      // campaign_run_id: 'test-run-id' // If applicable
    });

    // 8. Response (adjusted numbering)
    return res.status(200).json({
        success: true,
        message: `Test email successfully sent to ${actualTestRecipientEmail} (personalized for ${intendedRecipientEmail || 'N/A'}) from ${activeSenderEmail}.`,
        lead_id: leadIdForApiResponse, // Using lead.id from useful_leads for API response
        subject: emailSubject,
    });

  } catch (error: any) {
    console.error('Error in test-email handler:', error);
    // Use lead?.id for error logging if lead object is available
    const errorLeadIdForLogging = lead?.id || `test-lead-fetch-failed-${Date.now()}`;
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      errorMessage = error.message;
    }

    await logToSupabase({
      contact_email: typeof intendedRecipientEmail !== 'undefined' ? intendedRecipientEmail : 'unknown_intended', // Log intended if available
      // actual_recipient_email_sent_to: actualTestRecipientEmail, // Temporarily removed.
      email_status: 'FAILED_TO_SEND',
      email_error_message: `Test email failed: ${errorMessage}`,
      // stack_trace: error instanceof Error ? error.stack : undefined, // Optional: log stack trace safely
      campaign_id: null, // Updated campaign_id
    });
    return res.status(500).json({ success: false, error: errorMessage });
  }
}
