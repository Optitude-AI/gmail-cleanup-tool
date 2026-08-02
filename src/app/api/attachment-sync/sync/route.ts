import { NextRequest, NextResponse } from 'next/server';
import { syncAttachmentsToDrive } from '@/lib/attachment-sync';

export async function POST(request: NextRequest) {
  try {
    const { accountId, attachments, folderName } = await request.json();
    if (!accountId || !attachments?.length) return NextResponse.json({ error: 'Account ID and attachments required' }, { status: 400 });
    const result = await syncAttachmentsToDrive(accountId, attachments, folderName);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: 'Sync failed', details: error.message }, { status: 500 });
  }
}
