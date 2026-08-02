import { db } from '@/lib/db';

export interface DedupItem {
  service: 'gmail' | 'drive' | 'photos';
  fileId: string;
  fileName: string;
  canDelete: boolean;
}

export interface DedupGroup {
  hashSignature: string;
  fileName: string;
  fileSize: number;
  items: DedupItem[];
  spaceRecoverable: number; // total - largest copy
}

/**
 * Compute a hash-like signature for deduplication.
 * Format: lowercased trimmed name + '|' + file size in bytes.
 */
export async function computeHashForFile(
  name: string,
  size: number,
): Promise<string> {
  return `${name.toLowerCase().trim()}|${size}`;
}

/**
 * Find duplicate files across Drive and Photos for a given account.
 *
 * Groups items by their hash signature (name + size) and returns only
 * groups that contain 2 or more items, sorted by recoverable space descending.
 */
export async function findCrossServiceDuplicates(
  accountId: string,
): Promise<DedupGroup[]> {
  // 1. Query Drive files with hash signatures
  const driveFiles = await db.driveScanResult.findMany({
    where: {
      accountId,
      hashSignature: { not: null },
    },
    select: {
      fileId: true,
      fileName: true,
      fileSize: true,
      hashSignature: true,
      trashed: true,
      sharedWithMe: true,
      ownerEmail: true,
    },
  });

  // 2. Query Photos with hash signatures
  const photos = await db.photoScanResult.findMany({
    where: {
      accountId,
      hashSignature: { not: null },
    },
    select: {
      photoId: true,
      filename: true,
      fileSize: true,
      hashSignature: true,
      isFavorite: true,
    },
  });

  // 3. Compute signatures for any items that don't already have one
  interface RawItem {
    service: 'drive' | 'photos';
    fileId: string;
    fileName: string;
    fileSize: number;
    signature: string;
    canDelete: boolean;
  }

  const allItems: RawItem[] = [];

  for (const file of driveFiles) {
    const sig =
      file.hashSignature ?? (await computeHashForFile(file.fileName, file.fileSize));

    // Update hash signature in DB if it was null
    if (!file.hashSignature) {
      await db.driveScanResult.update({
        where: { fileId: file.fileId },
        data: { hashSignature: sig },
      });
    }

    // Can delete if not shared with the user and not trashed
    const canDelete = !file.sharedWithMe && !file.trashed;

    allItems.push({
      service: 'drive',
      fileId: file.fileId,
      fileName: file.fileName,
      fileSize: file.fileSize,
      signature: sig,
      canDelete,
    });
  }

  for (const photo of photos) {
    const sig =
      photo.hashSignature ?? (await computeHashForFile(photo.filename, photo.fileSize));

    // Update hash signature in DB if it was null
    if (!photo.hashSignature) {
      await db.photoScanResult.update({
        where: { photoId: photo.photoId },
        data: { hashSignature: sig },
      });
    }

    // Can delete if not favorited
    const canDelete = !photo.isFavorite;

    allItems.push({
      service: 'photos',
      fileId: photo.photoId,
      fileName: photo.filename,
      fileSize: photo.fileSize,
      signature: sig,
      canDelete,
    });
  }

  // 4. Group by signature
  const groupMap = new Map<string, DedupItem[]>();
  const groupMeta = new Map<
    string,
    { fileName: string; fileSize: number; totalSize: number }
  >();

  for (const item of allItems) {
    if (!groupMap.has(item.signature)) {
      groupMap.set(item.signature, []);
      groupMeta.set(item.signature, {
        fileName: item.fileName,
        fileSize: item.fileSize,
        totalSize: 0,
      });
    }

    groupMap.get(item.signature)!.push({
      service: item.service,
      fileId: item.fileId,
      fileName: item.fileName,
      canDelete: item.canDelete,
    });

    const meta = groupMeta.get(item.signature)!;
    meta.totalSize += item.fileSize;
    // Keep the file size consistent (all duplicates should be the same size)
    meta.fileSize = Math.max(meta.fileSize, item.fileSize);
  }

  // 5. Build DedupGroup for groups with 2+ items
  const groups: DedupGroup[] = [];

  for (const [signature, items] of groupMap) {
    if (items.length < 2) continue;

    const meta = groupMeta.get(signature)!;
    // Space recoverable = total size of all copies minus the largest (keep one)
    const spaceRecoverable = meta.totalSize - meta.fileSize;

    groups.push({
      hashSignature: signature,
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      items,
      spaceRecoverable,
    });
  }

  // 6. Sort by space recoverable descending
  groups.sort((a, b) => b.spaceRecoverable - a.spaceRecoverable);

  // 7. Persist cross-service duplicate groups in DB
  //    Upsert based on accountId + hashSignature
  for (const group of groups) {
    const services = [...new Set(group.items.map((i) => i.service))].join(',');

    await db.crossServiceDuplicate.upsert({
      where: {
        id: `${accountId}-${group.hashSignature}`,
      },
      update: {
        services,
        fileName: group.fileName,
        fileSize: group.fileSize,
      },
      create: {
        id: `${accountId}-${group.hashSignature}`,
        accountId,
        hashSignature: group.hashSignature,
        services,
        fileName: group.fileName,
        fileSize: group.fileSize,
      },
    });
  }

  return groups;
}
