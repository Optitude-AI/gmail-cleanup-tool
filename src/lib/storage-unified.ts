import { google } from 'googleapis';
import { getValidTokens, getOAuthClient } from '@/lib/google-auth';

export interface UnifiedStorage {
  limit: number;
  used: number;
  usedFormatted: string;
  free: number;
  freeFormatted: string;
  percentUsed: number;
  gmail: {
    used: number;
    formatted: string;
    emailCount: number;
    attachmentCount: number;
  };
  drive: {
    used: number;
    formatted: string;
    fileCount: number;
    trashSize: number;
  };
  photos: {
    used: number;
    formatted: string;
    photoCount: number;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Fetch Gmail attachment statistics.
 * Lists messages with attachments > 1MB and estimates total attachment storage.
 */
async function getGmailStorage(
  accessToken: string,
  refreshToken?: string | null
): Promise<UnifiedStorage['gmail']> {
  const oauth2Client = getOAuthClient(accessToken, refreshToken);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  let emailCount = 0;
  let attachmentCount = 0;

  try {
    // Count total emails with attachments larger than 1MB
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'has:attachment larger:1m',
      maxResults: 500,
    });

    const messages = res.data.messages || [];
    attachmentCount = messages.length;

    // Also get a rough total email count for context
    const allRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 1,
    });
    // resultMessagesEstimate is only available in some responses
    emailCount = (allRes.data as any).resultSizeEstimate || messages.length;

    // If there are attachment emails, try to get a more accurate total count
    if (attachmentCount === 500) {
      // There are more than 500; we have the maxResults cap
      // Fetch total count via a metadata-only query
      try {
        const countRes = await gmail.users.messages.list({
          userId: 'me',
          q: 'has:attachment larger:1m',
          maxResults: 1,
        });
        attachmentCount = (countRes.data as any).resultSizeEstimate || attachmentCount;
      } catch {
        // keep the 500 count
      }
    }
  } catch {
    // Gmail API call failed — return zeros
  }

  // Estimate: average 2 MB per attachment email
  const AVG_ATTACHMENT_SIZE = 2 * 1024 * 1024;
  const used = attachmentCount * AVG_ATTACHMENT_SIZE;

  return {
    used,
    formatted: formatBytes(used),
    emailCount,
    attachmentCount,
  };
}

/**
 * Fetch Drive storage info via the about.get endpoint.
 * Returns actual usage data from Google's storage quota.
 */
async function getDriveStorage(
  accessToken: string,
  refreshToken?: string | null
): Promise<UnifiedStorage['drive']> {
  const oauth2Client = getOAuthClient(accessToken, refreshToken);
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  let used = 0;
  let fileCount = 0;
  let trashSize = 0;

  try {
    // Get storage quota info
    const about = await drive.about.get({
      fields: 'storageQuota, user',
    });

    const quota = (about.data as any).storageQuota || {};
    used = parseInt(quota.usageInDrive || '0', 10) || 0;
    trashSize = parseInt(quota.usageInDriveTrash || '0', 10) || 0;

    // Get approximate file count (non-trashed)
    try {
      const listRes = await drive.files.list({
        pageSize: 1,
        fields: 'files(id)',
        corpora: 'allDrives',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        q: 'trashed = false',
      });
      fileCount = listRes.data.files?.length ?? 0;
      // The API may not return a total count directly;
      // use resultSizeEstimate if available
      fileCount = (listRes.data as any).resultSizeEstimate || fileCount;
    } catch {
      // keep default fileCount of 0
    }
  } catch {
    // Drive API call failed — return zeros
  }

  return {
    used,
    formatted: formatBytes(used),
    fileCount,
    trashSize,
  };
}

/**
 * Fetch Photos storage.
 * Tries the Photos Library API first; falls back to counting image files in Drive.
 */
async function getPhotosStorage(
  accessToken: string,
  refreshToken?: string | null
): Promise<UnifiedStorage['photos']> {
  let used = 0;
  let photoCount = 0;

  try {
    // Attempt the Photos Library API
    const res = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      const data = await res.json();
      const items = data.mediaItems || [];
      photoCount = items.length;

      // Sum up file sizes from mediaMetadata
      for (const item of items) {
        const meta = item.mediaMetadata || {};
        if (meta.fileSize) {
          used += parseInt(meta.fileSize, 10);
        }
      }
    } else {
      throw new Error('Photos API not available');
    }
  } catch {
    // Fallback: count image files in Drive
    try {
      const oauth2Client = getOAuthClient(accessToken, refreshToken);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      let pageToken: string | undefined;
      const allImageSizes: number[] = [];

      do {
        const listRes = await drive.files.list({
          q: "mimeType contains 'image/' and trashed = false",
          fields: 'nextPageToken, files(size)',
          pageSize: 100,
          pageToken,
          corpora: 'allDrives',
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
        });

        if (listRes.data.files) {
          for (const f of listRes.data.files) {
            const size = parseInt(f.size || '0', 10);
            allImageSizes.push(size);
          }
        }
        pageToken = listRes.data.nextPageToken;
      } while (pageToken && allImageSizes.length < 1000);

      photoCount = allImageSizes.length;
      used = allImageSizes.reduce((sum, s) => sum + s, 0);
    } catch {
      // Both APIs failed — return zeros
    }
  }

  return {
    used,
    formatted: formatBytes(used),
    photoCount,
  };
}

/**
 * Builds a unified storage gauge across Gmail, Drive, and Photos.
 * Uses the Drive about.get endpoint for authoritative quota numbers,
 * supplemented by Gmail attachment estimation and Photos scanning.
 */
export async function getUnifiedStorage(accountId: string): Promise<UnifiedStorage> {
  const { accessToken, refreshToken } = await getValidTokens(accountId);

  // Run all three service queries in parallel for speed
  const [gmailStorage, driveStorage, photosStorage] = await Promise.all([
    getGmailStorage(accessToken, refreshToken),
    getDriveStorage(accessToken, refreshToken),
    getPhotosStorage(accessToken, refreshToken),
  ]);

  // The Drive about.get storageQuota gives us the authoritative total used & limit.
  // We augment it with per-service breakdowns.
  // If Drive didn't return a limit, default to 15 GB (free tier).
  const DEFAULT_LIMIT = 15 * 1024 * 1024 * 1024;

  let limit = DEFAULT_LIMIT;
  let used = 0;

  try {
    const oauth2Client = getOAuthClient(accessToken, refreshToken);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const about = await drive.about.get({
      fields: 'storageQuota, user',
    });
    const quota = (about.data as any).storageQuota || {};
    limit = parseInt(quota.limit || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT;
    used = parseInt(quota.usage || '0', 10) || 0;
  } catch {
    // Fallback: sum the individual estimates
    used = gmailStorage.used + driveStorage.used + photosStorage.used;
  }

  const free = Math.max(0, limit - used);
  const percentUsed = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  return {
    limit,
    used,
    usedFormatted: formatBytes(used),
    free,
    freeFormatted: formatBytes(free),
    percentUsed: Math.round(percentUsed * 10) / 10,
    gmail: gmailStorage,
    drive: driveStorage,
    photos: photosStorage,
  };
}
