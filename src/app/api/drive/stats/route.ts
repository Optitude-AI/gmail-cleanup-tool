import { NextRequest } from 'next/server';
import { scanDriveFiles } from '@/lib/drive';
import { validateBody, driveStatsSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(driveStatsSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { accountId } = data;

    const { stats } = await scanDriveFiles(accountId);
    return ok({ stats });
  } catch (error: unknown) {
    console.error('Drive stats error:', error);
    return err('Operation failed. Please try again.');
  }
}
