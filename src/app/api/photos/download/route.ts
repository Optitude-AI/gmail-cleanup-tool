import { NextRequest, NextResponse } from 'next/server';
import { downloadPhoto } from '@/lib/photos';

export async function POST(request: NextRequest) {
  try {
    const { accountId, photoId, baseUrl } = await request.json();
    if (!accountId || !photoId) {
      return NextResponse.json({ error: 'Account ID and Photo ID required' }, { status: 400 });
    }

    const { buffer, fileName, mimeType } = await downloadPhoto(accountId, photoId, baseUrl);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Photo download failed', details: error.message }, { status: 500 });
  }
}
