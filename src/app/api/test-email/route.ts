import * as fs from 'fs/promises';
import * as path from 'path';

import chromium from '@sparticuz/chromium';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';

import { getEmailTemplate } from '@/services/templateService';

interface SenderInfo {
    sender_name?: string;
    sender_email?: string;
    name?: string;
    email?: string;
}

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!;
const TEST_RECIPIENT_EMAIL = process.env.TEST_RECIPIENT_EMAIL!;

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Lead {
    id: number;
    property_address?: string;
    property_city?: string;
    property_state?: string;
    property_postal_code?: string;
    contact1_name?: string;
    contact1_email_1?: string;
    [key: string]: any; // Allow other properties
}

interface TemplateData {
    property_address?: string;
    property_city?: string;
    property_state?: string;
    property_postal_code?: string;
    contact_name?: string;
    sender_name?: string;
    sender_title?: string;
    company_name?: string;
    // LOI specific fields
    current_date?: string;
    offer_price?: string;
    emd_amount?: string;
    closing_date?: string;
    title_company?: string;
    property_zip_code?: string; // Alias for property_postal_code for LOI template
}

// Helper function to render email template (for email body)
function renderEmailTemplate(template: string, data: TemplateData): string {
    let rendered = template;
    // Handle complex {{ contact_name.split(' ')[0] if contact_name else 'there' }}
    rendered = rendered.replace(/\{\{\s*contact_name\.split\(' '\)\[0\]\s+if\s+contact_name\s+else\s+'there'\s*\}\}/g, data.contact_name ? data.contact_name.split(' ')[0] : 'there');
    
    for (const key in data) {
        const regex = new RegExp(`\\{\\{\s*${key}\s*\\}\\}`, 'g');
        const value = data[key as keyof TemplateData];
        rendered = rendered.replace(regex, value !== undefined && value !== null ? String(value) : '');
    }
    return rendered;
}

// Helper function to render LOI template
function renderLoiTemplate(template: string, data: TemplateData): string {
    let rendered = template;

    // Handle {{ (contact_name.split(' ')[0] if contact_name and contact_name.strip() else 'Sir/Madam') | title }}
    rendered = rendered.replace(
        /\{\{\s*\(\s*contact_name\.split\(' '\)\[0\]\s+if\s+contact_name\s+and\s+contact_name\.strip\(\)\s+else\s+'Sir\/Madam'\s*\)\s*\|\s*title\s*\}\}/g,
        () => {
            if (data.contact_name && data.contact_name.trim()) {
                const firstName = data.contact_name.split(' ')[0];
                return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
            }
            return 'Sir/Madam';
        }
    );
    
    for (const key in data) {
        const regex = new RegExp(`\\{\\{\s*${key}\s*\\}\\}`, 'g');
        const value = data[key as keyof TemplateData];
        rendered = rendered.replace(regex, value !== undefined && value !== null ? String(value) : '');
    }
    return rendered;
}


async function generateLoiPdf(leadData: Lead, loiTemplateData: TemplateData): Promise<Buffer | null> {
    try {
        const loiHtmlTemplatePath = path.resolve(process.cwd(), 'src', 'app', 'ELI5-ENGINE', 'templates', 'letter_of_intent_text.html');
        let htmlContent = await fs.readFile(loiHtmlTemplatePath, 'utf-8');

        const fontPath = path.resolve(process.cwd(), 'src', 'app', 'ELI5-ENGINE', 'templates', 'AlexBrush-Regular.ttf');
        const fontBuffer = await fs.readFile(fontPath);
        const fontBase64 = fontBuffer.toString('base64');
        const fontDataUri = `data:font/truetype;charset=utf-8;base64,${fontBase64}`;

        // Embed font into HTML
        htmlContent = htmlContent.replace(`src: url('AlexBrush-Regular.ttf') format('truetype');`, `src: url('${fontDataUri}') format('truetype');`);
        
        const renderedHtml = renderLoiTemplate(htmlContent, loiTemplateData);

        const browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: true, // Force headless mode
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        await page.setContent(renderedHtml, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'letter', printBackground: true });
        await browser.close();

        return pdfBuffer;

    } catch (error) {
        console.error('Error generating PDF:', error);
        await logEmailAttempt(leadData, loiTemplateData.contact_name || 'N/A', loiTemplateData.sender_name || 'N/A', 'N/A', 'PDF Generation Failed', '', 'FAILED_TO_SEND', `Error generating PDF: ${(error as Error).message}`);
        return null;
    }
}


