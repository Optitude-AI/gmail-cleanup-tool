import { NextRequest, NextResponse } from 'next/server';
import { downloadDriveFile } from '@/lib/drive';
import { validateBody, driveDownloadSchema } from '@/lib/validations';
import { err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(driveDownloadSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { accountId, fileId } = data;

    const { buffer, fileName, mimeType } = await downloadDriveFile(accountId, fileId);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('Download error:', error);
    return err('Operation failed. Please try again.');
  }
}
