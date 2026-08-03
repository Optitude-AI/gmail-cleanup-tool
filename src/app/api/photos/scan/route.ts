import { NextRequest } from 'next/server';
import { scanPhotos } from '@/lib/photos';
import { validateBody, photosScanSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(photosScanSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { accountId } = data;

    const { photos, stats } = await scanPhotos(accountId);
    return ok({ stats, photos });
  } catch (error: unknown) {
    console.error('Photos scan error:', error);
    return err('Operation failed. Please try again.');
  }
}
