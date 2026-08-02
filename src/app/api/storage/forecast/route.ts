import { NextRequest } from 'next/server';
import { getStorageForecast } from '@/lib/storage-forecast';
import { validateBody, storageForecastSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(storageForecastSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { accountId } = data;
    const forecast = await getStorageForecast(accountId);
    return ok({ forecast });
  } catch (error: unknown) {
    console.error('Forecast error:', error);
    return err('Operation failed. Please try again.');
  }
}
