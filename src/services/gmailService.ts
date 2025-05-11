export { sendEmail };

import { google } from 'googleapis';

// Initialize JWT auth with service account key
const serviceKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!);
const authClient = new google.auth.JWT({
  email: serviceKey.client_email,
  key: serviceKey.private_key,
  scopes: ['https://www.googleapis.com/auth/gmail.send'],
});

const gmail = google.gmail({ version: 'v1', auth: authClient });

async function sendEmail(
  impersonatedUserEmail: string,
  recipientEmail: string,
  subject: string,
  htmlBody: string,
  attachments?: { filename: string; content: Buffer }[]
): Promise<{ success: boolean; messageId?: string; error?: unknown }> {
  try {
    authClient.subject = impersonatedUserEmail;

    const boundary = 'boundary_' + Date.now();
    let message = [] as string[];
    message.push(`From: ${impersonatedUserEmail}`);
    message.push(`To: ${recipientEmail}`);
    message.push(`Subject: ${subject}`);
    message.push('MIME-Version: 1.0');
    message.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    message.push('');
    message.push(`--${boundary}`);
    message.push('Content-Type: text/html; charset="UTF-8"');
    message.push('Content-Transfer-Encoding: 7bit');
    message.push('');
    message.push(htmlBody);

    if (attachments && attachments.length) {
      for (const file of attachments) {
        message.push(`--${boundary}`);
        message.push(`Content-Type: application/octet-stream; name="${file.filename}"`);
        message.push('Content-Transfer-Encoding: base64');
        message.push(`Content-Disposition: attachment; filename="${file.filename}"`);
        message.push('');
        message.push(file.content.toString('base64'));
      }
    }
    message.push(`--${boundary}--`);

    const rawMessage = Buffer.from(message.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const res = await gmail.users.messages.send({
      userId: impersonatedUserEmail,
      requestBody: { raw: rawMessage },
    });

    return { success: true, messageId: res.data.id! };
  } catch (error) {
    console.error('sendEmail error:', error);
    return { success: false, error };
  }
}