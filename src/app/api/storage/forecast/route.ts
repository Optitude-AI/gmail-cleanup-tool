import { NextRequest, NextResponse } from 'next/server';
import { getStorageForecast } from '@/lib/storage-forecast';

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await request.json();
    if (!accountId) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    const forecast = await getStorageForecast(accountId);
    return NextResponse.json({ success: true, forecast });
  } catch (error: any) {
    return NextResponse.json({ error: 'Forecast failed', details: error.message }, { status: 500 });
  }
}
