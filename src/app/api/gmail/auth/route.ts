import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-auth';
import { err } from '@/lib/api-response';

export async function GET() {
  try {
    const url = getAuthUrl();
    return NextResponse.json({ authUrl: url });
  } catch (error: unknown) {
    console.error('Auth URL error:', error);
    return err('Operation failed. Please try again.');
  }
}
