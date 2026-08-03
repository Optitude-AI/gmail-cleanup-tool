import { NextRequest } from 'next/server';
import { getUnifiedStorage } from '@/lib/storage-unified';
import { validateBody, storageUnifiedSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(storageUnifiedSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { accountId } = data;
    const storage = await getUnifiedStorage(accountId);
    return ok({ storage });
  } catch (error: unknown) {
    console.error('Storage query error:', error);
    return err('Operation failed. Please try again.');
  }
}
