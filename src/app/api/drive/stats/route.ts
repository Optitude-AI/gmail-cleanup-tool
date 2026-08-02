import { NextRequest, NextResponse } from 'next/server';
import { scanDriveFiles } from '@/lib/drive';

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await request.json();
    if (!accountId) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });

    const { stats } = await scanDriveFiles(accountId);
    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    return NextResponse.json({ error: 'Drive stats failed', details: error.message }, { status: 500 });
  }
}
