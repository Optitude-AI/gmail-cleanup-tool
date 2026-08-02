import { NextRequest, NextResponse } from 'next/server';
import { findLargeAttachments } from '@/lib/attachment-sync';

export async function POST(request: NextRequest) {
  try {
    const { accountId, minSizeKB } = await request.json();
    if (!accountId) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    const attachments = await findLargeAttachments(accountId, minSizeKB || 500);
    return NextResponse.json({ success: true, attachments, count: attachments.length });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to find attachments', details: error.message }, { status: 500 });
  }
}
