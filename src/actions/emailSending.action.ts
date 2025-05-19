// src/emailSending.action.ts
"use server"; // If using Next.js App Router with Server Actions

import path from 'path'; // Import path module

import { google, gmail_v1 } from 'googleapis';

import { generatePdfFromHtml } from '@/services/pdfService';
import { getAdminSupabaseClient } from '@/services/supabaseAdminService';
import { renderTemplate } from '@/services/templateService';

import { generateOfferDetails, OfferDetails } from './offerCalculations'; // Adjusted import path

const supabase = getAdminSupabaseClient();

const COMPANY_NAME = "True Soul Partners LLC"; // Define company name as a constant

// For other Node.js environments, you might need `require('dotenv').config();` at the entry point.
const SERVICE_ACCOUNT_KEY_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
const TEST_RECIPIENT_EMAIL = process.env.TEST_RECIPIENT_EMAIL;

if (!SERVICE_ACCOUNT_KEY_PATH) {
  console.error("Error: GOOGLE_SERVICE_ACCOUNT_KEY_PATH environment variable is not set.");
  // Potentially throw an error or handle this case as per your application's needs
}
if (!TEST_RECIPIENT_EMAIL) {
  console.error("Error: TEST_RECIPIENT_EMAIL environment variable is not set for testing.");
  // Potentially throw an error or handle this case as per your application's needs
}

export interface Lead {
  id: number;  // Changed to number to match database type
  contact1_name?: string | null;
  contact1_email_1?: string | null;
  contact2_email_1?: string | null;
  contact3_email_1?: string | null;
  property_address?: string | null;
  wholesale_value?: number | null;
  assessed_total?: number | null;
  mls_curr_list_agent_name?: string | null;
  mls_curr_list_agent_email?: string | null;
  // Other lead properties that might be used in templates
  [key: string]: any;  // Allow additional properties for template rendering
}

export interface SenderInfo {
  fullName: string;
  title: string;
  email: string; // Email of the employee to impersonate for sending
}

export interface EmailSendingResult {
  success: boolean;
  message: string;
  messageId?: string | null; // Message ID from Gmail API if successful
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
  subject: string;
  body: string;
  templateId?: string; // ID of the PDF template to use
  leadData?: Record<string, any>; // Lead data for template rendering
  pdfBuffer?: Buffer; // Optional pre-generated PDF buffer
  attachments?: { filename: string; content: Buffer }[]; // Optional attachments (PDFs, etc)
}

export async function prepareAndSendOfferEmail(
  lead: Lead,
  sender: SenderInfo,
  options: EmailOptions
): Promise<EmailSendingResult> {
  // Generate LOI HTML if no PDF buffer is provided
  let pdfBuffer = options.pdfBuffer;
  
  if (!pdfBuffer) {
    try {
      // Generate basic LOI if no template ID is provided
      if (!options.templateId) {
        const loiHtml = `
          <h1>Letter of Intent</h1>
          <p>For property at: ${lead.property_address || 'Unknown Address'}</p>
          <p>Prepared for: ${lead.contact1_name || 'Valued Client'}</p>
          <p>Offer Amount: $${(lead.wholesale_value || 0).toLocaleString()}</p>
        `;
        pdfBuffer = await generatePdfFromHtml(loiHtml);
      } else {
        // Generate PDF from template if template ID is provided
        const { data: template } = await supabase
          .from('templates')
          .select('content')
          .eq('id', options.templateId)
          .single();
          
        if (template?.content) {
          const renderedContent = renderTemplate(template.content, options.leadData || lead);
          pdfBuffer = await generatePdfFromHtml(renderedContent);
        }
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      return {
        success: false,
        message: 'Failed to generate PDF',
        error
      };
    }
  }
  console.log(
    `Preparing email for: ${lead.contact1_email_1} from ${sender.fullName}`
  );
  console.log(`Property: ${lead.property_address}`);

  // Preflight checks
  const serviceAccountKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
  const testRecipientEmail = process.env.TEST_RECIPIENT_EMAIL;

  if (!serviceAccountKeyPath) {
    console.error(
      'Error: GOOGLE_SERVICE_ACCOUNT_KEY_PATH environment variable is not set.'
    );
    // For scripts, it's better to throw or return a failure state clearly
    return { success: false, message: 'Service account key path not set in environment variables.' };
  }
  if (!testRecipientEmail) {
    // This check is specific to the test script's direct use of prepareAndSendOfferEmail
    // In a real scenario, the recipient would come from the lead data.
    console.error(
      'Error: TEST_RECIPIENT_EMAIL environment variable is not set for testing.'
    );
    // return { success: false, message: 'Test recipient email not set for testing.' };
  }

  const absoluteServiceAccountKeyPath = path.resolve(serviceAccountKeyPath);
  console.log('[emailSending.action.ts] Absolute Service Account Key Path:', absoluteServiceAccountKeyPath);

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

  const boundary = `boundary_${Date.now()}`;
  const messageParts = [
    `From: ${sender.fullName} <${sender.email}>`,
    `To: ${recipient}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    emailBody.replace(/\n/g, '\r\n'),
    ''
  ];

  // Add PDF attachment if provided
  if (options.pdfBuffer) {
    const filename = `offer_${lead.id || 'document'}.pdf`;
    const content = options.pdfBuffer.toString('base64');
    
    messageParts.push(
      `--${boundary}`,
      'Content-Type: application/pdf',
      `Content-Disposition: attachment; filename="${filename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      content,
      ''
    );
  }
  
  // Close the message
  messageParts.push(`--${boundary}--`);
  
  const email = messageParts.join('\r\n');

    // Encode message for Gmail API (Base64Url)
    const encodedMessage = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    try {
      console.log('[emailSending.action.ts] Attempting to authenticate with Google...');
      const auth = new google.auth.GoogleAuth({
        keyFile: absoluteServiceAccountKeyPath, // Use absolute path
        scopes: ['https://www.googleapis.com/auth/gmail.send'],
      });

      // const authClient = await auth.getClient(); // This step might not be necessary if passing `auth` instance directly
      // google.options({ auth: authClient }); // This line causes a type error and is not strictly necessary

      const gmail = google.gmail({ version: 'v1', auth: auth }); // Pass the GoogleAuth instance `auth` directly

      console.log(`[emailSending.action.ts] Attempting to send email via Gmail API to: ${recipient}, impersonating: ${sender.email}`);
      const response = await gmail.users.messages.send({
        userId: sender.email, // The user to impersonate (must match service account delegation)
        requestBody: {
          raw: encodedMessage,
        },
      });

      console.log('[emailSending.action.ts] Gmail API Response:', response.data);
      return {
        success: true,
        message: `Offer email successfully sent to ${recipient} (impersonating ${sender.email}). Message ID: ${response.data.id}`,
        messageId: response.data.id,
        offerDetails,
        sender,
      };
    } catch (error: any) {
      console.error('[emailSending.action.ts] Error sending email via Gmail API:', error.message);
      console.error('[emailSending.action.ts] Full error object:', error);
      let errorMessage = 'Failed to send email via Gmail API.';
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage += ` Details: ${error.response.data.error.message} (Code: ${error.response.data.error.code})`;
      }
      return {
        success: false,
        message: errorMessage,
        error: error.message || error, // Store the error message or the whole error
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
