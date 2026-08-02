import { NextRequest, NextResponse } from 'next/server';
import { createBackupArchive } from '@/lib/backup';

export async function POST(request: NextRequest) {
  try {
    const { accountId, items } = await request.json();
    if (!accountId || !items?.length) return NextResponse.json({ error: 'Account ID and items required' }, { status: 400 });
    const buffer = await createBackupArchive(accountId, items);
    return new NextResponse(buffer, {
      headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="backup.zip"', 'Content-Length': buffer.length.toString() },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Backup failed', details: error.message }, { status: 500 });
  }
}
