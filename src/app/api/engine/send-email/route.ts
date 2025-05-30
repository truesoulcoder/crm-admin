// File: src/app/api/engine/send-email/route.ts
import fs from 'fs/promises';
import path from 'path';

import { NextRequest, NextResponse } from 'next/server';
import { renderString } from 'nunjucks';

import { generateLoiPdf } from './_pdfUtils';
import { getSupabaseClient, getGmailService, logToSupabase, isValidEmail } from './_utils';
import {
  createMimeMessage,
  sanitizeFilename,
} from './helpers';

// Add this near the top of your file with other constants/imports
const templateDir = path.resolve(process.cwd(), 'src/app/api/engine/send-email/templates'); // or your actual templates directory path

interface Lead {
  contact_name?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_postal_code?: number;
  assessed_total?: number;
  contact_email?: string;
  // Add other properties as needed
}

export const dynamic = 'force-dynamic';

export type EmailOptions = {
  to: string;
  subject: string;
  body: string;
  attachments?: Array<{ filename: string; content: string }>;
};

export async function sendConfiguredEmail(options: EmailOptions) {
  // TODO: implement if you ever need to reuse this logic elsewhere
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient();
  let lead: Lead | null = null;
  let intendedRecipientEmail: string | undefined;

  try {
    const body = await req.json();
    const { market_region } = body;

    // ----- 1. load active sender -----
    const { data: sender, error: senderError } = await supabase
      .from('senders')
      .select('email, name, credentials_json')
      .eq('is_active', true)
      .eq('status', 'active')
      .order('is_default', { ascending: false })
      .limit(1)
      .single();

    if (senderError || !sender) {
      const msg = senderError
        ? `Error fetching active sender: ${senderError.message}`
        : 'No active sender found.';
      await logToSupabase({ email_status: 'FAILED_PREPARATION', email_error_message: msg, campaign_id: null });
      return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }

    const activeSenderEmail = sender.email;
    const activeSenderName = sender.name;

    // ----- 2. fetch a lead dynamically by region -----
    if (!market_region) {
      const err = 'Market region is required for sending an email.';
      await logToSupabase({ email_status: 'FAILED_PREPARATION', email_error_message: err });
      return NextResponse.json({ success: false, error: err }, { status: 400 });
    }

    // get normalized table name
    const { data: regionData, error: regionErr } = await supabase
      .from('market_regions')
      .select('normalized_name')
      .eq('name', market_region)
      .single();

    if (regionErr || !regionData?.normalized_name) {
      const err = regionErr
        ? `Error fetching region details: ${regionErr.message}`
        : `Region '${market_region}' not found.`;
      await logToSupabase({ email_status: 'FAILED_PREPARATION', email_error_message: err });
      return NextResponse.json({ success: false, error: err }, { status: regionErr ? 500 : 404 });
    }

    const leadSourceTable = `${regionData.normalized_name}_fine_cut_leads`;
    const { data: fetchedLeadData, error: leadFetchError } = await supabase
      .from(leadSourceTable)
      .select('*')
      .limit(1)
      .maybeSingle();

    if (leadFetchError || !fetchedLeadData) {
      const msg = leadFetchError
        ? (leadFetchError.code === '42P01'
            ? `Table '${leadSourceTable}' not found.`
            : `Error fetching lead: ${leadFetchError.message}`)
        : `No leads found in '${leadSourceTable}'.`;
      await logToSupabase({ email_status: 'FAILED_PREPARATION', email_error_message: msg });
      return NextResponse.json({ success: false, error: msg }, { status: leadFetchError ? 500 : 404 });
    }

    lead = fetchedLeadData;
    intendedRecipientEmail = lead.contact_email;

    // ensure contact_name is a string
    if (lead.contact_name == null) lead.contact_name = '';

    // validate essential fields
    const requiredKeys = [
      'property_address',
      'property_city',
      'property_state',
      'property_postal_code',
      'contact_name',
      'assessed_total'
    ] as const;
    const missing: string[] = [];
    for (const key of requiredKeys) {
      const val = lead[key];
      if (key === 'contact_name' && String(val).trim() === '') {
        missing.push(key);
      } else if (key === 'assessed_total') {
        const n = parseFloat(String(val));
        if (isNaN(n) || n <= 0) missing.push(`${key} (must be positive)`);
      } else if (!val || (typeof val === 'string' && val.trim() === '')) {
        missing.push(key);
      }
    }
    if (missing.length) {
      const err = `Skipping lead ${lead.id} — missing: ${missing.join(', ')}`;
      await logToSupabase({ email_status: 'FAILED_PREPARATION', email_error_message: err });
      return NextResponse.json({ success: false, error: err }, { status: 400 });
    }

    if (!intendedRecipientEmail || !isValidEmail(intendedRecipientEmail)) {
      const err = `Invalid email address: ${intendedRecipientEmail}`;
      await logToSupabase({ contact_email: intendedRecipientEmail, email_status: 'FAILED_TO_SEND', email_error_message: err });
      return NextResponse.json({ success: false, error: err }, { status: 400 });
    }

    // ----- 3. prepare template data -----
   const leadData = lead as Lead;
   
   // Handle potential undefined values with nullish coalescing
   const assessed = parseFloat(String(leadData.assessed_total ?? 0));
   const offerPrice = assessed * 0.5;
   const offerFormatted = offerPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
   const emdFormatted = (offerPrice * 0.01).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
   const now = new Date();
   const currentDate = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
   const closingDate = new Date(now.getTime() + 30*24*60*60*1000)
     .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

   // Validate all shared object fields before proceeding
   const validateField = (value: unknown, fieldName: string): string | null => {
     if (value === undefined || value === null || value === '') {
       return `${fieldName} is required`;
     }
     if (typeof value === 'string' && value.trim() === '') {
       return `${fieldName} cannot be empty`;
     }
     if (fieldName === 'contact_email') {
       if (typeof value !== 'string') {
         return `${fieldName} must be a string`;
       }
       if (!isValidEmail(value)) {
         return `Invalid email format for ${fieldName}`;
       }
     }
     if (fieldName === 'assessed_total' && (isNaN(Number(value)) || Number(value) <= 0)) {
       return `${fieldName} must be a positive number`;
     }
     return null;
   };

   const requiredFields = [
     { name: 'contact_name', value: leadData.contact_name },
     { name: 'sender_name', value: activeSenderName },
     { name: 'property_address', value: leadData.property_address },
     { name: 'property_city', value: leadData.property_city },
     { name: 'property_state', value: leadData.property_state },
     { name: 'property_postal_code', value: leadData.property_postal_code },
     { name: 'assessed_total', value: leadData.assessed_total },
     { name: 'contact_email', value: intendedRecipientEmail },
     { name: 'sender_email', value: activeSenderEmail },
   ];

   const validationErrors: string[] = [];
   for (const field of requiredFields) {
     const error = validateField(field.value, field.name);
     if (error) validationErrors.push(error);
   }

   if (validationErrors.length > 0) {
     const err = `Validation failed: ${validationErrors.join('; ')}`;
     await logToSupabase({ 
       email_status: 'FAILED_VALIDATION', 
       email_error_message: err 
     });
     return NextResponse.json({ success: false, error: err }, { status: 400 });
   }

   // Only create the shared object after all validations pass
   const shared = {
     contact_name: leadData.contact_name!,
     greeting_name: leadData.contact_name!.trim().split(/\s+/)[0],
     sender_name: activeSenderName!,
     property_address: leadData.property_address!,
     property_city: leadData.property_city!,
     property_state: leadData.property_state!,
     property_postal_code: leadData.property_postal_code!,
     assessed_total: leadData.assessed_total!,
     current_date: currentDate,
     closing_date: closingDate,
     title_company: 'Kristin Blay at Ghrist Law - Patten Title',
     offer_price: offerFormatted,
     emd_amount: emdFormatted,
     sender_title: 'Acquisitions Specialist',
     company_name: 'True Soul Partners LLC',
     contact_email: intendedRecipientEmail!,
     sender_email: activeSenderEmail!,
   };

    // load & render email template
    const tmplPath = `${templateDir}/email_body_with_subject.html`;
    const rawHtml = await fs.readFile(tmplPath, 'utf-8');
    const subjectMatch = rawHtml.match(/<!-- SUBJECT: (.*?) -->/);
    const subjectTpl = subjectMatch?.[1].trim() ?? 'Follow Up';
    const bodyTpl = rawHtml.replace(/<!-- SUBJECT: .*? -->/, '').trim();
    const emailSubject = renderString(subjectTpl, shared);
    const emailBodyHtml = renderString(bodyTpl, shared);

    // ----- 4. generate PDF -----
    let pdfBuffer: Buffer | null = null;
    try {
      if (!lead) {
        throw new Error('No lead data available');
      }
      if (!lead.id) {
        throw new Error('Lead ID is missing');
      }
      if (!intendedRecipientEmail) {
        throw new Error('Recipient email is missing');
      }
      
      pdfBuffer = await generateLoiPdf(shared, lead.id, intendedRecipientEmail);
      if (!pdfBuffer) throw new Error('No PDF buffer returned');
        } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during PDF generation';
        const err = `PDF generation failed: ${errorMessage}`;
        await logToSupabase({ 
            ...shared,
            property_postal_code: shared.property_postal_code ? Number(shared.property_postal_code) : null,
            email_status: 'FAILED_TO_SEND', 
            email_error_message: err 
          });
        return NextResponse.json({ success: false, error: err }, { status: 500 });
        }

    // sanitize filename & build MIME
const sanitizeFilename = (address: string): string => {
  return address
    .toLowerCase()                     // Convert to lowercase
    .replace(/[^a-z0-9\s]/g, '')     // Keep only letters, numbers, and spaces
    .trim()                           // Remove leading/trailing spaces
    .replace(/\s+/g, '_')             // Replace spaces with underscores
    .replace(/_+/g, '_')              // Replace multiple underscores with one
    .replace(/_+$/, '');              // Remove trailing underscores
};

const filename = `letter_of_intent_${sanitizeFilename(shared.property_address)}.pdf`;
    const rawEmail = createMimeMessage(
      intendedRecipientEmail!,
      activeSenderEmail,
      activeSenderName,
      emailSubject,
      emailBodyHtml,
      { filename, content: pdfBuffer },
      undefined // inline logo still optional
    );
    const encoded = Buffer.from(rawEmail).toString('base64url');

    // ----- 5. send via Gmail & log success -----
    await getGmailService(activeSenderEmail).users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded },
    });
    await logToSupabase({
      ...shared,
      email_subject_sent: emailSubject,
      email_body_preview_sent: emailBodyHtml.slice(0, 200),
      email_status: 'SENT',
      email_sent_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Email sent to ${intendedRecipientEmail} from ${activeSenderEmail}`,
      lead_id: lead.id,
      subject: emailSubject,
    });
  } catch (err: any) {
    const msg = err?.message || 'Unknown error in POST handler';
    console.error('send-email POST error:', msg);
    await logToSupabase({
      contact_email: typeof intendedRecipientEmail === 'string' ? intendedRecipientEmail : 'unknown',
      email_status: 'FAILED_TO_SEND',
      email_error_message: msg,
      campaign_id: null,
    });
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}