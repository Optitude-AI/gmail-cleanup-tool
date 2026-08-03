import { NextRequest } from 'next/server';
import { scanDriveFiles } from '@/lib/drive';
import { validateBody, driveScanSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(driveScanSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { accountId } = data;

    const { files, stats } = await scanDriveFiles(accountId);
    return ok({ stats, files });
  } catch (error: unknown) {
    console.error('Drive scan error:', error);
    return err('Operation failed. Please try again.');
  }
}
