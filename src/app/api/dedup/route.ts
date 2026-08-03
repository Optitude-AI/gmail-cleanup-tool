import { NextRequest } from 'next/server';
import { findCrossServiceDuplicates } from '@/lib/cross-dedup';
import { validateBody, dedupSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(dedupSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { accountId } = data;
    const duplicates = await findCrossServiceDuplicates(accountId);
    const totalRecoverable = duplicates.reduce((s, g) => s + g.spaceRecoverable, 0);
    return ok({ duplicates, totalRecoverable });
  } catch (error: unknown) {
    console.error('Dedup scan error:', error);
    return err('Operation failed. Please try again.');
  }
}
