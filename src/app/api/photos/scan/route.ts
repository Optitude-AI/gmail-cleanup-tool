import { NextRequest, NextResponse } from 'next/server';
import { scanPhotos } from '@/lib/photos';

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await request.json();
    if (!accountId) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });

    const { photos, stats } = await scanPhotos(accountId);
    return NextResponse.json({ success: true, stats, photos });
  } catch (error: any) {
    return NextResponse.json({ error: 'Photos scan failed', details: error.message }, { status: 500 });
  }
}
