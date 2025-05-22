// src/emailSending.action.ts
"use server"; // If using Next.js App Router with Server Actions

import path from 'path'; // Import path module

import { google, gmail_v1 } from 'googleapis';

import { sendEmail as sendEmailViaGmail } from '@/services/gmailService';
import { generatePdfFromHtml } from '@/services/pdfService';
import { getAdminSupabaseClient } from '@/services/supabaseAdminService';
import { renderTemplate } from '@/services/templateService';

import { generateOfferDetails, OfferDetails } from './offerCalculations'; // Adjusted import path

const supabase = getAdminSupabaseClient();

const COMPANY_NAME = "True Soul Partners LLC"; // Define company name as a constant

// For other Node.js environments, you might need `require('dotenv').config();` at the entry point.
const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const TEST_RECIPIENT_EMAIL = process.env.TEST_RECIPIENT_EMAIL;

if (!SERVICE_ACCOUNT_KEY) {
  console.error("Error: GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set.");
  // Potentially throw an error or handle this case as per your application's needs
}
if (!TEST_RECIPIENT_EMAIL) {
  console.error("Error: TEST_RECIPIENT_EMAIL environment variable is not set for testing.");
  // Potentially throw an error or handle this case as per your application's needs
}

export interface Lead {
  id: number;  // Changed to number to match database type
  contact1_name?: string | undefined;
  contact1_email_1?: string | undefined;
  contact2_name?: string | undefined; // Added contact2_name for consistency
  contact2_email_1?: string | undefined;
  contact3_name?: string | undefined; // Added contact3_name for consistency
  contact3_email_1?: string | undefined;
  property_address?: string | undefined;
  wholesale_value?: number | null; // Keep as number | null if 0 is a valid value but null means not set
  assessed_total?: number | null; // Keep as number | null
  mls_curr_list_agent_name?: string | undefined;
  mls_curr_list_agent_email?: string | undefined;
  // Other lead properties that might be used in templates
  [key: string]: any;  // Allow additional properties for template rendering
}

export interface SenderInfo {
  id?: string; // Database ID of the sender
  fullName: string;
  title: string;
  email: string; // Email of the employee to impersonate for sending
}

export interface EmailSendingResult {
  success: boolean;
  message: string;
  messageId?: string | undefined; // Message ID from Gmail API if successful
  threadId?: string | undefined; // Thread ID from Gmail API if successful
  error?: any; // To store any error encountered
  offerDetails?: OfferDetails; 
  sender?: SenderInfo; 
}

/**
 * Prepares and conceptually sends an email with offer details.
 * In a real scenario, this would integrate with an email service (e.g., Resend, SendGrid).
 * 
 * @param lead - The lead data, including wholesale_value.
 * @param sender - An object containing the sender's fullName and title.
 * @returns A result object indicating success or failure and the offer details.
 */
export interface EmailOptions {
  subject: string; // Raw subject template
  body: string;    // Raw body template
  documentHtmlContent?: string; // Raw HTML content for PDF document template
  leadData?: Record<string, any>; // Lead data for rendering all templates
  pdfBuffer?: Buffer; // Optional pre-generated PDF buffer
  attachments?: { filename: string; content: Buffer }[]; // Optional attachments (PDFs, etc)
}

