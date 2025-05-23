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
    // Assuming useful_leads has: contact_email, contact_name, property_address, property_type
    // If not, these will need mapping. For now, using them directly as per subtask instructions.
    const actualTestRecipientEmail = process.env.TEST_RECIPIENT_EMAIL || 'test-recipient@example.com';
    const intendedRecipientEmail = lead.contact_email; // For personalization & logging
    const recipientName = lead.contact_name || 'Valued Contact'; // For personalization

    if (!isValidEmail(actualTestRecipientEmail)) {
        await logToSupabase({
            original_lead_id: leadIdForLogging, // Use fetched lead's ID
            contact_email: intendedRecipientEmail, // Log who it was intended for
            actual_recipient_email_sent_to: actualTestRecipientEmail, // Log actual recipient
            email_status: 'FAILED_TO_SEND',
            email_error_message: `Invalid TEST_RECIPIENT_EMAIL address: ${actualTestRecipientEmail}. Check environment variable.`,
            campaign_id: 'test-campaign',
        });
        return res.status(400).json({ success: false, error: `Invalid TEST_RECIPIENT_EMAIL: ${actualTestRecipientEmail}. Check environment variable.` });
    }


    // 3. Load Email Templates (Subject and Body) (adjusted numbering)
    const emailTemplatePath = path.join(templateDir, 'email_body_with_subject.html');
    let emailHtmlContent: string;
    try {
        emailHtmlContent = await fs.readFile(emailTemplatePath, 'utf-8');
    } catch (e: any) {
        throw new Error(`Failed to read email template: ${e.message}`);
    }
    
    const subjectMatch = emailHtmlContent.match(/<!-- SUBJECT: (.*?) -->/);
    const rawSubjectTemplate = subjectMatch ? subjectMatch[1].trim() : 'Follow Up'; // Default subject
    const rawBodyTemplate = emailHtmlContent.replace(/<!-- SUBJECT: (.*?) -->/, '').trim();

    // Personalization data for email templates
    const templateData = {
      contact_name: recipientName, // Personalized for the lead
      sender_name: activeSenderName,
      property_address: lead.property_address, // Assuming field exists in useful_leads
      property_type: lead.property_type, // Assuming field exists in useful_leads
      // Add other fields from the lead as needed by the template
      ...lead, // Spread all lead fields from useful_leads
      contact_email: intendedRecipientEmail, // For template personalization if {{ contact_email }} is used
      sender_email: activeSenderEmail,
    };

    // 4. Personalize Templates (Subject and Body) (adjusted numbering)
    const emailSubject = nunjucks.renderString(rawSubjectTemplate, templateData);
    const emailBodyHtml = nunjucks.renderString(rawBodyTemplate, templateData);

    // 5. Generate PDF (adjusted numbering)
    // Personalization data for PDF (might be different or extended)
    const pdfPersonalizationData = {
        ...templateData, // Reuse email data or customize
        date_generated: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        // Ensure all fields required by 'letter_of_intent_text.html' are present
    };
    const pdfBuffer = await generateLoiPdf(pdfPersonalizationData, leadIdForLogging, intendedRecipientEmail || actualTestRecipientEmail); // Pass intended or actual for PDF context
    if (!pdfBuffer) {
      await logToSupabase({
        original_lead_id: leadIdForLogging,
        contact_name: recipientName,
        contact_email: intendedRecipientEmail, // Log who it was intended for
        actual_recipient_email_sent_to: actualTestRecipientEmail, // Log actual recipient
        sender_name: activeSenderName,
        sender_email_used: activeSenderEmail,
        email_subject_sent: emailSubject,
        email_status: 'FAILED_TO_SEND',
        email_error_message: 'PDF generation failed.',
        campaign_id: 'test-campaign',
      });
      return res.status(500).json({ success: false, error: 'PDF generation failed.' });
    }

    // 5. Create MIME Message
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
