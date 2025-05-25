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

// Simplified MIME message creation function
const createMimeMessage = (
  to: string,
  from: string,
  fromName: string,
  subject: string,
  htmlBody: string,
  pdfAttachment?: { filename: string; content: Buffer },
  inlineLogo?: { contentId: string; contentType: string; content: Buffer }
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
  email += `Content-Disposition: inline; filename="logo.png"\r\n\r\n`;
    email += `${inlineLogo.content.toString('base64')}\r\n\r\n`;
  }

  email += `--${boundary}--`;
  return email;
};

export interface EmailConfig {
  recipientEmail: string;
  recipientName: string;
  leadId: string;
  senderEmail: string;
  senderName: string;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
  personalizationData: Record<string, any>;
  pdfSettings: {
    generate: boolean;
    personalizationData?: Record<string, any>;
    filenamePrefix?: string;
  };
  campaignId?: string | null;
  campaignRunId?: string | null;
}

export const sendConfiguredEmail = async (config: EmailConfig): Promise<{ success: boolean; messageId?: string, error?: string }> => {
  const supabase = getSupabaseClient();

  try {
    const {
      recipientEmail,
      recipientName,
      leadId,
      senderEmail,
      senderName,
      emailSubjectTemplate,
      emailBodyTemplate,
      personalizationData,
      pdfSettings,
      campaignId,
      campaignRunId,
    } = config;

    // Validate recipient email
    if (!isValidEmail(recipientEmail)) {
      await logToSupabase({
        original_lead_id: leadId,
        contact_email: recipientEmail, // Use recipientEmail from config
        email_status: 'FAILED_PREPARATION',
        email_error_message: `Invalid recipient email address: ${recipientEmail}.`,
        campaign_id: campaignId,
        campaign_run_id: campaignRunId,
      });
      // Return an error object instead of throwing for consistency
      return { success: false, error: `Invalid recipient email address: ${recipientEmail}.` };
    }
    
    // Essential data validation from personalizationData
    // This is an example; the calling code should ensure personalizationData is adequate.
    // For instance, if 'property_address' is vital for the email body or PDF filename:
    if (!personalizationData.property_address) {
        const errorMsg = "Missing 'property_address' in personalizationData, which is required.";
        await logToSupabase({
            original_lead_id: leadId,
            contact_email: recipientEmail,
            email_status: 'FAILED_PREPARATION',
            email_error_message: errorMsg,
            campaign_id: campaignId,
            campaign_run_id: campaignRunId,
        });
        return { success: false, error: errorMsg };
    }
    // Add more specific essential field checks as needed based on template/PDF requirements.
    // For example, ensuring 'assessed_total' is a positive number if it's used for calculations
    // that are *still* done within this function (ideally, calculations are done before calling).
    if (personalizationData.assessed_total) {
        const numValue = parseFloat(String(personalizationData.assessed_total));
        if (isNaN(numValue) || numValue <= 0) {
            const errorMsg = "'assessed_total' in personalizationData must be a positive number.";
            await logToSupabase({
                original_lead_id: leadId,
                contact_email: recipientEmail,
                email_status: 'FAILED_PREPARATION',
                email_error_message: errorMsg,
                campaign_id: campaignId,
                campaign_run_id: campaignRunId,
            });
            return { success: false, error: errorMsg };
        }
    }
    
    // Fetch Logo Image (can be made conditional or moved, or passed in via EmailConfig if variable)
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
    console.log('DEBUG: Logo fetched successfully, content type:', logoContentType, 'size:', logoImageBuffer?.length);
      }
    } catch (e: any) {
      console.warn('Warning: Error fetching logo image:', e.message); // Non-critical, log as warning
    }

    // Personalization data is now the single source of truth for template rendering.
    // Ensure crucial fields like contact_name, sender_name, etc., are expected to be in personalizationData.
    // The EmailConfig interface already specifies recipientName, senderName, etc., which can be used
    // if they are not intended to be part of the main personalizationData object for templates.
    // For simplicity, we'll assume personalizationData contains all necessary fields for the templates.
    // If specific overrides are needed (e.g. ensuring config.senderName is used over a sender_name in personalizationData),
    // that logic would be added here.

    // Example: Create a template context that prioritizes config-level names/emails
    const templateContext = {
      ...personalizationData, // Base data from lead, etc.
      contact_name: recipientName,    // Override or ensure this specific version is used
      sender_name: senderName,        // Override or ensure this specific version is used
      // Other direct fields from EmailConfig can be added here if needed for templates
    };
    
    // Personalize Templates (Subject and Body)
    // The Nunjucks templates should expect fields from templateContext
    const emailSubject = nunjucks.renderString(emailSubjectTemplate, templateContext);
    const emailBodyHtml = nunjucks.renderString(emailBodyTemplate, templateContext);

    let pdfBuffer: Buffer | null = null;
    let dynamicPdfFilename: string | undefined;

    if (pdfSettings.generate) {
      // Use pdfSettings.personalizationData if provided, otherwise fallback to general personalizationData
      const pdfDataForGeneration = pdfSettings.personalizationData || personalizationData;
      
      // Ensure the data passed to generateLoiPdf includes all necessary fields.
      // For example, generateLoiPdf might expect 'contact_name', 'property_address', etc.
      // These should be present in `pdfDataForGeneration`.
      // We are also passing leadId and recipientEmail as separate arguments to generateLoiPdf as per its signature.
      pdfBuffer = await generateLoiPdf(pdfDataForGeneration, leadId, recipientEmail);

      if (!pdfBuffer) {
        const errorMsg = 'PDF generation failed. Check PDF personalizationData.';
        await logToSupabase({
          original_lead_id: leadId,
          contact_name: recipientName, // from EmailConfig
          contact_email: recipientEmail, // from EmailConfig
          sender_name: senderName, // from EmailConfig
          sender_email_used: senderEmail, // from EmailConfig
          email_subject_sent: emailSubject,
          email_status: 'FAILED_TO_SEND',
          email_error_message: errorMsg,
          campaign_id: campaignId,
          campaign_run_id: campaignRunId,
        });
        // Return an error object instead of throwing for consistency
        return { success: false, error: errorMsg };
      }

      const sanitizeFilename = (name: string | undefined | null): string => {
        if (!name) return 'unknown_address';
        // Replace spaces with underscores, then remove characters not suitable for filenames.
        return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
      };
      
      // Use property_address from the data source used for PDF generation
      const propertyAddressForFilename = pdfDataForGeneration.property_address;
      let sanitizedPropertyAddress = sanitizeFilename(propertyAddressForFilename);
      
      // Fallback if property_address is missing or results in an empty/default string
      if (!sanitizedPropertyAddress || sanitizedPropertyAddress === 'unknown_address') {
          sanitizedPropertyAddress = 'document'; 
      }
      
      const prefix = pdfSettings.filenamePrefix || "Generated_Document";
      dynamicPdfFilename = `${prefix}_${sanitizedPropertyAddress}.pdf`;
    }

    // Create MIME Message
    const rawEmail = createMimeMessage(
      recipientEmail,
      senderEmail,
      senderName,
      emailSubject,
      emailBodyHtml,
      pdfBuffer && dynamicPdfFilename ? { filename: dynamicPdfFilename, content: pdfBuffer } : undefined,
      logoImageBuffer && logoContentType ? { contentId: 'company_logo', contentType: logoContentType, content: logoImageBuffer } : undefined
    );
    const base64EncodedEmail = Buffer.from(rawEmail).toString('base64url');

    // Send Email
    const gmail = getGmailService(senderEmail); // Impersonate the sender from config
    const sendResult = await gmail.users.messages.send({
      userId: 'me', // 'me' refers to the impersonated user (senderEmail)
      requestBody: {
        raw: base64EncodedEmail,
      },
    });

    // Logging Success
    await logToSupabase({
      original_lead_id: leadId,
      contact_name: recipientName,
      contact_email: recipientEmail,
      sender_name: senderName,
      sender_email_used: senderEmail,
      email_subject_sent: emailSubject,
      email_body_preview_sent: emailBodyHtml.substring(0, 200), // Preview
      email_status: 'SENT',
      email_sent_at: new Date().toISOString(),
      campaign_id: campaignId,
      campaign_run_id: campaignRunId,
      // message_id: sendResult.data.id // Store Gmail message ID if needed
    });

    return {
        success: true,
        messageId: sendResult.data.id || undefined, // Return messageId from Gmail API response
    };

  } catch (error: any) {
    console.error(`Error in sendConfiguredEmail for lead ${config.leadId}:`, error);
    await logToSupabase({
      original_lead_id: config.leadId,
      contact_name: config.recipientName,
      contact_email: config.recipientEmail,
      sender_name: config.senderName,
      sender_email_used: config.senderEmail,
      email_status: 'FAILED_TO_SEND',
      email_error_message: `Email failed: ${error.message}`,
      // stack_trace: error.stack, // Optional: log stack trace
      campaign_id: config.campaignId,
      campaign_run_id: config.campaignRunId,
    });
    // throw error; // Re-throw the error to be caught by the caller
    return { success: false, error: error.message || 'An unknown error occurred.' };
  }
};
