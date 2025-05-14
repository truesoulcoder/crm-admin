// src/emailSending.action.ts
"use server"; // If using Next.js App Router with Server Actions

import { google, gmail_v1 } from 'googleapis';
import path from 'path'; // Import path module
import { generateOfferDetails, OfferDetails } from './offerCalculations'; // Adjusted import path

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
  id: string; 
  contact1_name?: string | null;
  contact1_email_1?: string | null;
  property_address?: string | null;
  wholesale_value?: number | null; 
  // ... other lead properties
  // Add any other fields your LOIData needs from Lead, e.g.:
  // property_city?: string;
  // property_state?: string;
  // property_postal_code?: string;
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
export async function prepareAndSendOfferEmail(
  lead: Lead,
  sender: SenderInfo 
): Promise<EmailSendingResult> {
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
  if (!lead.wholesale_value || lead.wholesale_value <= 0) {
    return {
      success: false,
      message: "Invalid or missing wholesale value for lead ID: " + lead.id,
    };
  }

  if (!lead.contact1_email_1) {
    return {
      success: false,
      message: "Missing contact email for lead ID: " + lead.id,
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
    const offerDetails = generateOfferDetails(lead.wholesale_value);

    console.log(`Preparing email for: ${lead.contact1_email_1} from ${sender.fullName}`);
    console.log(`Property: ${lead.property_address || 'N/A'}`);
    console.log(`Offer Amount: $${offerDetails.offerAmount.toFixed(2)}`);
    console.log(`EMD: $${offerDetails.emdAmount.toFixed(2)}`);
    console.log(`Proposed Closing Date: ${offerDetails.closingDateFormatted}`);

    const subject = `An Offer for Your Property at ${lead.property_address}`;
    const emailBody = `
      Dear ${lead.contact1_name || 'Property Owner'},

      We are interested in purchasing your property at ${lead.property_address}.
      Based on our assessment, we would like to make an offer of $${offerDetails.offerAmount.toFixed(2)}.

      Our offer includes an Earnest Money Deposit (EMD) of $${offerDetails.emdAmount.toFixed(2)}.
      We propose a closing date of ${offerDetails.closingDateFormatted} (approximately 14 business days from today).

      Please let us know if you wish to discuss this further.

      Sincerely,
      ${sender.fullName}
      ${sender.title}
      ${COMPANY_NAME}
  `;

    const messageParts = [
      `From: ${sender.fullName} <${sender.email}>`,
      `To: ${recipient}`,
      'Content-Type: text/plain; charset=utf-f8',
      'MIME-Version: 1.0',
      `Subject: ${subject}`,
      '',
      emailBody,
    ];
    const message = messageParts.join('\n');

    // Encode message for Gmail API (Base64Url)
    const encodedMessage = Buffer.from(message)
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
