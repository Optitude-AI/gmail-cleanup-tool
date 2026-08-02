import { NextRequest, NextResponse } from 'next/server';
import { generateReport, getReports } from '@/lib/cleanup-reports';

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get('accountId');
    if (!accountId) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    const reports = await getReports(accountId);
    return NextResponse.json({ success: true, reports });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to get reports', details: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { accountId, data } = await request.json();
    if (!accountId) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    const report = await generateReport(accountId, data);
    return NextResponse.json({ success: true, report });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to generate report', details: error.message }, { status: 500 });
  }
}
