import { NextRequest, NextResponse } from 'next/server';
import { scanDriveFiles } from '@/lib/drive';

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await request.json();
    if (!accountId) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });

    const { files, stats } = await scanDriveFiles(accountId);

    return NextResponse.json({ success: true, stats, files });
  } catch (error: any) {
    return NextResponse.json({ error: 'Drive scan failed', details: error.message }, { status: 500 });
  }
}
