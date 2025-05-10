import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Fetch authenticated user's profile via Google People API
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    console.warn('Missing Google credentials, returning empty profile');
    return NextResponse.json({ name: null, picture: null });
  }

  try {
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    const people = google.people({ version: 'v1', auth: oAuth2Client });
    const response = await people.people.get({
      resourceName: 'people/me',
      personFields: 'names,photos',
    });

    const names = response.data.names || [];
    const photos = response.data.photos || [];
    const name = names[0]?.displayName || null;
    const picture = photos[0]?.url || null;

    return NextResponse.json({ name, picture });
  } catch (err: any) {
    console.error('Gmail profile API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}