// src/emailSending.action.ts
"use server"; // If using Next.js App Router with Server Actions

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
  companyAddress?: string; 
  phone?: string; 
}

export interface EmailSendingResult {
  success: boolean;
  message: string;
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

    // TODO: Implement actual email sending logic here
    const emailSubject = `An Offer for Your Property at ${lead.property_address || 'Your Property'}`;
    const emailBody = `
      Dear ${lead.contact1_name || 'Property Owner'},

      We are interested in purchasing your property at ${lead.property_address || 'N/A'}.
      Based on our assessment, we would like to make an offer of $${offerDetails.offerAmount.toFixed(2)}.

      Our offer includes an Earnest Money Deposit (EMD) of $${offerDetails.emdAmount.toFixed(2)}.
      We propose a closing date of ${offerDetails.closingDateFormatted} (approximately 14 business days from today).

      Please let us know if you wish to discuss this further.

      Sincerely,
      ${sender.fullName}
      ${sender.title}
      ${sender.companyAddress || ''}
      ${sender.phone || ''}
      ${COMPANY_NAME}
    `;
    console.log("--- Email Subject ---");
    console.log(emailSubject);
    console.log("--- Email Body ---");
    console.log(emailBody);

    return {
      success: true,
      message: `Offer email conceptually prepared for ${lead.contact1_email_1}. Offer: $${offerDetails.offerAmount.toFixed(2)}`,
      offerDetails,
      sender,
    };
  } catch (error) {
    console.error("Error in prepareAndSendOfferEmail:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return {
      success: false,
      message: `Failed to prepare offer email: ${errorMessage}`,
    };
  }
}
