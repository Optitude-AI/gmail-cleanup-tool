import { NextRequest } from 'next/server';
import { createSchedule, getSchedules, toggleSchedule, deleteSchedule, runSchedule } from '@/lib/cleanup-scheduler';
import { scheduleGetSchema, scheduleActionSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const accountId = url.searchParams.get('accountId');
    const { data, error } = validateBody(scheduleGetSchema, { accountId, ...Object.fromEntries(url.searchParams) });
    if (error) {
      return validationErr(error.message);
    }
    const schedules = await getSchedules(data!.accountId);
    return ok({ schedules });
  } catch (error: unknown) {
    console.error('Schedules GET error:', error);
    return err('Operation failed. Please try again.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(scheduleActionSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { action, accountId, ...params } = data;

    if (action === 'create') {
      const { name, frequency, rules } = params as { name?: string; frequency?: string; rules?: string[]; scheduleId?: string; enabled?: boolean };
      const id = await createSchedule(accountId, name, frequency || 'weekly', rules || []);
      return ok({ scheduleId: id });
    }
    if (action === 'toggle') {
      await toggleSchedule((params as { scheduleId?: string; enabled?: boolean }).scheduleId, (params as { scheduleId?: string; enabled?: boolean }).enabled);
      return ok({});
    }
    if (action === 'delete') {
      await deleteSchedule((params as { scheduleId?: string }).scheduleId);
      return ok({});
    }
    if (action === 'run') {
      const result = await runSchedule((params as { scheduleId?: string }).scheduleId);
      return ok(result);
    }
    return validationErr('Unknown action');
  } catch (error: unknown) {
    console.error('Schedule operation error:', error);
    return err('Operation failed. Please try again.');
  }
}