export async function prepareAndSendOfferEmail(
  lead: Lead,
  sender: SenderInfo,
  options: EmailOptions
): Promise<EmailSendingResult> {
  // Generate PDF from documentHtmlContent if no pre-generated pdfBuffer is provided
  let pdfBuffer = options.pdfBuffer;
  
  if (!pdfBuffer && options.documentHtmlContent) {
    try {
      const renderedDocumentHtml = renderTemplate(options.documentHtmlContent, options.leadData || lead);
      pdfBuffer = await generatePdfFromHtml(renderedDocumentHtml);
      console.log('PDF generated successfully from documentHtmlContent.');
    } catch (error) {
      console.error('Error generating PDF from documentHtmlContent:', error);
      return {
        success: false,
        message: 'Failed to generate PDF from document template',
        error
      };
    }
  } else if (!pdfBuffer) {
    // Optional: handle case where no PDF buffer and no documentHTMLContent is provided, e.g., send email without PDF or return error
    console.warn('No PDF buffer or documentHtmlContent provided. Sending email without PDF attachment.');
  }
  console.log(
    `Preparing email for: ${lead.contact1_email_1} from ${sender.fullName}`
  );
  console.log(`Property: ${lead.property_address}`);

  // Preflight checks
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const testRecipientEmail = process.env.TEST_RECIPIENT_EMAIL;

  if (!serviceAccountKey) {
    console.error(
      'Error: GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set.'
    );
    // For scripts, it's better to throw or return a failure state clearly
    return { success: false, message: 'Service account key not set in environment variables.' };
  }
  if (!testRecipientEmail) {
    // This check is specific to the test script's direct use of prepareAndSendOfferEmail
    // In a real scenario, the recipient would come from the lead data.
    console.error(
      'Error: TEST_RECIPIENT_EMAIL environment variable is not set for testing.'
    );
    // return { success: false, message: 'Test recipient email not set for testing.' };
  }

  console.log('[emailSending.action.ts] Using service account key from environment variable');

  // Determine the recipient
  // For testing, we use TEST_RECIPIENT_EMAIL. In production, use lead.contact1_email_1 or other lead emails.
  const recipient = testRecipientEmail || lead.contact1_email_1;
  if (!recipient) {
    return { success: false, message: 'No recipient email address available.' };
  }

  // Offer calculations
  if (!lead.assessed_total || lead.assessed_total <= 0) {
    return {
      success: false,
      message: `Invalid or missing assessed total for lead ID: ${lead.id}`,
    };
  }

  if (!lead.contact1_email_1) {
    return {
      success: false,
      message: `Missing contact email for lead ID: ${lead.id}`,
    };
  }

  // Add validation for sender information
  if (!sender || !sender.fullName || !sender.title || !sender.email) {
    return {
      success: false,
      message: "Missing or incomplete sender information (fullName, title, email).",
    };
  }

  try {
    const offerDetails = generateOfferDetails(lead.assessed_total);

    console.log(`Preparing email for: ${lead.contact1_email_1} from ${sender.fullName}`);
    console.log(`Property: ${lead.property_address || 'N/A'}`);
    console.log(`Offer Amount: $${offerDetails.offerAmount.toFixed(2)}`);
    console.log(`EMD: $${offerDetails.emdAmount.toFixed(2)}`);
    console.log(`Proposed Closing Date: ${offerDetails.closingDateFormatted}`);

    // Render the email body with the template and offer details
  const emailBody = renderTemplate(options.body, {
    ...lead,
    offerAmount: offerDetails.offerAmount.toFixed(2),
    emdAmount: offerDetails.emdAmount.toFixed(2),
    closingDate: offerDetails.closingDateFormatted,
    senderName: sender.fullName,
    senderTitle: sender.title,
    companyName: COMPANY_NAME
  });

  // Render the subject with the template
  const subject = renderTemplate(options.subject, {
    ...lead,
    offerAmount: offerDetails.offerAmount.toFixed(2),
    property_address: lead.property_address || 'Your Property'
  });

    // Prepare attachments
    const attachments: { filename: string; content: Buffer }[] = [];
    if (pdfBuffer) {
      attachments.push({
        filename: 'OfferLetter.pdf', // Consider making filename dynamic or configurable
        content: pdfBuffer,
      });
    }
    // Add any other attachments from options.attachments if provided
    if (options.attachments) {
        attachments.push(...options.attachments);
    }

    // Call the centralized Gmail sending service
    // Assuming emailBody is HTML, as gmailService.sendEmail expects htmlBody
    const sendResult = await sendEmailViaGmail(
      sender.email, // Impersonated user email
      recipient,    // Recipient's email address
      subject,      // Rendered subject
      emailBody,    // Rendered HTML email body. Ensure this is HTML.
      attachments   // Array of attachments
    );

    if (sendResult.success) {
      console.log(`[emailSending.action.ts] Email sent successfully via gmailService. Message ID: ${sendResult.messageId}, Thread ID: ${sendResult.threadId}`);
      return {
        success: true,
        message: `Offer email successfully sent to ${recipient} (impersonating ${sender.email}).`,
        messageId: sendResult.messageId,
        threadId: sendResult.threadId,
        offerDetails,
        sender,
      };
    } else {
      console.error('[emailSending.action.ts] Error sending email via gmailService:', sendResult.error);
      const errorMessage = sendResult.error instanceof Error ? sendResult.error.message : String(sendResult.error);
      return {
        success: false,
        message: `Failed to send email via Gmail API. Details: ${errorMessage}`,
        error: sendResult.error,
        offerDetails,
        sender,
      };
    }
  } catch (error) {
    console.error("Error in prepareAndSendOfferEmail:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return {
      success: false,
      message: `Failed to prepare offer email: ${errorMessage}`,
    };
  }
}
