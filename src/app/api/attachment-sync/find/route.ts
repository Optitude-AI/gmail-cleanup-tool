import { NextRequest } from 'next/server';
import { findLargeAttachments } from '@/lib/attachment-sync';
import { validateBody, attachmentFindSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(attachmentFindSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { accountId, minSizeKB } = data;
    const attachments = await findLargeAttachments(accountId, minSizeKB);
    return ok({ attachments, count: attachments.length });
  } catch (error: unknown) {
    console.error('Attachment find error:', error);
    return err('Operation failed. Please try again.');
  }
}
