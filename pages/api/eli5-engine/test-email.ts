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
const TEST_SENDER_EMAIL = process.env.TEST_SENDER_EMAIL || 'chrisphillips@truesoulpartners.com'; // Ensure this is a valid sender for the Gmail service
const TEST_SENDER_NAME = process.env.TEST_SENDER_NAME || 'Chris Phillips';
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
  const leadId = `test-lead-${Date.now()}`; // Placeholder lead ID

  try {
    // 1. Fetch Sample Lead
    // const { data: leads, error: leadsError } = await supabase
    //   .from('useful_leads')
    //   .select('*')
    //   .not('property_type', 'eq', 'Vacant Land') // Example filter
    //   .limit(1);

    // Forcing a specific lead for testing as per Python example if needed
     const { data: leads, error: leadsError } = await supabase
        .from('useful_leads')
        .select('*')
        .eq('id', 'e009a334-3139-4252-ae23-830993603458') // Example specific lead ID
        .limit(1);


    if (leadsError) throw new Error(`Error fetching lead: ${leadsError.message}`);
    if (!leads || leads.length === 0) throw new Error('No suitable lead found.');
    const lead = leads[0];
    const recipientEmail = lead.contact_email || TEST_RECIPIENT_EMAIL; // Use lead's email or fallback
    const recipientName = lead.contact_name || 'Valued Contact';

    if (!isValidEmail(recipientEmail)) {
        await logToSupabase({
            original_lead_id: lead.id,
            contact_email: recipientEmail,
            email_status: 'FAILED_TO_SEND',
            email_error_message: 'Invalid recipient email address for testing.',
            campaign_id: 'test-campaign',
        });
        return res.status(400).json({ success: false, error: `Invalid recipient email: ${recipientEmail}` });
    }


    // 2. Load Email Templates (Subject and Body)
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
      contact_name: recipientName,
      sender_name: TEST_SENDER_NAME,
      property_address: lead.property_address,
      property_type: lead.property_type,
      // Add other fields from the lead as needed by the template
      ...lead, // Spread all lead fields
      sender_email: TEST_SENDER_EMAIL, // For use in template if needed
    };

    // 3. Personalize Templates (Subject and Body)
    const emailSubject = nunjucks.renderString(rawSubjectTemplate, templateData);
    const emailBodyHtml = nunjucks.renderString(rawBodyTemplate, templateData);

    // 4. Generate PDF
    // Personalization data for PDF (might be different or extended)
    const pdfPersonalizationData = {
        ...templateData, // Reuse email data or customize
        date_generated: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        // Ensure all fields required by 'letter_of_intent_text.html' are present
    };
    const pdfBuffer = await generateLoiPdf(pdfPersonalizationData, lead.id, recipientEmail);
    if (!pdfBuffer) {
      await logToSupabase({
        original_lead_id: lead.id,
        contact_name: recipientName,
        contact_email: recipientEmail,
        sender_name: TEST_SENDER_NAME,
        sender_email_used: TEST_SENDER_EMAIL,
        email_subject_sent: emailSubject,
        email_status: 'FAILED_TO_SEND',
        email_error_message: 'PDF generation failed.',
        campaign_id: 'test-campaign',
      });
      return res.status(500).json({ success: false, error: 'PDF generation failed.' });
    }

    // 5. Create MIME Message
    const rawEmail = createMimeMessage(
      recipientEmail,
      TEST_SENDER_EMAIL,
      TEST_SENDER_NAME,
      emailSubject,
      emailBodyHtml,
      { filename: 'Letter_of_Intent.pdf', content: pdfBuffer }
    );
    const base64EncodedEmail = Buffer.from(rawEmail).toString('base64url');

    // 6. Send Email
    const gmail = getGmailService(TEST_SENDER_EMAIL); // Impersonate the sender
    await gmail.users.messages.send({
      userId: 'me', // 'me' refers to the impersonated user (TEST_SENDER_EMAIL)
      requestBody: {
        raw: base64EncodedEmail,
      },
    });

    // 7. Logging Success
    await logToSupabase({
      original_lead_id: lead.id,
      contact_name: recipientName,
      contact_email: recipientEmail,
      sender_name: TEST_SENDER_NAME,
      sender_email_used: TEST_SENDER_EMAIL,
      email_subject_sent: emailSubject,
      email_body_preview_sent: emailBodyHtml.substring(0, 200), // Preview
      email_status: 'SENT', // Or 'TEST_SENT'
      email_sent_at: new Date().toISOString(),
      campaign_id: 'test-campaign',
      // campaign_run_id: 'test-run-id' // If applicable
    });

    // 8. Response
    return res.status(200).json({ 
        success: true, 
        message: `Test email successfully sent to ${recipientEmail} from ${TEST_SENDER_EMAIL}.`,
        lead_id: lead.id,
        subject: emailSubject,
    });

  } catch (error: any) {
    console.error('Error in test-email handler:', error);
    await logToSupabase({
      // original_lead_id: leadId, // leadId might not be set if error is early
      email_status: 'FAILED_TO_SEND',
      email_error_message: `Test email failed: ${error.message}`,
      // stack_trace: error.stack, // Optional: log stack trace
      campaign_id: 'test-campaign',
    });
    return res.status(500).json({ success: false, error: error.message || 'An unknown error occurred.' });
  }
}
