import { NextRequest, NextResponse } from 'next/server';
import { createBackupArchive } from '@/lib/backup';
import { validateBody, backupCreateSchema } from '@/lib/validations';
import { err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(backupCreateSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { accountId, items } = data;
    const buffer = await createBackupArchive(accountId, items);
    return new NextResponse(buffer, {
      headers: { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="backup.zip"', 'Content-Length': buffer.length.toString() },
    });
  } catch (error: unknown) {
    console.error('Backup error:', error);
    return err('Operation failed. Please try again.');
  }
}
