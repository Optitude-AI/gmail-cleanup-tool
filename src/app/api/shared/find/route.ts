import { NextRequest } from 'next/server';
import { findStaleSharedFiles } from '@/lib/shared-with-me';
import { validateBody, sharedFindSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(sharedFindSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { accountId, daysThreshold } = data;
    const files = await findStaleSharedFiles(accountId, daysThreshold);
    const totalSize = files.reduce((s, f) => s + f.size, 0);
    return ok({ files, count: files.length, totalSize });
  } catch (error: unknown) {
    console.error('Shared find error:', error);
    return err('Operation failed. Please try again.');
  }
}