async function logEmailAttempt(
    lead: Lead | null,
    contactName: string,
    senderName: string,
    senderEmail: string,
    subject: string,
    bodyPreview: string,
    status: 'SENT' | 'FAILED_TO_SEND' | 'SKIPPED' | 'PENDING_SEND' | 'PDF Generation Failed',
    errorMessage?: string
) {
    const logEntry = {
        original_lead_id: lead?.id,
        contact_name: contactName,
        contact_email: TEST_RECIPIENT_EMAIL, // Log against the test recipient
        property_address: lead?.property_address,
        property_city: lead?.property_city,
        property_state: lead?.property_state,
        property_postal_code: lead?.property_postal_code,
        sender_name: senderName,
        sender_email_used: senderEmail,
        email_subject_sent: subject,
        email_body_preview_sent: bodyPreview.substring(0, 255), // Preview of HTML body
        email_status: status,
        email_error_message: errorMessage,
        email_sent_at: status === 'SENT' ? new Date().toISOString() : null,
        processed_at: new Date().toISOString(),
        // Add other fields from lead if necessary, e.g., market_region
    };

    const { error: logError } = await supabase.from('eli5_email_log').insert([logEntry]);
    if (logError) {
        console.error('Failed to log email attempt:', logError);
    }
}

export async function POST(req: NextRequest) {
    console.log('Test email endpoint called');
    
    if (!GOOGLE_SERVICE_ACCOUNT_KEY) {
        console.error('Google Service Account Key not configured');
        return NextResponse.json({ error: 'Google Service Account Key not configured' }, { status: 500 });
    }

    let lead: Lead | null = null; // Define lead here to be accessible in the catch block

    try {
        // All the main logic for fetching lead, preparing data, generating PDF, sending email goes here.

        const { data: fetchedLeads, error: fetchError } = await supabase
            .from('useful_leads')
            .select('*')
            .not('contact_name', 'is', null)
            .not('contact_email', 'is', null)
            .not('property_address', 'is', null)
            .limit(1)
            .single();

        if (fetchError || !fetchedLeads) {
            console.error('Error fetching lead:', fetchError);
            await logEmailAttempt(null, 'N/A', 'N/A', 'N/A', 'Lead Fetch Failed', '', 'FAILED_TO_SEND', 'Failed to fetch lead for test email.');
            return NextResponse.json({ error: 'Failed to fetch lead for test email' }, { status: 500 });
        }
        lead = fetchedLeads as Lead;

        // 3. Get email template (using a default template ID or fetch the first available)
        const DEFAULT_TEMPLATE_ID = 'default-email-template';
        const emailTemplate = await getEmailTemplate(DEFAULT_TEMPLATE_ID);
        if (!emailTemplate) {
            console.warn('No email template found with ID, using default template', DEFAULT_TEMPLATE_ID);
            // Continue with the rest of the flow which uses the local template file as fallback
        } else {
            console.log('Using email template:', emailTemplate.name);
        }

        // 5. Get sender info from senders.csv
        const sendersCsvPath = path.join(process.cwd(), 'src', 'app', 'ELI5-ENGINE', 'csv', 'senders.csv');
        
        // Read and parse senders.csv
        let csvContent: string;
        try {
            csvContent = await fs.readFile(sendersCsvPath, 'utf-8');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Failed to read senders.csv:', errorMessage);
            return NextResponse.json({ error: 'Failed to load sender information' }, { status: 500 });
        }

        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        }) as SenderInfo[];
        
        if (records.length === 0) {
            console.error('No senders found in senders.csv');
            return NextResponse.json({ error: 'No senders configured' }, { status: 500 });
        }
        
        // Use the first sender from the CSV
        const sender = records[0];
        if (!sender.sender_name || !sender.sender_email) {
            console.error('Invalid sender format in senders.csv');
            return NextResponse.json({ error: 'Invalid sender format' }, { status: 500 });
        }
        
        const senderInfo = {
            email: sender.sender_email,
            name: sender.sender_name
        };

        const contactName = lead.contact1_name!;

        // 1. Prepare data for email template
        const emailTemplateData = {
            property_address: lead.property_address || 'N/A',
            property_city: lead.property_city || 'N/A',
            property_state: lead.property_state || 'N/A',
            property_postal_code: lead.property_postal_code || 'N/A',
            contact_name: contactName,
            sender_name: senderInfo.name,
            sender_title: lead.sender_title,
        };

        // 2. Use template from database if available, otherwise fall back to local file
        let emailSubjectTemplate = "Your Property at {{property_address}}";
        let emailBodyHtml: string;

        if (emailTemplate) {
            // Use template from database
            emailSubjectTemplate = emailTemplate.subject;
            emailBodyHtml = renderEmailTemplate(emailTemplate.body_html, emailTemplateData);
        } else {
            // Fall back to local template file
            const emailHtmlTemplatePath = path.resolve(process.cwd(), 'src', 'app', 'api', 'test-email', 'email-template.html');
            const emailHtmlTemplate = await fs.readFile(emailHtmlTemplatePath, 'utf-8');
            
            const subjectMatch = emailHtmlTemplate.match(/<!--\s*SUBJECT:\s*(.+?)\s*-->/);
            if (subjectMatch && subjectMatch[1]) {
                emailSubjectTemplate = subjectMatch[1];
            }
            emailBodyHtml = renderEmailTemplate(emailHtmlTemplate, emailTemplateData);
        }

        const finalEmailSubject = renderEmailTemplate(emailSubjectTemplate, emailTemplateData);

        // 3. Prepare data for LOI PDF
        const currentDate = new Date();
        const formattedDate = currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        const loiTemplateData: TemplateData = {
            ...emailTemplateData,
            current_date: formattedDate,
            offer_price: "Based on Market Analysis",
            emd_amount: "$1,000",
            closing_date: "30 days from acceptance",
            title_company: "Buyer's Choice Title Company",
            property_zip_code: lead.property_postal_code || 'N/A',
        };

        // 2. Generate PDF (if needed)
        const pdfBuffer = await generateLoiPdf(lead, loiTemplateData);
        if (!pdfBuffer) {
            await logEmailAttempt(lead, contactName, senderInfo.name, senderInfo.email, 'PDF Generation Failed', '', 'FAILED_TO_SEND', 'Failed to generate PDF');
            return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
        }
        
        // 5. Construct Multipart MIME message
        const boundary = `----NextPart${Math.random().toString(16).substring(2)}`;
        const loiFilename = `LOI_${(lead.property_address || 'property').replace(/\s+/g, '_')}.pdf`;

        const messageParts = [
            `From: "${senderInfo.name}" <${senderInfo.email}>`,
            `To: ${TEST_RECIPIENT_EMAIL}`,
            `Subject: ${finalEmailSubject}`,
            'MIME-Version: 1.0',
            `Content-Type: multipart/mixed; boundary="${boundary}"`,
            '',
            `--${boundary}`,
            'Content-Type: text/html; charset=utf-8',
            '',
            emailBodyHtml,
            '',
            `--${boundary}`,
            'Content-Type: application/pdf',
            `Content-Disposition: attachment; filename="${loiFilename}"`,
            'Content-Transfer-Encoding: base64',
            '',
            pdfBuffer.toString('base64'),
            '',
            `--${boundary}--`
        ];
        const emailMessage = messageParts.join('\r\n');

        // 6. Send email
        const auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY!),
            scopes: ['https://www.googleapis.com/auth/gmail.send'],
        });
        // Set the sender email for impersonation
        (auth as any).setImpersonatedUser(senderInfo.email); 

        const gmail = google.gmail({ version: 'v1', auth });
        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: Buffer.from(emailMessage).toString('base64url'),
            },
        });

        // 5. Log successful email attempt
        await logEmailAttempt(lead, contactName, senderInfo.name, senderInfo.email, finalEmailSubject, emailBodyHtml, 'SENT');

        return NextResponse.json({ message: 'Test email sent successfully' });

    } catch (error) {
        console.error('Error in test email endpoint:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        console.error('Error details:', {
            message: errorMessage,
            stack: errorStack,
            error: error instanceof Error ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error)
        });
        
        return NextResponse.json(
            { 
                error: 'Internal server error', 
                message: errorMessage,
                ...(process.env.NODE_ENV === 'development' ? { stack: errorStack } : {})
            },
            { status: 500 }
        );
    }
}
