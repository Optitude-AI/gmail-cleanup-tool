import { NextRequest, NextResponse } from 'next/server';
import { getUnifiedStorage } from '@/lib/storage-unified';

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await request.json();
    if (!accountId) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    const storage = await getUnifiedStorage(accountId);
    return NextResponse.json({ success: true, storage });
  } catch (error: any) {
    return NextResponse.json({ error: 'Storage query failed', details: error.message }, { status: 500 });
  }
}
