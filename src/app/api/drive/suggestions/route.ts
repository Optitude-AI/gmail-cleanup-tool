import { NextRequest, NextResponse } from 'next/server';
import { scanDriveFiles, generateSuggestions } from '@/lib/drive';

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await request.json();
    if (!accountId) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });

    const { files, stats } = await scanDriveFiles(accountId);
    const suggestions = generateSuggestions(files, stats);

    const totalPotentialSavings = suggestions.reduce((s, sug) => s + sug.potentialSavings, 0);

    return NextResponse.json({
      success: true,
      suggestions,
      totalPotentialSavings,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Suggestions failed', details: error.message }, { status: 500 });
  }
}
