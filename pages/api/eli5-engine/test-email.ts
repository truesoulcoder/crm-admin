import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import nunjucks from 'nunjucks';
import {
  getSupabaseClient,
  getGmailService,
  logToSupabase,
  isValidEmail,
} from './_utils';
import { generateLoiPdf } from './_pdfUtils';

// Nunjucks environment setup (can be shared if multiple routes use Nunjucks)
const templateDir = path.join(process.cwd(), 'pages', 'api', 'eli5-engine', 'templates');
nunjucks.configure(templateDir, { autoescape: true });

// Hardcoded sender details (replace with dynamic loading or env variables later)
// const TEST_SENDER_EMAIL = process.env.TEST_SENDER_EMAIL || 'chrisphillips@truesoulpartners.com'; // Ensure this is a valid sender for the Gmail service
// const TEST_SENDER_NAME = process.env.TEST_SENDER_NAME || 'Chris Phillips';
// Hardcoded recipient for testing (replace with dynamic or lead's email later)
const TEST_RECIPIENT_EMAIL = process.env.TEST_RECIPIENT_EMAIL || 'test-recipient@example.com';


// Simplified MIME message creation function
const createMimeMessage = (
  to: string,
  from: string,
  fromName: string,
  subject: string,
  htmlBody: string,
  pdfAttachment?: { filename:string; content: Buffer }
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

  email += `--${boundary}--`;
  return email;
};


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const supabase = getSupabaseClient();
  // const leadId = `test-lead-${Date.now()}`; // Placeholder lead ID - will be replaced by fetched lead's ID

  try {
    // 1. Fetch Active Sender from Supabase
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
      throw new Error(`Error fetching active sender: ${senderError.message}`);
    }
    if (!sender) {
      throw new Error('No active sender found in Supabase.');
    }

    const fetchedSenderEmail = sender.email;
    const fetchedSenderName = sender.name;
    // const senderCredentials = sender.credentials_json; // Stored for future use

    const activeSenderEmail = fetchedSenderEmail;
    const activeSenderName = fetchedSenderName;
    // const senderCredentials = sender.credentials_json; // Stored for future use if needed for getGmailService

    // 2. Fetch Sample Lead from useful_leads (adjusted numbering)
    const { data: lead, error: leadError } = await supabase
      .from('useful_leads') // Changed table name
      .select('*')
      .limit(1) // Fetch the first available lead
      .maybeSingle(); // Return single row or null, no error if table empty or multiple rows (due to limit)

    if (leadError) throw new Error(`Error fetching lead from useful_leads: ${leadError.message}`);
    if (!lead) throw new Error('No lead found in useful_leads table for testing.');

    // Use the lead's ID (assuming 'id' or 'uuid' exists) for logging and other purposes
    // For this example, let's assume 'id' is the primary key in 'useful_leads'
    // If 'useful_leads' uses 'uuid', change 'lead.id' to 'lead.uuid' accordingly.
    const leadIdForLogging = lead.id; // Or lead.uuid if that's the identifier

    // Field Compatibility:
    // 1. Essential Lead Fields & Validation
    const essentialLeadFieldKeys: (keyof typeof lead)[] = [
      'property_address',
      'property_city',
      'property_state',
      'contact_name',
      'assessed_total',
    ];
    const missingOrInvalidFields: string[] = [];

    essentialLeadFieldKeys.forEach(field => {
      let value = lead[field];
      // Nunjucks `contact_name` Fix: Convert null/undefined to "" before validation
      if (field === 'contact_name' && (value === null || typeof value === 'undefined')) {
        lead.contact_name = ""; // Modify lead object directly or use a temporary validated object
        value = ""; 
      }
      if (value === null || value === undefined || String(value).trim() === '') {
        missingOrInvalidFields.push(String(field));
      }
    });

    // Validate assessed_total as positive number
    const assessedTotalNumeric = parseFloat(String(lead.assessed_total));
    if (isNaN(assessedTotalNumeric) || assessedTotalNumeric <= 0) {
      if (!missingOrInvalidFields.includes('assessed_total')) { // Avoid duplicate
        missingOrInvalidFields.push('assessed_total (must be a positive number)');
      }
    }

    // Validate property_zip_code source
    const propertyZipCodeSource = lead.property_postal_code || lead.zip_code || lead.property_zipcode;
    if (!propertyZipCodeSource || String(propertyZipCodeSource).trim() === '') {
      missingOrInvalidFields.push('property_zip_code (source: property_postal_code, zip_code, or property_zipcode)');
    }

    const intendedRecipientEmail = lead.contact_email; // For personalization & logging

    if (missingOrInvalidFields.length > 0) {
      const errorMessage = `Missing/invalid essential lead data: ${missingOrInvalidFields.join(', ')}`;
      await logToSupabase({
        original_lead_id: leadIdForLogging,
        contact_email: intendedRecipientEmail,
        // actual_recipient_email_sent_to: actualTestRecipientEmail, // Temporarily removed
        email_status: 'FAILED_PREPARATION',
        email_error_message: errorMessage,
        campaign_id: null, // Updated campaign_id
      });
      return res.status(400).json({
        success: false,
        error: "Missing or invalid essential lead data.",
        missing_fields: missingOrInvalidFields,
      });
    }

    // 2. Calculated and Hardcoded Fields (if lead data validation passes)
    const currentDateFormatted = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const closingDateFormatted = thirtyDaysFromNow.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const titleCompany = "Kristin Blay at Ghrist Law - Patten Title"; // Hardcoded

    // assessedTotalNumeric is already validated to be a positive number
    const offerPriceNumericRawTotal = assessedTotalNumeric; 
    const offerPriceNumeric = offerPriceNumericRawTotal * 0.6;

    if (offerPriceNumeric <= 0) { // Should be rare due to prior assessed_total check, but good to be safe
        const offerCalcErrorMessage = `Calculated offer_price_numeric is not positive: ${offerPriceNumeric}`;
        await logToSupabase({
            original_lead_id: leadIdForLogging,
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
    const propertyZipCode = propertyZipCodeSource as string; // Already validated to be non-empty

    // If all essential fields are present, proceed with script logic
    const actualTestRecipientEmail = process.env.TEST_RECIPIENT_EMAIL || 'test-recipient@example.com';

    if (!isValidEmail(actualTestRecipientEmail)) {
        await logToSupabase({
            original_lead_id: leadIdForLogging,
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
    const sharedData = {
      contact_name: lead.contact_name as string, // Validated
      sender_name: activeSenderName,
      property_address: lead.property_address as string, // Validated
      property_city: lead.property_city as string, // Validated
      property_state: lead.property_state as string, // Validated
      property_zip_code: propertyZipCode, // Validated and assigned
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
    const emailSubject = nunjucks.renderString(rawSubjectTemplate, templateData);
    const emailBodyHtml = nunjucks.renderString(rawBodyTemplate, templateData);

    // 6. Generate PDF
    const pdfBuffer = await generateLoiPdf(pdfPersonalizationData, leadIdForLogging, intendedRecipientEmail || actualTestRecipientEmail);
    if (!pdfBuffer) {
      await logToSupabase({
        original_lead_id: leadIdForLogging,
        contact_name: sharedData.contact_name, // Use from sharedData for consistency
        contact_email: intendedRecipientEmail,
        // actual_recipient_email_sent_to: actualTestRecipientEmail, // Temporarily removed
        sender_name: activeSenderName,
        sender_email_used: activeSenderEmail,
        email_subject_sent: emailSubject,
        email_status: 'FAILED_TO_SEND',
        email_error_message: 'PDF generation failed. Check pdfPersonalizationData.',
        campaign_id: null, // Updated campaign_id
      });
      return res.status(500).json({ success: false, error: 'PDF generation failed. Ensure all required data is available.' });
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
    const rawEmail = createMimeMessage(
      actualTestRecipientEmail, // Send to the test recipient
      activeSenderEmail,
      activeSenderName,
      emailSubject,
      emailBodyHtml,
      { filename: dynamicPdfFilename, content: pdfBuffer } // Updated filename
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
      original_lead_id: leadIdForLogging,
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
        lead_id: leadIdForLogging,
        subject: emailSubject,
    });

  } catch (error: any) {
    console.error('Error in test-email handler:', error);
    // Ensure leadIdForLogging is available for logging if the error happens after lead fetching
    // If lead fetching failed, leadIdForLogging would not be set.
    // Fallback to a generic placeholder if lead is not defined.
    const errorLeadId = typeof lead !== 'undefined' && lead ? (lead.id || lead.uuid) : `test-lead-fetch-failed-${Date.now()}`;
    await logToSupabase({
      original_lead_id: errorLeadId,
      contact_email: typeof intendedRecipientEmail !== 'undefined' ? intendedRecipientEmail : 'unknown_intended', // Log intended if available
      // actual_recipient_email_sent_to: actualTestRecipientEmail, // Temporarily removed. This was already commented out in the source, but ensuring it stays removed.
      email_status: 'FAILED_TO_SEND',
      email_error_message: `Test email failed: ${error.message}`,
      // stack_trace: error.stack, // Optional: log stack trace
      campaign_id: null, // Updated campaign_id
    });
    return res.status(500).json({ success: false, error: error.message || 'An unknown error occurred.' });
  }
}
