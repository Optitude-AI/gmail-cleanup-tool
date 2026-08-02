import { NextRequest, NextResponse } from 'next/server';
import { generateCleanupPlan } from '@/lib/smart-wizard';
import { scanDriveFiles } from '@/lib/drive';

export async function POST(request: NextRequest) {
  try {
    const { accountId, targetGB } = await request.json();
    if (!accountId) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    const targetBytes = (targetGB || 1) * 1024 * 1024 * 1024;
    const { files, stats } = await scanDriveFiles(accountId);
    const plan = generateCleanupPlan(targetBytes, files, [], [], stats);
    return NextResponse.json({ success: true, plan });
  } catch (error: any) {
    return NextResponse.json({ error: 'Wizard failed', details: error.message }, { status: 500 });
  }
}
