import { db } from '@/lib/db';
import { getUnifiedStorage, type UnifiedStorage } from '@/lib/storage-unified';
import { formatBytes } from '@/lib/utils';

export interface StorageForecast {
  currentUsage: number;
  dailyGrowthRate: number;       // bytes per day
  projectedFullDate: string;     // ISO date when storage will be full
  daysRemaining: number;
  weeklyGrowthFormatted: string;
  severity: 'safe' | 'warning' | 'critical';
  recommendation: string;
}

/**
 * Extract storage usage from a CleanupReport's JSON stats field.
 * Reports may store a `totalUsedBytes` or similar key.
 */
function extractUsageFromReport(statsJson: string): number | null {
  try {
    const stats = JSON.parse(statsJson);
    // Support multiple possible key names
    return (
      stats.totalUsedBytes ??
      stats.usedBytes ??
      stats.used ??
      stats.storageUsed ??
      null
    );
  } catch {
    return null;
  }
}

/**
 * Calculate the daily growth rate from historical cleanup reports.
 * Uses a simple linear regression on the available data points.
 * Returns bytes per day.
 */
function calculateGrowthRate(reports: { createdAt: Date; usage: number }[]): number {
  if (reports.length < 2) return 0;

  // Sort by date ascending
  const sorted = [...reports].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  // Linear regression: y = mx + b
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  const n = sorted.length;

  for (let i = 0; i < n; i++) {
    const x = i; // day index
    const y = sorted[i].usage;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  const slope = (n * sumXY - sumX * sumY) / denominator; // bytes per index

  // Convert slope from per-index to per-day using actual time span
  const firstDate = sorted[0].createdAt.getTime();
  const lastDate = sorted[sorted.length - 1].createdAt.getTime();
  const daySpan = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));

  // slope is the change per index step; total change = slope * (n - 1)
  // daily rate = total change / daySpan
  const totalChange = slope * (n - 1);
  return totalChange / daySpan;
}

/**
 * Determine severity based on percentage used and days remaining.
 */
function getSeverity(
  percentUsed: number,
  daysRemaining: number
): 'safe' | 'warning' | 'critical' {
  if (percentUsed >= 95 || daysRemaining <= 7) return 'critical';
  if (percentUsed >= 80 || daysRemaining <= 30) return 'warning';
  return 'safe';
}

/**
 * Generate a human-readable recommendation based on the forecast.
 */
function getRecommendation(
  severity: 'safe' | 'warning' | 'critical',
  storage: UnifiedStorage,
  daysRemaining: number
): string {
  switch (severity) {
    case 'critical':
      if (storage.drive.trashSize > 0) {
        return `Your storage is critically low (${Math.round(storage.percentUsed)}% used). Empty your Drive trash to free ${formatBytes(storage.drive.trashSize)} immediately, then review large files and old emails with attachments.`;
      }
      return `Your storage is critically low (${Math.round(storage.percentUsed)}% used, ~${daysRemaining} days left). Immediately clean up large Drive files, old emails with attachments, and consider upgrading to Google One.`;
    case 'warning':
      return `Storage usage is at ${Math.round(storage.percentUsed)}%. You have approximately ${daysRemaining} days before running out. Review your largest files in Drive, clear email attachments, and remove duplicate photos to extend this timeline.`;
    case 'safe':
      return 'Your storage usage is healthy. Keep monitoring and run periodic cleanups to maintain optimal space. Consider setting up automated cleanup schedules.';
  }
}

/**
 * Get a storage forecast for the given account.
 * Uses historical CleanupReport data to calculate growth trends
 * and predict when the account will hit its storage limit.
 */
export async function getStorageForecast(accountId: string): Promise<StorageForecast> {
  // Fetch current unified storage
  const storage = await getUnifiedStorage(accountId);

  // Fetch historical cleanup reports for this account, sorted by date
  const reports = await db.cleanupReport.findMany({
    where: { accountId },
    orderBy: { createdAt: 'asc' },
  });

  // Extract historical usage data points from reports
  const historicalData: { createdAt: Date; usage: number }[] = [];

  for (const report of reports) {
    const usage = extractUsageFromReport(report.stats);
    if (usage !== null && usage > 0) {
      historicalData.push({
        createdAt: report.createdAt,
        usage,
      });
    }
  }

  // Calculate daily growth rate
  const dailyGrowthRate = calculateGrowthRate(historicalData);

  // If we have historical data, also factor in the current reading
  // by adding the most recent unified storage as the latest data point
  let effectiveDailyGrowth = dailyGrowthRate;

  if (historicalData.length > 0) {
    // Use the last historical point + current reading for a supplementary rate
    const lastHistorical = historicalData[historicalData.length - 1];
    const dayDiff = Math.max(
      1,
      (Date.now() - lastHistorical.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const recentRate = (storage.used - lastHistorical.usage) / dayDiff;

    // Weight the recent rate more heavily (70%) vs the long-term trend (30%)
    effectiveDailyGrowth = effectiveDailyGrowth * 0.3 + recentRate * 0.7;
  }

  // Clamp to non-negative (storage can't grow negatively in forecast)
  effectiveDailyGrowth = Math.max(0, effectiveDailyGrowth);

  // Calculate days until storage is full
  const freeSpace = storage.free;
  let daysRemaining: number;
  let projectedFullDate: string;

  if (effectiveDailyGrowth <= 0 || freeSpace <= 0) {
    // Already full or not growing
    daysRemaining = freeSpace <= 0 ? 0 : Infinity;
    projectedFullDate = freeSpace <= 0
      ? new Date().toISOString()
      : '9999-12-31T00:00:00.000Z';
  } else {
    daysRemaining = Math.ceil(freeSpace / effectiveDailyGrowth);
    const projectedDate = new Date();
    projectedDate.setDate(projectedDate.getDate() + daysRemaining);
    projectedFullDate = projectedDate.toISOString();
  }

  // Weekly growth
  const weeklyGrowth = effectiveDailyGrowth * 7;
  const weeklyGrowthFormatted = formatBytes(weeklyGrowth);

  // Determine severity
  const percentUsed = storage.percentUsed;
  const severity = getSeverity(percentUsed, daysRemaining === Infinity ? 9999 : daysRemaining);

  // Recommendation
  const recommendation = getRecommendation(
    severity,
    storage,
    daysRemaining === Infinity ? 9999 : daysRemaining
  );

  return {
    currentUsage: storage.used,
    dailyGrowthRate: Math.round(effectiveDailyGrowth),
    projectedFullDate,
    daysRemaining: daysRemaining === Infinity ? -1 : daysRemaining,
    weeklyGrowthFormatted,
    severity,
    recommendation,
  };
}
