import { type DriveFile, type DriveStats } from '@/lib/drive';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

interface CleanupPlan {
  targetToFree: number;
  targetFormatted: string;
  totalCanBeFreed: number;
  totalCanBeFreedFormatted: string;
  steps: CleanupStep[];
  estimatedTime: string;
}

interface CleanupStep {
  id: string;
  order: number;
  action: string;
  service: string;
  description: string;
  filesAffected: number;
  spaceFreed: number;
  spaceFreedFormatted: string;
  risk: 'safe' | 'low' | 'medium' | 'high';
  riskExplanation: string;
  fileIds: string[];
}

/**
 * Generates an optimal cleanup plan to free a target amount of space.
 *
 * The plan prioritizes by risk level (safest first) and stops adding steps
 * once the cumulative space freed meets the target, plus one extra step for margin.
 *
 * Priority order:
 *   1. Empty trash            (risk: safe)
 *   2. Remove duplicates      (risk: safe, keeps one copy)
 *   3. Old unused files >2yr  (risk: low)
 *   4. Large files >100MB     (risk: medium, suggest download first)
 *   5. Promotional emails    (risk: safe)
 *   6. Junk emails           (risk: safe)
 *   7. Old screenshots        (risk: low)
 *   8. Large unoptimized photos (risk: medium)
 */
