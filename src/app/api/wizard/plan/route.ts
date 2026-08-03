import { NextRequest } from 'next/server';
import { generateCleanupPlan } from '@/lib/smart-wizard';
import { scanDriveFiles } from '@/lib/drive';
import { validateBody, wizardPlanSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(wizardPlanSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { accountId, targetGB } = data;
    const targetBytes = targetGB * 1024 * 1024 * 1024;
    const { files, stats } = await scanDriveFiles(accountId);
    const plan = generateCleanupPlan(targetBytes, files, [], [], stats);
    return ok({ plan });
  } catch (error: unknown) {
    console.error('Wizard error:', error);
    return err('Operation failed. Please try again.');
  }
}
