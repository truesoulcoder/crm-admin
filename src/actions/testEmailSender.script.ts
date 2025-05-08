// File: src/actions/testEmailSender.script.ts
// To run from project root: ts-node src/actions/testEmailSender.script.ts 
// Ensure your .env.local is loaded. If running this script directly and not via Next.js,
// you might need to explicitly load .env.local if it's not automatically picked up.
// One way: import dotenv from 'dotenv'; dotenv.config({ path: '.env.local' }); (ensure .env.local is at project root)

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
