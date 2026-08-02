import { NextRequest, NextResponse } from 'next/server';
import { getTokens } from '@/lib/gmail';
import { db } from '@/lib/db';
import { google } from 'googleapis';

export async function POST(request: NextRequest) {
  try {
    const { code, userId } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is required' }, { status: 400 });
    }

    const tokens = await getTokens(code);

    // Get user info from Google
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    const email = userInfo.data.email || '';
    const name = userInfo.data.name || '';

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

    return NextResponse.json({
      success: true,
      email: account.email,
      name,
      accountId: account.id,
    });
  } catch (error: any) {
    console.error('Gmail callback error:', error);
    return NextResponse.json(
      { error: 'Failed to exchange code for tokens', details: error.message },
      { status: 500 }
    );
  }
}
