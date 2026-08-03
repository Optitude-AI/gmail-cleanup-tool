import { google } from 'googleapis';
import { getValidTokens, getOAuthClient } from '@/lib/google-auth';
import { formatBytes } from '@/lib/utils';

export interface PhotoItem {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  creationTime: string;
  baseUrl: string;
  productUrl: string;
  isFavorite: boolean;
}

export interface PhotoStats {
  totalPhotos: number;
  totalSize: number;
  totalSizeFormatted: string;
  favorites: number;
  byMonth: { month: string; count: number; size: number }[];
  largePhotos: number;
  largePhotoSize: number;
}

export async function scanPhotos(accountId: string, maxResults: number = 500): Promise<{ photos: PhotoItem[]; stats: PhotoStats }> {
  const { accessToken, refreshToken } = await getValidTokens(accountId);
  const oauth2Client = getOAuthClient(accessToken, refreshToken);

  const photos: PhotoItem[] = [];

  try {
    // Use the Photos Library API
    const res = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.mediaItems) {
        for (const item of data.mediaItems) {
          const meta = item.mediaMetadata || {};
          photos.push({
            id: item.id,
            filename: item.filename || 'photo',
            mimeType: item.mimeType || 'image/jpeg',
            size: meta.fileSize ? parseInt(meta.fileSize, 10) : 0,
            width: meta.width || 0,
            height: meta.height || 0,
            creationTime: meta.creationTime || '',
            baseUrl: item.baseUrl || '',
            productUrl: item.productUrl || '',
            isFavorite: item.isFavorite || false,
          });
        }
      }
    }
  } catch {
    // Photos API might not be enabled - fall back to Drive scan for images
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    let pageToken: string | undefined;

    do {
      const res = await drive.files.list({
        auth: oauth2Client,
        q: "mimeType contains 'image/'",
        fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, imageMediaMetadata, thumbnailLink)',
        pageSize: Math.min(maxResults - photos.length, 100),
        pageToken,
        corpora: 'allDrives',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });

      if (res.data.files) {
        for (const f of res.data.files) {
          const imgMeta = (f as { imageMediaMetadata?: { width?: number; height?: number } }).imageMediaMetadata || {};
          photos.push({
            id: f.id!,
            filename: f.name || 'photo',
            mimeType: f.mimeType || 'image/jpeg',
            size: parseInt(f.size || '0', 10),
            width: imgMeta.width || 0,
            height: imgMeta.height || 0,
            creationTime: f.createdTime || '',
            baseUrl: `https://drive.google.com/thumbnail?id=${f.id}&sz=w800`,
            productUrl: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
            isFavorite: false,
          });
        }
      }
      pageToken = res.data.nextPageToken;
    } while (pageToken && photos.length < maxResults);
  }

  // Calculate stats
  const totalSize = photos.reduce((s, p) => s + p.size, 0);
  const favorites = photos.filter(p => p.isFavorite).length;
  const largePhotos = photos.filter(p => p.size > 10 * 1024 * 1024);
  const largePhotoSize = largePhotos.reduce((s, p) => s + p.size, 0);

  // Group by month
  const monthMap = new Map<string, { count: number; size: number }>();
  for (const p of photos) {
    if (p.creationTime) {
      const month = p.creationTime.substring(0, 7); // "2024-01"
      const existing = monthMap.get(month) || { count: 0, size: 0 };
      existing.count++;
      existing.size += p.size;
      monthMap.set(month, existing);
    }
  }
  const byMonth = Array.from(monthMap.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => b.month.localeCompare(a.month));

  const stats: PhotoStats = {
    totalPhotos: photos.length,
    totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    favorites,
    byMonth,
    largePhotos: largePhotos.length,
    largePhotoSize,
  };

  return { photos, stats };
}

