import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { deleteEmails } from '@/lib/gmail';
import { getValidTokens } from '@/lib/google-auth';
import { validateBody, gmailDeleteSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(gmailDeleteSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const { accountId, scanResultIds, allInCategory, category } = data;

    const { accessToken, refreshToken } = await getValidTokens(accountId);

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
      return ok({ deleted: 0, message: 'No emails to delete' });
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

    return ok({
      deleted: totalDeleted,
      failed: totalFailed,
      message: `Deleted ${totalDeleted} email${totalDeleted !== 1 ? 's' : ''}${totalFailed > 0 ? `. ${totalFailed} failed.` : ''}`,
    });
  } catch (error: unknown) {
    console.error('Delete error:', error);
    return err('Operation failed. Please try again.');
  }
}
