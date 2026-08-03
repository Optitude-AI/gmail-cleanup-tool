import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-auth';
import { err } from '@/lib/api-response';

export async function GET() {
  try {
    // Validate that OAuth credentials are configured
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      return err(
        'Google OAuth credentials are not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in your .env file. See https://console.cloud.google.com/apis/credentials for setup instructions.',
        503
      );
    }

    const url = getAuthUrl();
    return NextResponse.json({ authUrl: url });
  } catch (error: unknown) {
    console.error('Auth URL error:', error);
    return err('Failed to generate Google authorization URL. Check your OAuth credentials.');
  }
}