export async function downloadPhoto(accountId: string, photoId: string, baseUrl?: string, maxWidth: number = 800): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  const { accessToken, refreshToken } = await getValidTokens(accountId);
  const oauth2Client = getOAuthClient(accessToken, refreshToken);

  // Use Photos Library API baseUrl with download token
  const url = baseUrl
    ? `${baseUrl}=d` // Append "=d" to get the actual download
    : `https://photoslibrary.googleapis.com/v1/mediaItems/${photoId}:download`;

  const response = await fetch(url, {
    headers: baseUrl ? {} : { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    // Fallback to Drive
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const driveRes = await drive.files.get({ fileId: photoId, alt: 'media', responseType: 'arraybuffer' });
    const buffer = Buffer.from(driveRes.data as ArrayBuffer, 'binary');
    return { buffer, fileName: 'photo.jpg', mimeType: 'image/jpeg' };
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, fileName: `photo_${photoId}.jpg`, mimeType: contentType };
}

export async function deletePhotos(accountId: string, photoIds: string[]): Promise<{ success: number; failed: number }> {
  const { accessToken } = await getValidTokens(accountId);

  let success = 0;
  let failed = 0;

  try {
    // Try Photos Library API batch delete
    const res = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:batchDelete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mediaItemIds: photoIds }),
    });

    if (res.ok) {
      return { success: photoIds.length, failed: 0 };
    }
  } catch {
    // Fall back to Drive delete
  }

  // Drive fallback
  const oauth2Client = getOAuthClient(accessToken);
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  for (const id of photoIds) {
    try {
      await drive.files.update({ fileId: id, requestBody: { trashed: true } });
      success++;
    } catch {
      failed++;
    }
  }

  return { success, failed };
}

export interface PhotoSuggestion {
  id: string;
  type: 'blurry' | 'similar' | 'large_unoptimized' | 'screenshots' | 'old_photos';
  title: string;
  description: string;
  potentialSavings: number;
  potentialSavingsFormatted: string;
  severity: 'low' | 'medium' | 'high';
  photoIds: string[];
  actionable: boolean;
}

export function generatePhotoSuggestions(photos: PhotoItem[], stats: PhotoStats): PhotoSuggestion[] {
  const suggestions: PhotoSuggestion[] = [];

  // 1. Large unoptimized photos
  const large = photos.filter(p => p.size > 10 * 1024 * 1024);
  if (large.length > 0) {
    const largeSize = large.reduce((s, p) => s + p.size, 0);
    suggestions.push({
      id: 'large_photos',
      type: 'large_unoptimized',
      title: `${large.length} Large Photo${large.length !== 1 ? 's' : ''} (>10 MB)`,
      description: `These high-resolution photos could be compressed to save space. Total: ${formatBytes(largeSize)}.`,
      potentialSavings: Math.floor(largeSize * 0.6),
      potentialSavingsFormatted: formatBytes(Math.floor(largeSize * 0.6)),
      severity: largeSize > 1 * 1024 * 1024 * 1024 ? 'high' : 'medium',
      photoIds: large.map(p => p.id),
      actionable: true,
    });
  }

  // 2. Potential screenshots (images close to common screen ratios)
  const screenshots = photos.filter(p => {
    const ratio = p.width / p.height;
    return (Math.abs(ratio - 16 / 9) < 0.1 || Math.abs(ratio - 16 / 10) < 0.1) && p.size < 5 * 1024 * 1024;
  });
  if (screenshots.length > 20) {
    const ssSize = screenshots.reduce((s, p) => s + p.size, 0);
    suggestions.push({
      id: 'screenshots',
      type: 'screenshots',
      title: `${screenshots.length} Screenshot${screenshots.length !== 1 ? 's' : ''}`,
      description: `Many screenshots detected. Consider removing old or unnecessary ones to save ${formatBytes(ssSize)}.`,
      potentialSavings: ssSize,
      potentialSavingsFormatted: formatBytes(ssSize),
      severity: 'low',
      photoIds: screenshots.map(p => p.id),
      actionable: true,
    });
  }

  // 3. Storage summary suggestion
  if (stats.totalSize > 5 * 1024 * 1024 * 1024) {
    suggestions.push({
      id: 'storage_tip',
      type: 'old_photos',
      title: 'Storage Running High',
      description: `Your photo storage is ${stats.totalSizeFormatted}. Consider using Google One storage or freeing up space by removing old photos.`,
      potentialSavings: 0,
      potentialSavingsFormatted: 'N/A',
      severity: 'high',
      photoIds: [],
      actionable: false,
    });
  }

  return suggestions.sort((a, b) => b.potentialSavings - a.potentialSavings);
}
