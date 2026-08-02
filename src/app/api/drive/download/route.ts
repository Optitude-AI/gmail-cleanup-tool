import { NextRequest, NextResponse } from 'next/server';
import { downloadDriveFile } from '@/lib/drive';

export async function POST(request: NextRequest) {
  try {
    const { accountId, fileId } = await request.json();
    if (!accountId || !fileId) {
      return NextResponse.json({ error: 'Account ID and File ID required' }, { status: 400 });
    }

    const { buffer, fileName, mimeType } = await downloadDriveFile(accountId, fileId);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Download failed', details: error.message }, { status: 500 });
  }
}
