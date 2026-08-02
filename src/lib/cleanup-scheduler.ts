import { db } from '@/lib/db';
import { formatBytes } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScheduleRule {
  type:
    | 'empty_trash'
    | 'delete_promos_older_than'
    | 'delete_junk_older_than'
    | 'delete_screenshots_older_than'
    | 'delete_large_old_files';
  param?: number; // days threshold — applies to all *_older_than rules
}

interface RunResult {
  executed: boolean;
  cleaned: number;
  saved: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeNextRun(frequency: string, from: Date = new Date()): Date {
  const next = new Date(from);
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Rule processors (placeholder — log what WOULD be done)
// ---------------------------------------------------------------------------

/**
 * Process a single rule and return the count of items that would be cleaned
 * and the approximate bytes that would be saved.
 */
async function processRule(
  accountId: string,
  rule: ScheduleRule,
): Promise<{ cleaned: number; saved: number }> {
  const daysThreshold = rule.param ?? 30;
  const cutoff = new Date(
    Date.now() - daysThreshold * 24 * 60 * 60 * 1000,
  ).toISOString();

  switch (rule.type) {
    // --------------------------------------------------------------
    case 'empty_trash': {
      // Find trashed Drive files
      const trashedFiles = await db.driveScanResult.findMany({
        where: { accountId, trashed: true },
        select: { id: true, fileId: true, fileName: true, fileSize: true },
      });

      console.log(
        `[CleanupScheduler] empty_trash: would delete ${trashedFiles.length} trashed Drive files`,
      );
      for (const f of trashedFiles) {
        console.log(`  - ${f.fileName} (${f.fileSize} bytes)`);
      }

      const saved = trashedFiles.reduce((sum, f) => sum + f.fileSize, 0);
      return { cleaned: trashedFiles.length, saved };
    }

    // --------------------------------------------------------------
    case 'delete_promos_older_than': {
      const promoEmails = await db.scanResult.findMany({
        where: {
          accountId,
          category: { in: ['promotions', 'promo'] },
          lastReceived: { lt: new Date(cutoff) },
        },
        select: { id: true, senderEmail: true, subject: true, emailCount: true },
      });

      const totalMessages = promoEmails.reduce(
        (sum, e) => sum + e.emailCount,
        0,
      );

      console.log(
        `[CleanupScheduler] delete_promos_older_than (${daysThreshold}d): would delete ${promoEmails.length} promo threads (${totalMessages} messages)`,
      );
      for (const e of promoEmails) {
        console.log(`  - ${e.subject ?? '(no subject)'} from ${e.senderEmail}`);
      }

      // Email size estimation: ~25 KB per message
      const estimatedSaved = totalMessages * 25 * 1024;
      return { cleaned: promoEmails.length, saved: estimatedSaved };
    }

    // --------------------------------------------------------------
    case 'delete_junk_older_than': {
      const junkEmails = await db.scanResult.findMany({
        where: {
          accountId,
          category: { in: ['junk', 'spam'] },
          lastReceived: { lt: new Date(cutoff) },
        },
        select: { id: true, senderEmail: true, subject: true, emailCount: true },
      });

      const totalMessages = junkEmails.reduce(
        (sum, e) => sum + e.emailCount,
        0,
      );

      console.log(
        `[CleanupScheduler] delete_junk_older_than (${daysThreshold}d): would delete ${junkEmails.length} junk threads (${totalMessages} messages)`,
      );
      for (const e of junkEmails) {
        console.log(`  - ${e.subject ?? '(no subject)'} from ${e.senderEmail}`);
      }

      const estimatedSaved = totalMessages * 25 * 1024;
      return { cleaned: junkEmails.length, saved: estimatedSaved };
    }

    // --------------------------------------------------------------
    case 'delete_screenshots_older_than': {
      // Heuristic: files whose name starts with "Screenshot" or "screen shot"
      const screenshots = await db.driveScanResult.findMany({
        where: {
          accountId,
          fileName: {
            startsWith: 'Screenshot',
          },
          createdTime: { lt: cutoff },
          trashed: false,
        },
        select: { id: true, fileId: true, fileName: true, fileSize: true, createdTime: true },
      });

      // Also check for Photos screenshots
      const photoScreenshots = await db.photoScanResult.findMany({
        where: {
          accountId,
          filename: {
            startsWith: 'Screenshot',
          },
          creationTime: { lt: cutoff },
        },
        select: { id: true, photoId: true, filename: true, fileSize: true, creationTime: true },
      });

      const totalItems = screenshots.length + photoScreenshots.length;
      const totalSaved =
        screenshots.reduce((s, f) => s + f.fileSize, 0) +
        photoScreenshots.reduce((s, f) => s + f.fileSize, 0);

      console.log(
        `[CleanupScheduler] delete_screenshots_older_than (${daysThreshold}d): would delete ${screenshots.length} Drive screenshots + ${photoScreenshots.length} Photo screenshots`,
      );

      return { cleaned: totalItems, saved: totalSaved };
    }

    // --------------------------------------------------------------
    case 'delete_large_old_files': {
      // Default threshold for "large": 100 MB, age from param
      const LARGE_THRESHOLD = 100 * 1024 * 1024; // 100 MB

      const largeOldFiles = await db.driveScanResult.findMany({
        where: {
          accountId,
          fileSize: { gt: LARGE_THRESHOLD },
          createdTime: { lt: cutoff },
          trashed: false,
        },
        select: { id: true, fileId: true, fileName: true, fileSize: true, createdTime: true },
      });

      const totalSaved = largeOldFiles.reduce(
        (sum, f) => sum + f.fileSize,
        0,
      );

      console.log(
        `[CleanupScheduler] delete_large_old_files (>100MB, ${daysThreshold}d old): would delete ${largeOldFiles.length} files`,
      );
      for (const f of largeOldFiles) {
        console.log(
          `  - ${f.fileName} (${(f.fileSize / (1024 * 1024)).toFixed(1)} MB, created ${f.createdTime})`,
        );
      }

      return { cleaned: largeOldFiles.length, saved: totalSaved };
    }

    default: {
      console.log(`[CleanupScheduler] Unknown rule type: ${rule.type}`);
      return { cleaned: 0, saved: 0 };
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new cleanup schedule for an account.
 */
export async function createSchedule(
  accountId: string,
  name: string,
  frequency: 'daily' | 'weekly' | 'monthly',
  rules: ScheduleRule[],
): Promise<string> {
  const now = new Date();
  const nextRunAt = computeNextRun(frequency, now);

  const schedule = await db.cleanupSchedule.create({
    data: {
      accountId,
      name,
      frequency,
      rules: JSON.stringify(rules),
      enabled: true,
      nextRunAt,
    },
  });

  return schedule.id;
}

/**
 * Get all cleanup schedules for an account.
 */
export async function getSchedules(accountId: string) {
  return db.cleanupSchedule.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Enable or disable a schedule.
 */
export async function toggleSchedule(
  scheduleId: string,
  enabled: boolean,
): Promise<void> {
  await db.cleanupSchedule.update({
    where: { id: scheduleId },
    data: { enabled },
  });
}

/**
 * Delete a schedule entirely.
 */
export async function deleteSchedule(scheduleId: string): Promise<void> {
  await db.cleanupSchedule.delete({
    where: { id: scheduleId },
  });
}

/**
 * Run a schedule immediately — processes each rule and logs what would happen.
 * Returns aggregated counts. Does NOT actually delete anything; the UI should
 * present the results and let the user confirm before real deletion occurs.
 */
export async function runSchedule(
  scheduleId: string,
): Promise<RunResult> {
  const schedule = await db.cleanupSchedule.findUnique({
    where: { id: scheduleId },
  });

  if (!schedule) {
    return { executed: false, cleaned: 0, saved: 0 };
  }

  if (!schedule.enabled) {
    console.log(
      `[CleanupScheduler] Schedule "${schedule.name}" is disabled — skipping.`,
    );
    return { executed: false, cleaned: 0, saved: 0 };
  }

  const rules: ScheduleRule[] = JSON.parse(schedule.rules);
  let totalCleaned = 0;
  let totalSaved = 0;

  console.log(
    `[CleanupScheduler] Running schedule "${schedule.name}" (${rules.length} rules)`,
  );

  for (const rule of rules) {
    const result = await processRule(schedule.accountId, rule);
    totalCleaned += result.cleaned;
    totalSaved += result.saved;
  }

  // Update schedule stats
  const now = new Date();
  await db.cleanupSchedule.update({
    where: { id: scheduleId },
    data: {
      lastRunAt: now,
      nextRunAt: computeNextRun(schedule.frequency, now),
      totalCleaned: { increment: totalCleaned },
      totalSaved: { increment: totalSaved },
    },
  });

  console.log(
    `[CleanupScheduler] Schedule "${schedule.name}" complete: ${totalCleaned} items, ${formatBytes(totalSaved)} would be freed`,
  );

  return { executed: true, cleaned: totalCleaned, saved: totalSaved };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------


