import fs from 'fs/promises';
import path from 'path';

import { Environment as NunjucksEnvironment, renderString as nunjucksRenderString, configure as nunjucksConfigure } from 'nunjucks';

import { generateLoiPdf } from './_pdfUtils';
import {
  getSupabaseClient,
  getGmailService,
  logToSupabase,
  isValidEmail,
} from './_utils';

// Nunjucks environment setup
const templateDir = path.join(process.cwd(), 'pages', 'api', 'eli5-engine', 'templates');
nunjucksConfigure(templateDir, { autoescape: true });

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
  dryRun?: boolean; // Added for dry run functionality
}

const CRITICAL_PERSONALIZATION_KEYS = [
  'property_address', 'property_city', 'property_state', 'property_zip_code', 'current_date'
  // Add other universally critical keys from personalizationData here
  // e.g., 'contact_name_for_greeting' if 'recipientName' isn't always used for that.
];

const CRITICAL_PDF_PERSONALIZATION_KEYS = [
  // These are critical IF a PDF is being generated
  'offer_price', 'emd_amount', 'title_company'
  // Add other critical keys specific to PDF generation here
];

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

    // --- Comprehensive Validation --- 

    // 1. Validate direct EmailConfig properties
    const configErrors: string[] = [];
    if (!recipientEmail || !isValidEmail(recipientEmail)) configErrors.push('recipientEmail (must be a valid email)');
    if (!recipientName) configErrors.push('recipientName');
    if (!leadId) configErrors.push('leadId');
    if (!senderEmail || !isValidEmail(senderEmail)) configErrors.push('senderEmail (must be a valid email)');
    if (!senderName) configErrors.push('senderName');
    if (!emailSubjectTemplate) configErrors.push('emailSubjectTemplate');
    if (!emailBodyTemplate) configErrors.push('emailBodyTemplate');
    if (!personalizationData) configErrors.push('personalizationData object');
    if (!pdfSettings) configErrors.push('pdfSettings object');

    if (configErrors.length > 0) {
      const errorMsg = `Missing or invalid critical EmailConfig fields: ${configErrors.join(', ')}.`;
      await logToSupabase({
        original_lead_id: leadId || 'unknown',
        contact_email: recipientEmail || 'unknown',
        email_status: 'FAILED_PREPARATION',
        email_error_message: errorMsg,
        campaign_id: campaignId,
        campaign_run_id: campaignRunId,
      });
      return { success: false, error: errorMsg };
    }

    // 2. Validate critical keys in personalizationData
    const missingPersonalizationKeys: string[] = [];
    for (const key of CRITICAL_PERSONALIZATION_KEYS) {
      if (personalizationData[key] === undefined || personalizationData[key] === null || String(personalizationData[key]).trim() === '') {
        missingPersonalizationKeys.push(key);
      }
    }

    if (missingPersonalizationKeys.length > 0) {
      const errorMsg = `Missing critical keys in personalizationData: ${missingPersonalizationKeys.join(', ')}.`;
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

    // 3. Validate critical keys for PDF generation (if applicable)
    if (pdfSettings.generate) {
      const pdfDataToCheck = pdfSettings.personalizationData || personalizationData;
      const missingPdfKeys: string[] = [];
      for (const key of CRITICAL_PDF_PERSONALIZATION_KEYS) {
        if (pdfDataToCheck[key] === undefined || pdfDataToCheck[key] === null || String(pdfDataToCheck[key]).trim() === '') {
          missingPdfKeys.push(key);
        }
      }
      if (missingPdfKeys.length > 0) {
        const errorMsg = `Missing critical keys for PDF generation in ${pdfSettings.personalizationData ? 'pdfSettings.personalizationData' : 'personalizationData'}: ${missingPdfKeys.join(', ')}.`;
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

    // Original recipient email validation (can be kept if isValidEmail is more specific than just presence)
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
    // The specific check for 'property_address' is now covered by CRITICAL_PERSONALIZATION_KEYS.
    // We can remove the old specific check:
    // if (!personalizationData.property_address) {
        const errorMsg = "Missing 'property_address' in personalizationData, which is required.";
        await logToSupabase({
            original_lead_id: leadId,
            contact_email: recipientEmail,
            email_status: 'FAILED_PREPARATION',
            email_error_message: errorMsg,
            campaign_id: campaignId,
            campaign_run_id: campaignRunId,
        });
        // return { success: false, error: errorMsg }; // Covered by loop above
    // }

    // Example of a more specific type/value check (can be expanded or moved to a dedicated validation function)
    // This is just an example, 'assessed_total' might not be universally critical.
    // If it is, add 'assessed_total' to CRITICAL_PERSONALIZATION_KEYS and then perform specific validation if needed.
    if (Object.prototype.hasOwnProperty.call(personalizationData, 'assessed_total') && personalizationData.assessed_total !== null) {
      // Only validate if the key exists and is not null, to avoid errors on optional fields not present.
      // If 'assessed_total' was in CRITICAL_PERSONALIZATION_KEYS, it would be guaranteed to exist here.

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
      sender_name: senderName,        // Ensure sender_name is senderName from config
      // Add any other fixed/derived values needed in all templates
    };

    const nunjucksEnv = new NunjucksEnvironment(null, { 
      throwOnUndefined: true, 
      autoescape: true 
    });

    let emailSubject: string;
    let emailBodyHtml: string;

    try {
      emailSubject = nunjucksEnv.renderString(emailSubjectTemplate, templateContext);
      emailBodyHtml = nunjucksEnv.renderString(emailBodyTemplate, templateContext);
    } catch (error: any) {
      let errorMsg = 'Failed to render email template due to an undefined variable or other templating error.';
      // Nunjucks errors for undefined variables often include the variable name in the message.
      if (error instanceof Error && error.message) {
        errorMsg = `Template rendering error (likely an undefined variable): ${error.message}`;
      } else if (typeof error === 'string') {
        errorMsg = `Template rendering error: ${error}`;
      }
      await logToSupabase({
        original_lead_id: leadId,
        contact_email: recipientEmail,
        email_status: 'FAILED_PREPARATION',
        email_error_message: errorMsg,
        campaign_id: campaignId,
        campaign_run_id: campaignRunId,
        template_context_dump: JSON.stringify(templateContext, null, 2) // Log context for debugging, pretty-printed
      });
      return { success: false, error: errorMsg };
    }

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

    // Send Email or Handle Dry Run
    if (config.dryRun) {
      // DRY RUN: Log what would have been sent and return success
      await logToSupabase({
        original_lead_id: leadId,
        contact_name: recipientName,
        contact_email: recipientEmail,
        sender_name: senderName,
        sender_email_used: senderEmail,
        email_subject_sent: emailSubject,
        email_body_preview_sent: emailBodyHtml.substring(0, 200), // Preview
        pdf_generated: !!pdfBuffer,
        pdf_filename: dynamicPdfFilename,
        email_status: 'DRY_RUN_SUCCESSFUL_PREPARATION',
        email_sent_at: new Date().toISOString(), // Timestamp of dry run processing
        campaign_id: campaignId,
        campaign_run_id: campaignRunId,
      });
      return {
        success: true,
        messageId: 'dry-run-skipped-send',
      };
    }

    // ACTUAL SEND: Proceed with sending the email
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

  } catch (error) {
    let errorMessage = 'An unknown error occurred during email configuration or sending.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    console.error(`Error in sendConfiguredEmail for lead ${config.leadId}:`, error);
    await logToSupabase({
      original_lead_id: config.leadId,
      contact_name: config.recipientName,
      contact_email: config.recipientEmail,
      sender_name: config.senderName,
      sender_email_used: config.senderEmail,
      email_status: 'FAILED_TO_SEND',
      email_error_message: `Email failed: ${errorMessage}`,
      // stack_trace: error.stack, // Optional: log stack trace
      campaign_id: config.campaignId,
      campaign_run_id: config.campaignRunId,
    });
    return { success: false, error: errorMessage };
  }
};