export function generateCleanupPlan(
  targetBytes: number,
  driveFiles: DriveFile[],
  gmailResults: any[],
  photoItems: any[],
  driveStats: DriveStats,
): CleanupPlan {
  const candidateSteps: CleanupStep[] = [];
  let order = 1;

  // --- 1. Empty trash (risk: safe) ---
  const trashedFiles = driveFiles.filter((f) => f.trashed);
  if (trashedFiles.length > 0 && driveStats.trashedSize > 0) {
    candidateSteps.push({
      id: 'empty-trash',
      order: order++,
      action: 'Empty Trash',
      service: 'drive',
      description: `Permanently delete ${trashedFiles.length} file${trashedFiles.length !== 1 ? 's' : ''} sitting in trash`,
      filesAffected: trashedFiles.length,
      spaceFreed: driveStats.trashedSize,
      spaceFreedFormatted: formatBytes(driveStats.trashedSize),
      risk: 'safe',
      riskExplanation:
        'These files are already in trash and will be permanently removed. They have been marked for deletion by the user previously.',
      fileIds: trashedFiles.map((f) => f.id),
    });
  }

  // --- 2. Remove duplicates (risk: safe, keeps one copy) ---
  const dupGroups = findDuplicateGroups(driveFiles);
  const dupeFiles = dupGroups.flatMap((g) => g.slice(1));
  if (dupeFiles.length > 0) {
    const dupeSize = dupeFiles.reduce((s, f) => s + f.size, 0);
    candidateSteps.push({
      id: 'remove-duplicates',
      order: order++,
      action: 'Remove Duplicate Files',
      service: 'drive',
      description: `Remove ${dupeFiles.length} duplicate file${dupeFiles.length !== 1 ? 's' : ''} across ${dupGroups.length} group${dupGroups.length !== 1 ? 's' : ''}, keeping one copy of each`,
      filesAffected: dupeFiles.length,
      spaceFreed: dupeSize,
      spaceFreedFormatted: formatBytes(dupeSize),
      risk: 'safe',
      riskExplanation:
        'One copy of each duplicate set is kept. Only extra identical files (same name and size) are removed.',
      fileIds: dupeFiles.map((f) => f.id),
    });
  }

  // --- 3. Remove old unused files >2 years (risk: low) ---
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const oldFiles = driveFiles.filter(
    (f) =>
      !f.trashed &&
      f.mimeType !== 'application/vnd.google-apps.folder' &&
      new Date(f.modifiedTime) < twoYearsAgo,
  );
  if (oldFiles.length > 0) {
    const oldSize = oldFiles.reduce((s, f) => s + f.size, 0);
    candidateSteps.push({
      id: 'remove-old-files',
      order: order++,
      action: 'Remove Old Unused Files',
      service: 'drive',
      description: `Remove ${oldFiles.length} file${oldFiles.length !== 1 ? 's' : ''} not modified in over 2 years`,
      filesAffected: oldFiles.length,
      spaceFreed: oldSize,
      spaceFreedFormatted: formatBytes(oldSize),
      risk: 'low',
      riskExplanation:
        'These files have not been accessed or modified in over 2 years. They may be outdated backups or forgotten documents.',
      fileIds: oldFiles.map((f) => f.id),
    });
  }

  // --- 4. Remove large files >100MB (risk: medium) ---
  const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024;
  const largeFiles = driveFiles
    .filter((f) => !f.trashed && f.size >= LARGE_FILE_THRESHOLD)
    .sort((a, b) => b.size - a.size);
  if (largeFiles.length > 0) {
    const largeSize = largeFiles.reduce((s, f) => s + f.size, 0);
    candidateSteps.push({
      id: 'remove-large-files',
      order: order++,
      action: 'Remove Large Files (>100 MB)',
      service: 'drive',
      description: `Remove ${largeFiles.length} large file${largeFiles.length !== 1 ? 's' : ''} (100 MB or more each)`,
      filesAffected: largeFiles.length,
      spaceFreed: largeSize,
      spaceFreedFormatted: formatBytes(largeSize),
      risk: 'medium',
      riskExplanation:
        'These are large files that consume significant storage. We recommend downloading them locally before deleting.',
      fileIds: largeFiles.map((f) => f.id),
    });
  }

  // --- 5. Remove promotional emails (risk: safe) ---
  const promoEmails = gmailResults.filter(
    (e: any) =>
      e.labelIds?.includes('CATEGORY_PROMOTIONS') ||
      (e.category === 'promotion' || e.category === 'subscription'),
  );
  if (promoEmails.length > 0) {
    // Gmail emails are very small in size; estimate ~50KB average including attachments
    const promoSize = promoEmails.length * 50 * 1024;
    candidateSteps.push({
      id: 'remove-promotional-emails',
      order: order++,
      action: 'Remove Promotional Emails',
      service: 'gmail',
      description: `Delete ${promoEmails.length} promotional and subscription email${promoEmails.length !== 1 ? 's' : ''}`,
      filesAffected: promoEmails.length,
      spaceFreed: promoSize,
      spaceFreedFormatted: formatBytes(promoSize),
      risk: 'safe',
      riskExplanation:
        'These are marketing, newsletter, and promotional emails. Personal and important emails are not affected.',
      fileIds: promoEmails.map((e: any) => e.id),
    });
  }

  // --- 6. Remove junk emails (risk: safe) ---
  const junkEmails = gmailResults.filter(
    (e: any) =>
      e.labelIds?.includes('SPAM') ||
      e.labelIds?.includes('JUNK') ||
      e.category === 'junk',
  );
  if (junkEmails.length > 0) {
    const junkSize = junkEmails.length * 30 * 1024;
    candidateSteps.push({
      id: 'remove-junk-emails',
      order: order++,
      action: 'Remove Junk & Spam Emails',
      service: 'gmail',
      description: `Delete ${junkEmails.length} junk and spam email${junkEmails.length !== 1 ? 's' : ''}`,
      filesAffected: junkEmails.length,
      spaceFreed: junkSize,
      spaceFreedFormatted: formatBytes(junkSize),
      risk: 'safe',
      riskExplanation:
        'These are spam and junk emails already flagged by Gmail. Deleting them permanently clears them from your account.',
      fileIds: junkEmails.map((e: any) => e.id),
    });
  }

  // --- 7. Remove old screenshots (risk: low) ---
  const screenshots = photoItems.filter((p: any) => {
    const ratio = p.width / p.height;
    const isScreenRatio =
      Math.abs(ratio - 16 / 9) < 0.1 || Math.abs(ratio - 16 / 10) < 0.1;
    const isSmall = p.size < 5 * 1024 * 1024;
    return isScreenRatio && isSmall;
  });
  // Only consider screenshots older than 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const oldScreenshots = screenshots.filter(
    (p: any) => p.creationTime && new Date(p.creationTime) < sixMonthsAgo,
  );
  if (oldScreenshots.length > 0) {
    const ssSize = oldScreenshots.reduce((s: number, p: any) => s + p.size, 0);
    candidateSteps.push({
      id: 'remove-old-screenshots',
      order: order++,
      action: 'Remove Old Screenshots',
      service: 'photos',
      description: `Remove ${oldScreenshots.length} screenshot${oldScreenshots.length !== 1 ? 's' : ''} older than 6 months`,
      filesAffected: oldScreenshots.length,
      spaceFreed: ssSize,
      spaceFreedFormatted: formatBytes(ssSize),
      risk: 'low',
      riskExplanation:
        'Screenshots older than 6 months are usually temporary captures that are no longer needed. Important photos are not affected.',
      fileIds: oldScreenshots.map((p: any) => p.id),
    });
  }

  // --- 8. Remove large unoptimized photos (risk: medium) ---
  const LARGE_PHOTO_THRESHOLD = 10 * 1024 * 1024;
  const largePhotos = photoItems.filter((p: any) => p.size > LARGE_PHOTO_THRESHOLD);
  if (largePhotos.length > 0) {
    const photoSize = largePhotos.reduce((s: number, p: any) => s + p.size, 0);
    candidateSteps.push({
      id: 'remove-large-photos',
      order: order++,
      action: 'Remove Large Unoptimized Photos',
      service: 'photos',
      description: `Remove ${largePhotos.length} photo${largePhotos.length !== 1 ? 's' : ''} larger than 10 MB (unoptimized originals)`,
      filesAffected: largePhotos.length,
      spaceFreed: photoSize,
      spaceFreedFormatted: formatBytes(photoSize),
      risk: 'medium',
      riskExplanation:
        'These are high-resolution photos that take up significant space. Consider downloading them locally or compressing them before deleting.',
      fileIds: largePhotos.map((p: any) => p.id),
    });
  }

  // Calculate total space available across all candidates
  const totalCanBeFreed = candidateSteps.reduce((s, step) => s + step.spaceFreed, 0);

  // Select steps until the target is reached, plus one extra for margin
  const selectedSteps: CleanupStep[] = [];
  let cumulativeFreed = 0;

  for (const step of candidateSteps) {
    if (step.spaceFreed === 0) continue;
    selectedSteps.push(step);
    cumulativeFreed += step.spaceFreed;

    // Stop once target is met; the current step provides margin
    if (cumulativeFreed >= targetBytes && selectedSteps.length > 1) {
      break;
    }
  }

  // If no steps meet the target but we have candidates, include all
  if (selectedSteps.length === 0 && candidateSteps.length > 0) {
    selectedSteps.push(...candidateSteps);
  }

  const actualTotal = selectedSteps.reduce((s, step) => s + step.spaceFreed, 0);
  const estimatedMinutes = Math.max(1, Math.ceil(selectedSteps.length * 1.5));
  const estimatedHours = Math.floor(estimatedMinutes / 60);
  const estimatedMins = estimatedMinutes % 60;
  const estimatedTime =
    estimatedHours > 0
      ? `~${estimatedHours}h ${estimatedMins}m`
      : `~${estimatedMins}m`;

  return {
    targetToFree: targetBytes,
    targetFormatted: formatBytes(targetBytes),
    totalCanBeFreed,
    totalCanBeFreedFormatted: formatBytes(totalCanBeFreed),
    steps: selectedSteps,
    estimatedTime,
  };
}

/**
 * Groups Drive files by name+size to identify duplicate sets.
 * Returns only groups with 2 or more files (i.e. duplicates).
 */
function findDuplicateGroups(files: DriveFile[]): DriveFile[][] {
  const groups = new Map<string, DriveFile[]>();
  for (const f of files) {
    if (f.trashed) continue;
    const key = `${f.name.toLowerCase()}|${f.size}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  return Array.from(groups.values()).filter((g) => g.length > 1);
}

export type { CleanupPlan, CleanupStep };
