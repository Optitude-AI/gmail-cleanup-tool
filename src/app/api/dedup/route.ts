import { NextRequest, NextResponse } from 'next/server';
import { findCrossServiceDuplicates } from '@/lib/cross-dedup';

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await request.json();
    if (!accountId) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    const duplicates = await findCrossServiceDuplicates(accountId);
    const totalRecoverable = duplicates.reduce((s, g) => s + g.spaceRecoverable, 0);
    return NextResponse.json({ success: true, duplicates, totalRecoverable });
  } catch (error: any) {
    return NextResponse.json({ error: 'Dedup scan failed', details: error.message }, { status: 500 });
  }
}
