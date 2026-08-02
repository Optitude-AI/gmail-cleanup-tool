import { NextRequest, NextResponse } from 'next/server';
import { deleteDriveFiles } from '@/lib/drive';

export async function POST(request: NextRequest) {
  try {
    const { accountId, fileIds, permanent } = await request.json();
    if (!accountId || !fileIds || fileIds.length === 0) {
      return NextResponse.json({ error: 'Account ID and file IDs required' }, { status: 400 });
    }

    const result = await deleteDriveFiles(accountId, fileIds, permanent ?? false);

    return NextResponse.json({
      success: true,
      ...result,
      message: `${result.success} file${result.success !== 1 ? 's' : ''} moved to trash${permanent ? ' and permanently deleted' : ''}${result.failed > 0 ? `. ${result.failed} failed.` : ''}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Delete failed', details: error.message }, { status: 500 });
  }
}
