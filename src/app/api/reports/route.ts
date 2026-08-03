import { NextRequest } from 'next/server';
import { generateReport, getReports } from '@/lib/cleanup-reports';
import { reportGetSchema, reportCreateSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const accountId = url.searchParams.get('accountId');
    const { data, error } = validateBody(reportGetSchema, { accountId });
    if (error) {
      return validationErr(error.message);
    }
    const reports = await getReports(data!.accountId);
    return ok({ reports });
  } catch (error: unknown) {
    console.error('Reports GET error:', error);
    return err('Operation failed. Please try again.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(reportCreateSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { accountId, data: reportData } = data;
    const report = await generateReport(accountId, reportData);
    return ok({ report });
  } catch (error: unknown) {
    console.error('Reports POST error:', error);
    return err('Operation failed. Please try again.');
  }
}
