import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deleteEmails, refreshAccessToken } from '@/lib/gmail';

export async function POST(request: NextRequest) {
  try {
    const { accountId, scanResultIds, allInCategory, category } = await request.json();

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const account = await db.gmailAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    let accessToken = account.accessToken;
    let refreshToken = account.refreshToken;

    if (account.tokenExpiry && new Date(account.tokenExpiry) < new Date()) {
      if (refreshToken) {
        const credentials = await refreshAccessToken(refreshToken);
        accessToken = credentials.access_token || accessToken;
        if (credentials.refresh_token) refreshToken = credentials.refresh_token;
        if (credentials.expiry_date) {
          await db.gmailAccount.update({
            where: { id: accountId },
            data: {
              accessToken,
              refreshToken,
              tokenExpiry: new Date(credentials.expiry_date),
            },
          });
        }
      } else {
        return NextResponse.json({ error: 'Token expired. Please reconnect.' }, { status: 401 });
      }
    }

    // Determine which scan results to delete
    let results = [];
    if (allInCategory && category) {
      results = await db.scanResult.findMany({
        where: { accountId, category },
      });
    } else if (scanResultIds && scanResultIds.length > 0) {
      results = await db.scanResult.findMany({
        where: { id: { in: scanResultIds } },
      });
    }

    // Collect all message IDs
    const allMessageIds: string[] = [];
    for (const result of results) {
      const ids = JSON.parse(result.messageIds);
      allMessageIds.push(...ids);
    }

    if (allMessageIds.length === 0) {
      return NextResponse.json({ success: true, deleted: 0, message: 'No emails to delete' });
    }

    // Delete in batches
    const BATCH_SIZE = 50;
    let totalDeleted = 0;
    let totalFailed = 0;

    for (let i = 0; i < allMessageIds.length; i += BATCH_SIZE) {
      const batch = allMessageIds.slice(i, i + BATCH_SIZE);
      const result = await deleteEmails(accessToken, refreshToken, batch);
      totalDeleted += result.success.length;
      totalFailed += result.failed.length;
    }

    // Log cleanup actions
    for (const sr of results) {
      await db.cleanupAction.create({
        data: {
          scanResultId: sr.id,
          action: 'deleted',
          messageIds: sr.messageIds,
        },
      });
    }

    // Remove scanned results that were deleted
    const deletedIds = results.map(r => r.id);
    await db.scanResult.deleteMany({
      where: { id: { in: deletedIds } },
    });

    return NextResponse.json({
      success: true,
      deleted: totalDeleted,
      failed: totalFailed,
      message: `Deleted ${totalDeleted} email${totalDeleted !== 1 ? 's' : ''}${totalFailed > 0 ? `. ${totalFailed} failed.` : ''}`,
    });
  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete emails', details: error.message },
      { status: 500 }
    );
  }
}
