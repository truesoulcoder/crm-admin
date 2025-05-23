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
    // Define essential lead fields for validation
    const essentialLeadFields: (keyof typeof lead)[] = [
      'property_address',
      'property_city',
      'property_state',
      // 'property_zip_code' is derived, handled separately
      'contact_name',
      'offer_price',
      'emd_amount',
      'closing_date',
      'title_company',
    ];

    const missingFields: string[] = [];

    // Validate essential fields
    essentialLeadFields.forEach(field => {
      if (!lead[field] || String(lead[field]).trim() === '') {
        missingFields.push(field);
      }
    });

    // Validate derived property_zip_code
    const derivedPropertyZipCode = lead.property_postal_code || lead.zip_code || lead.property_zipcode;
    if (!derivedPropertyZipCode || String(derivedPropertyZipCode).trim() === '') {
      missingFields.push('property_zip_code');
    }
    
    const intendedRecipientEmail = lead.contact_email; // For personalization & logging
    const recipientName = lead.contact_name; // Will be validated by essentialLeadFields check

    // Conditional Processing: If essential fields are missing
    if (missingFields.length > 0) {
      const errorMessage = `Missing essential lead data for processing: ${missingFields.join(', ')}`;
      await logToSupabase({
        original_lead_id: leadIdForLogging,
        contact_email: intendedRecipientEmail,
        email_status: 'FAILED_PREPARATION',
        email_error_message: errorMessage,
        campaign_id: 'test-campaign',
      });
      return res.status(400).json({ 
        success: false, 
        error: "Missing essential lead data for processing. Please ensure the lead record in 'useful_leads' is complete.", 
        missing_fields: missingFields 
      });
    }

    // If all essential fields are present, proceed with script logic
    const actualTestRecipientEmail = process.env.TEST_RECIPIENT_EMAIL || 'test-recipient@example.com';

    if (!isValidEmail(actualTestRecipientEmail)) {
        // This log remains as it's about the test recipient email, not lead data
        await logToSupabase({
            original_lead_id: leadIdForLogging,
            contact_email: intendedRecipientEmail,
            actual_recipient_email_sent_to: actualTestRecipientEmail,
            email_status: 'FAILED_TO_SEND', // Or a more specific status like 'FAILED_INVALID_TEST_RECIPIENT'
            email_error_message: `Invalid TEST_RECIPIENT_EMAIL address: ${actualTestRecipientEmail}. Check environment variable.`,
            campaign_id: 'test-campaign',
        });
        return res.status(400).json({ success: false, error: `Invalid TEST_RECIPIENT_EMAIL: ${actualTestRecipientEmail}. Check environment variable.` });
    }

    // 3. Load Email Templates (adjusted numbering)
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

    // Construct templateData using validated lead fields and hardcoded sender details
    const templateData = {
      // Essential lead fields (already validated)
      contact_name: lead.contact_name,
      property_address: lead.property_address,
      property_city: lead.property_city,
      property_state: lead.property_state,
      property_zip_code: derivedPropertyZipCode,
      offer_price: lead.offer_price,
      emd_amount: lead.emd_amount,
      closing_date: lead.closing_date,
      title_company: lead.title_company,
      
      // Other lead fields (can be spread carefully, or selected individually)
      // For safety, explicitly list other fields needed by the template if any.
      // property_type: lead.property_type, // Example if needed
      // ... (add other specific lead fields as required by email template)

      // Sender details (fetched and hardcoded)
      sender_name: activeSenderName,
      sender_email: activeSenderEmail,
      sender_title: "Acquisitions Specialist", // Hardcoded
      company_name: "True Soul Partners LLC", // Hardcoded
      
      // Recipient email for template personalization (e.g., if template uses {{ contact_email }})
      contact_email: intendedRecipientEmail, 
    };

    // 4. Personalize Templates (Subject and Body) (adjusted numbering)
    const emailSubject = nunjucks.renderString(rawSubjectTemplate, templateData);
    const emailBodyHtml = nunjucks.renderString(rawBodyTemplate, templateData);

    // 5. Generate PDF (adjusted numbering)
    const pdfPersonalizationData = {
      ...templateData, // Start with email data
      current_date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      // Ensure all fields from templateData are suitable for PDF or override/add as needed
      // sender_title and company_name are already hardcoded in templateData
    };
    // No need to delete pdfPersonalizationData.date_generated as it's not added.

    const pdfBuffer = await generateLoiPdf(pdfPersonalizationData, leadIdForLogging, intendedRecipientEmail || actualTestRecipientEmail);
    if (!pdfBuffer) {
      await logToSupabase({
        original_lead_id: leadIdForLogging,
        contact_name: recipientName,
        contact_email: intendedRecipientEmail,
        actual_recipient_email_sent_to: actualTestRecipientEmail,
        sender_name: activeSenderName,
        sender_email_used: activeSenderEmail,
        email_subject_sent: emailSubject,
        email_status: 'FAILED_TO_SEND',
        email_error_message: 'PDF generation failed. Check pdfPersonalizationData.',
        // For debugging, optionally log pdfPersonalizationData (be mindful of sensitive info)
        // pdf_data_debug: JSON.stringify(pdfPersonalizationData).substring(0, 500), 
        campaign_id: 'test-campaign',
      });
      return res.status(500).json({ success: false, error: 'PDF generation failed. Ensure all required data is available.' });
    }

    // 6. Create MIME Message (adjusted numbering)
    const rawEmail = createMimeMessage(
      actualTestRecipientEmail, // Send to the test recipient
      activeSenderEmail,
      activeSenderName,
      emailSubject,
      emailBodyHtml,
      { filename: 'Letter_of_Intent.pdf', content: pdfBuffer }
    );
    const base64EncodedEmail = Buffer.from(rawEmail).toString('base64url');

    // 6. Send Email
    const gmail = getGmailService(activeSenderEmail); // Impersonate the sender
    await gmail.users.messages.send({
      userId: 'me', // 'me' refers to the impersonated user (activeSenderEmail)
      requestBody: {
        raw: base64EncodedEmail,
      },
    });

    // 7. Logging Success (adjusted numbering)
    await logToSupabase({
      original_lead_id: leadIdForLogging,
      contact_name: recipientName,
      contact_email: intendedRecipientEmail, // Log who it was intended for
      actual_recipient_email_sent_to: actualTestRecipientEmail, // Log actual recipient
      sender_name: activeSenderName,
      sender_email_used: activeSenderEmail,
      email_subject_sent: emailSubject,
      email_body_preview_sent: emailBodyHtml.substring(0, 200), // Preview
      email_status: 'SENT',
      email_sent_at: new Date().toISOString(),
      campaign_id: 'test-campaign',
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
      actual_recipient_email_sent_to: actualTestRecipientEmail, // Log actual if available, otherwise it might be caught by validation
      email_status: 'FAILED_TO_SEND',
      email_error_message: `Test email failed: ${error.message}`,
      // stack_trace: error.stack, // Optional: log stack trace
      campaign_id: 'test-campaign', // Consider making this dynamic if needed
    });
    return res.status(500).json({ success: false, error: error.message || 'An unknown error occurred.' });
  }
}
