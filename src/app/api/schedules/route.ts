import { NextRequest, NextResponse } from 'next/server';
import { createSchedule, getSchedules, toggleSchedule, deleteSchedule, runSchedule } from '@/lib/cleanup-scheduler';

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get('accountId');
    if (!accountId) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    const schedules = await getSchedules(accountId);
    return NextResponse.json({ success: true, schedules });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to get schedules', details: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, accountId, ...params } = await request.json();
    if (!accountId) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });

    if (action === 'create') {
      const { name, frequency, rules } = params;
      const id = await createSchedule(accountId, name, frequency || 'weekly', rules || []);
      return NextResponse.json({ success: true, scheduleId: id });
    }
    if (action === 'toggle') {
      await toggleSchedule(params.scheduleId, params.enabled);
      return NextResponse.json({ success: true });
    }
    if (action === 'delete') {
      await deleteSchedule(params.scheduleId);
      return NextResponse.json({ success: true });
    }
    if (action === 'run') {
      const result = await runSchedule(params.scheduleId);
      return NextResponse.json({ success: true, ...result });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Schedule operation failed', details: error.message }, { status: 500 });
  }
}
