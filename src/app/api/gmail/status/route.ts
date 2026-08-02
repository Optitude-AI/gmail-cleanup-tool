import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to get accounts', details: error.message },
      { status: 500 }
    );
  }
}
