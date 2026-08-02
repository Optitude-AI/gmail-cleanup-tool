import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeAndUserInfo } from '@/lib/google-auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { code, userId } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is required' }, { status: 400 });
    }

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
