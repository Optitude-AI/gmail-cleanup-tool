import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ok, err } from '@/lib/api-response';

export async function GET() {
  try {
    const accounts = await db.gmailAccount.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ accounts });
  } catch (error: unknown) {
    console.error('Status error:', error);
    return err('Operation failed. Please try again.');
  }
}
