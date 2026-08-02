import { NextRequest, NextResponse } from 'next/server';
import { downloadPhoto } from '@/lib/photos';
import { validateBody, photosDownloadSchema } from '@/lib/validations';
import { err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(photosDownloadSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { accountId, photoId, baseUrl } = data;

    const { buffer, fileName, mimeType } = await downloadPhoto(accountId, photoId, baseUrl);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('Photo download error:', error);
    return err('Operation failed. Please try again.');
  }
}
