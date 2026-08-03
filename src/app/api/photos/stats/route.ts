import { NextRequest } from 'next/server';
import { scanPhotos } from '@/lib/photos';
import { validateBody, photosStatsSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(photosStatsSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { accountId } = data;

    const { stats } = await scanPhotos(accountId);
    return ok({ stats });
  } catch (error: unknown) {
    console.error('Photos stats error:', error);
    return err('Operation failed. Please try again.');
  }
}
