// File: src/actions/testEmailSender.script.ts
// To run from project root: npx tsx src/actions/testEmailSender.script.ts 

import dotenv from 'dotenv';
import path from 'path';

// Load .env.local variables
const envConfigPath = path.resolve(process.cwd(), '.env.local');
console.log(`[dotenv-debug] Attempting to load .env file from: ${envConfigPath}`);

const result = dotenv.config({ path: envConfigPath });

if (result.error) {
  console.error('[dotenv-debug] Error loading .env.local file:', result.error);
} else {
  console.log('[dotenv-debug] .env.local file loaded. Parsed variables keys:', result.parsed ? Object.keys(result.parsed) : 'No variables parsed');
  // For security, avoid logging all parsed values unless absolutely necessary for debugging
  // console.log('[dotenv-debug] Parsed content:', result.parsed);
}

console.log('[testEmailSender.script.ts] GOOGLE_SERVICE_ACCOUNT_KEY_PATH (after dotenv):', process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH);
console.log('[testEmailSender.script.ts] TEST_RECIPIENT_EMAIL (after dotenv):', process.env.TEST_RECIPIENT_EMAIL);

import { 
  prepareAndSendOfferEmail, 
  Lead, // Assuming Lead interface is also in emailSending.action.ts or accessible
  SenderInfo // Assuming SenderInfo interface is also in emailSending.action.ts or accessible
} from './emailSending.action'; // Corrected: emailSending.action.ts is in the same directory

// If Lead and SenderInfo are not exported from emailSending.action.ts, 
// and were in a different file that got deleted/moved, we might need to redefine them here
// or ensure they are correctly exported from their new locations.
// For now, assuming they are exported from emailSending.action.ts as per previous discussions.


const runTest = async () => {
  console.log("Starting email sending test...");

  // Sample Lead data - customize as needed for your LOI template
  const sampleLead: Lead = {
    id: "testLead001",
    contact1_name: "Test Property Seller",
    contact1_email_1: "original.seller.contact@example.com", 
    property_address: "123 Test Avenue, Suite 100, Testville, TS 54321",
    wholesale_value: 200000,
    // property_city: "Testville", // Example: if LOIData needs it separately
    // property_state: "TS",       // Example
    // property_postal_code: "54321" // Example
  };

  // Sender data - using Matt Jenkins as specified
  const sampleSender: SenderInfo = {
    fullName: "Matt Jenkins", 
    title: "Acquisitions Director", 
    email: "matt.jenkins@truesoulpartners.com", 
    companyAddress: "456 Corporate Blvd, Business City, BS 67890",
    phone: "555-123-7890",
  };

  console.log("Using SenderInfo:", sampleSender);
  console.log("Using LeadInfo:", sampleLead);
  
  const testRecipientEmail = process.env.TEST_RECIPIENT_EMAIL;
  const serviceAccountKeyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;

  console.log(`Test emails will be sent TO: ${testRecipientEmail} (from .env.local)`);
  console.log(`Service Account Key Path: ${serviceAccountKeyPath} (from .env.local)`);

  if (!testRecipientEmail || !serviceAccountKeyPath) {
    console.error("ERROR: TEST_RECIPIENT_EMAIL or GOOGLE_SERVICE_ACCOUNT_KEY_PATH is not set in .env.local. Aborting test.");
    return;
  }
  
  // This check is useful if TEST_RECIPIENT_EMAIL is different from sampleSender.email
  if (sampleSender.email !== testRecipientEmail) {
      console.warn(`INFO: The sender email (${sampleSender.email}) is different from TEST_RECIPIENT_EMAIL (${testRecipientEmail}). This is fine for this test, as the 'To:' field is hardcoded to TEST_RECIPIENT_EMAIL inside prepareAndSendOfferEmail for testing purposes. Ensure the service account can impersonate ${sampleSender.email}.`);
  }


  try {
    const result = await prepareAndSendOfferEmail(sampleLead, sampleSender);
    console.log("\n--- Test Result ---");
    if (result.success) {
      console.log("✅ Success:", result.message);
      if (result.offerDetails) { // Check if offerDetails exists
        console.log("Offer Details:", result.offerDetails);
      }
    } else {
      console.error("❌ Failure:", result.message);
    }
  } catch (error) {
    console.error("❌ Catastrophic error during test run:", error);
  }
};

runTest();
