import { NextRequest, NextResponse } from 'next/server';
import { findStaleSharedFiles } from '@/lib/shared-with-me';

export async function POST(request: NextRequest) {
  try {
    const { accountId, daysThreshold } = await request.json();
    if (!accountId) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    const files = await findStaleSharedFiles(accountId, daysThreshold || 90);
    const totalSize = files.reduce((s, f) => s + f.size, 0);
    return NextResponse.json({ success: true, files, count: files.length, totalSize });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to find shared files', details: error.message }, { status: 500 });
  }
}
