import { NextRequest } from 'next/server';
import { exchangeCodeAndUserInfo } from '@/lib/google-auth';
import { db } from '@/lib/db';
import { validateBody, gmailCallbackSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
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
    return err('Operation failed. Please try again.');
  }
}
