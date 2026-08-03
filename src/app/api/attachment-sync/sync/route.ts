import { NextRequest } from 'next/server';
import { syncAttachmentsToDrive } from '@/lib/attachment-sync';
import { validateBody, attachmentSyncSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(attachmentSyncSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { accountId, attachments, folderName } = data;
    const result = await syncAttachmentsToDrive(accountId, attachments, folderName);
    return ok(result);
  } catch (error: unknown) {
    console.error('Sync error:', error);
    return err('Operation failed. Please try again.');
  }
}