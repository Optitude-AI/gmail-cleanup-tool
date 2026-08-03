import { db } from '@/lib/db';
import { formatBytes } from '@/lib/utils';

interface ReportData {
  emailsDeleted: number;
  emailsSizeEstimate: number;
  driveFilesDeleted: number;
  driveSpaceFreed: number;
  photosDeleted: number;
  photoSpaceFreed: number;
  actions: { action: string; service: string; count: number; spaceFreed: number }[];
}

export async function generateReport(
  accountId: string,
  data: ReportData,
  reportType: 'auto' | 'manual' = 'manual'
) {
  const totalSpaceFreed =
    data.emailsSizeEstimate + data.driveSpaceFreed + data.photoSpaceFreed;

  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const title = `Cleanup Report — ${dateStr}`;

  const parts: string[] = [];
  if (data.emailsDeleted > 0) {
    parts.push(
      `${data.emailsDeleted.toLocaleString()} emails`
    );
  }
  if (data.driveFilesDeleted > 0) {
    parts.push(
      `${data.driveFilesDeleted.toLocaleString()} Drive files`
    );
  }
  if (data.photosDeleted > 0) {
    parts.push(`${data.photosDeleted.toLocaleString()} photos`);
  }

  const itemsList =
    parts.length > 0
      ? parts.join(', ')
      : 'no items';

  const summary = `Freed ${formatBytes(totalSpaceFreed)} by removing ${itemsList}`;

  const stats = JSON.stringify({
    emailsDeleted: data.emailsDeleted,
    emailsSizeEstimate: data.emailsSizeEstimate,
    emailsSizeEstimateFormatted: formatBytes(data.emailsSizeEstimate),
    driveFilesDeleted: data.driveFilesDeleted,
    driveSpaceFreed: data.driveSpaceFreed,
    driveSpaceFreedFormatted: formatBytes(data.driveSpaceFreed),
    photosDeleted: data.photosDeleted,
    photoSpaceFreed: data.photoSpaceFreed,
    photoSpaceFreedFormatted: formatBytes(data.photoSpaceFreed),
    totalSpaceFreed,
    totalSpaceFreedFormatted: formatBytes(totalSpaceFreed),
    actions: data.actions,
    generatedAt: new Date().toISOString(),
  });

  const report = await db.cleanupReport.create({
    data: {
      accountId,
      reportType,
      title,
      summary,
      stats,
    },
  });

  return report;
}

export async function getReports(accountId: string) {
  const reports = await db.cleanupReport.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return reports.map((report) => ({
    ...report,
    stats: JSON.parse(report.stats),
  }));
}

export async function getStorageHistory(
  accountId: string
): Promise<{ date: string; usedStorage: number }[]> {
  const reports = await db.cleanupReport.findMany({
    where: { accountId },
    orderBy: { createdAt: 'asc' },
  });

  let cumulativeSaved = 0;
  const history: { date: string; usedStorage: number }[] = [];

  for (const report of reports) {
    const parsed = JSON.parse(report.stats);
    const saved = parsed.totalSpaceFreed || 0;
    cumulativeSaved += saved;

    const date = report.createdAt.toISOString().split('T')[0];

    // Deduplicate by date — keep the last entry per day
    const existing = history.find((h) => h.date === date);
    if (existing) {
      existing.usedStorage = cumulativeSaved;
    } else {
      history.push({
        date,
        usedStorage: cumulativeSaved,
      });
    }
  }

  return history;
}
