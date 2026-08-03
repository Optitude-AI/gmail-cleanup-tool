import { NextRequest } from 'next/server';
import { exchangeCodeAndUserInfo } from '@/lib/google-auth';
import { db } from '@/lib/db';
import { validateBody, gmailCallbackSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    // Validate OAuth credentials are configured
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      return err(
        'Google OAuth credentials are not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in your .env file.',
        503
      );
    }

    const body = await request.json();
    const { data, error } = validateBody(gmailCallbackSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { code, userId } = data;

    const { tokens, email, name } = await exchangeCodeAndUserInfo(code);

    // Store or update account
    const account = await db.gmailAccount.upsert({
      where: { userId: userId || email },
      update: {
        email,
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
      create: {
        userId: userId || email,
        email,
        name,
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });

    return ok({ email: account.email, name, accountId: account.id });
  } catch (error: unknown) {
    console.error('Gmail callback error:', error);
    const message = error instanceof Error ? error.message : '';
    if (message.includes('invalid_grant') || message.includes('bad_verification_code')) {
      return err('The authorization code is invalid or has expired. Please try connecting again.', 400);
    }
    if (message.includes('redirect_uri_mismatch')) {
      return err('Redirect URI mismatch. Ensure GOOGLE_REDIRECT_URI in .env matches the one configured in Google Cloud Console.', 400);
    }
    return err('Failed to authenticate with Google. Please try again.');
  }
}
