import { NextRequest } from 'next/server';
import { deleteDriveFiles } from '@/lib/drive';
import { validateBody, driveDeleteSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(driveDeleteSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { accountId, fileIds, permanent } = data;

    const result = await deleteDriveFiles(accountId, fileIds, permanent);

    return ok({
      ...result,
      message: `${result.success} file${result.success !== 1 ? 's' : ''} moved to trash${permanent ? ' and permanently deleted' : ''}${result.failed > 0 ? `. ${result.failed} failed.` : ''}`,
    });
  } catch (error: unknown) {
    console.error('Drive delete error:', error);
    return err('Operation failed. Please try again.');
  }
}
