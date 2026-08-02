import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-auth';

export async function GET() {
  try {
    const url = getAuthUrl();
    return NextResponse.json({ authUrl: url });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to generate auth URL', details: error.message },
      { status: 500 }
    );
  }
}
