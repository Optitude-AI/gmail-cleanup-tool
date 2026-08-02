import { google } from 'googleapis';
import { getValidTokens, getOAuthClient } from '@/lib/google-auth';
import { formatBytes } from '@/lib/utils';

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
 * Fetch Drive storage quota from about.get.
 * This is the single source of truth for total quota and is called only once.
 */
async function getDriveQuota(
  accessToken: string,
  refreshToken?: string | null
): Promise<{ limit: number; usage: number; usageInDrive: number; usageInDriveTrash: number }> {
  const DEFAULT_LIMIT = 15 * 1024 * 1024 * 1024;
  try {
    const oauth2Client = getOAuthClient(accessToken, refreshToken);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const about = await drive.about.get({
      fields: 'storageQuota, user',
    });
    const quota = (about.data as any).storageQuota || {};
    return {
      limit: parseInt(quota.limit || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      usage: parseInt(quota.usage || '0', 10) || 0,
      usageInDrive: parseInt(quota.usageInDrive || '0', 10) || 0,
      usageInDriveTrash: parseInt(quota.usageInDriveTrash || '0', 10) || 0,
    };
  } catch {
    return { limit: DEFAULT_LIMIT, usage: 0, usageInDrive: 0, usageInDriveTrash: 0 };
  }
}

/**
 * Fetch Drive storage info. Accepts pre-fetched quota to avoid a second API call.
 */
async function getDriveStorage(
  accessToken: string,
  refreshToken?: string | null,
  driveQuota?: Awaited<ReturnType<typeof getDriveQuota>>
): Promise<UnifiedStorage['drive']> {
  const quota = driveQuota || await getDriveQuota(accessToken, refreshToken);
  let fileCount = 0;

  try {
    const oauth2Client = getOAuthClient(accessToken, refreshToken);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const listRes = await drive.files.list({
      pageSize: 1,
      fields: 'files(id)',
      corpora: 'allDrives',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      q: 'trashed = false',
    });
    fileCount = (listRes.data as any).resultSizeEstimate || listRes.data.files?.length ?? 0;
  } catch {
    // keep default fileCount of 0
  }

  return {
    used: quota.usageInDrive,
    formatted: formatBytes(quota.usageInDrive),
    fileCount,
    trashSize: quota.usageInDriveTrash,
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
 * The Drive about.get call is made exactly once.
 */
export async function getUnifiedStorage(accountId: string): Promise<UnifiedStorage> {
  const { accessToken, refreshToken } = await getValidTokens(accountId);

  // Fetch Drive quota once — this is the only about.get call
  const driveQuota = await getDriveQuota(accessToken, refreshToken);

  // Run Gmail, Photos, and Drive file-count queries in parallel (no about.get in getDriveStorage now)
  const [gmailStorage, driveStorage, photosStorage] = await Promise.all([
    getGmailStorage(accessToken, refreshToken),
    getDriveStorage(accessToken, refreshToken, driveQuota),
    getPhotosStorage(accessToken, refreshToken),
  ]);

  const limit = driveQuota.limit;
  const used = driveQuota.usage || (gmailStorage.used + driveStorage.used + photosStorage.used);

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
