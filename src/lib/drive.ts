import { google } from 'googleapis';
import { getValidTokens, getOAuthClient } from '@/lib/google-auth';
import { formatBytes } from '@/lib/utils';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  modifiedTime: string;
  ownedByMe: boolean;
  trashed: boolean;
  parents: string[];
  webViewLink: string;
  thumbnailLink?: string;
  exportName?: string;
  canDownload: boolean;
}

export interface DriveStats {
  totalFiles: number;
  totalSize: number;
  totalSizeFormatted: string;
  trashedFiles: number;
  trashedSize: number;
  trashedSizeFormatted: string;
  largeFiles: number;
  largeFileSize: number;
  duplicatesCount: number;
  byType: Record<string, { count: number; size: number }>;
  byFolder: { name: string; count: number; size: number }[];
}

const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100 MB

function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'Images';
  if (mimeType.startsWith('video/')) return 'Videos';
  if (mimeType.startsWith('audio/')) return 'Audio';
  if (mimeType.includes('pdf')) return 'PDFs';
  if (mimeType.includes('document') || mimeType.includes('spreadsheet') || mimeType.includes('presentation')) return 'Documents';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('gz')) return 'Archives';
  if (mimeType.includes('application')) return 'Other Files';
  return 'Other Files';
}

export async function scanDriveFiles(accountId: string, maxResults: number = 1000): Promise<{ files: DriveFile[]; stats: DriveStats }> {
  const { accessToken, refreshToken } = await getValidTokens(accountId);
  const drive = google.drive({ version: 'v3', auth: getOAuthClient(accessToken, refreshToken) });

  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      auth: getOAuthClient(accessToken, refreshToken),
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, ownedByMe, trashed, parents, webViewLink, thumbnailLink, capabilities)',
      pageSize: Math.min(maxResults - files.length, 100),
      pageToken,
      corpora: 'allDrives',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    if (res.data.files) {
      for (const f of res.data.files) {
        files.push({
          id: f.id!,
          name: f.name || 'Untitled',
          mimeType: f.mimeType || 'application/octet-stream',
          size: parseInt(f.size || '0', 10),
          createdTime: f.createdTime || '',
          modifiedTime: f.modifiedTime || '',
          ownedByMe: f.ownedByMe ?? true,
          trashed: f.trashed ?? false,
          parents: f.parents || [],
          webViewLink: f.webViewLink || '',
          thumbnailLink: f.thumbnailLink || undefined,
          exportName: getExportName(f.mimeType || '', f.name || ''),
          canDownload: f.capabilities?.canDownload ?? true,
        });
      }
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken && files.length < maxResults);

  // Calculate stats
  const activeFiles = files.filter(f => !f.trashed);
  const trashedFiles = files.filter(f => f.trashed);
  const largeFiles = activeFiles.filter(f => f.size >= LARGE_FILE_THRESHOLD);

  const byType: Record<string, { count: number; size: number }> = {};
  for (const f of activeFiles) {
    const cat = getFileCategory(f.mimeType);
    if (!byType[cat]) byType[cat] = { count: 0, size: 0 };
    byType[cat].count++;
    byType[cat].size += f.size;
  }

  const totalSize = activeFiles.reduce((s, f) => s + f.size, 0);
  const trashedSize = trashedFiles.reduce((s, f) => s + f.size, 0);

  const stats: DriveStats = {
    totalFiles: activeFiles.length,
    totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    trashedFiles: trashedFiles.length,
    trashedSize: trashedSize,
    trashedSizeFormatted: formatBytes(trashedSize),
    largeFiles: largeFiles.length,
    largeFileSize: largeFiles.reduce((s, f) => s + f.size, 0),
    duplicatesCount: findDuplicates(files),
    byType,
    byFolder: [], // computed separately if needed
  };

  return { files, stats };
}

function findDuplicates(files: DriveFile[]): number {
  const nameSize = new Map<string, DriveFile[]>();
  for (const f of files) {
    if (f.trashed) continue;
    const key = `${f.name.toLowerCase()}|${f.size}`;
    if (!nameSize.has(key)) nameSize.set(key, []);
    nameSize.get(key)!.push(f);
  }
  let dupes = 0;
  for (const [, group] of nameSize) {
    if (group.length > 1) dupes += group.length - 1;
  }
  return dupes;
}

function getExportName(mimeType: string, name: string): string {
  const exportMap: Record<string, string> = {
    'application/vnd.google-apps.document': 'document.pdf',
    'application/vnd.google-apps.spreadsheet': 'spreadsheet.xlsx',
    'application/vnd.google-apps.presentation': 'presentation.pdf',
    'application/vnd.google-apps.drawing': 'drawing.png',
    'application/vnd.google-apps.script': 'script.json',
  };
  return exportMap[mimeType] || name;
}

// Space-saving suggestions engine
export interface SpaceSuggestion {
  id: string;
  type: 'empty_trash' | 'large_files' | 'duplicates' | 'old_files' | 'google_docs_export' | 'heavy_folders';
  title: string;
  description: string;
  potentialSavings: number;
  potentialSavingsFormatted: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  fileIds: string[];
  actionable: boolean;
}

export function generateSuggestions(files: DriveFile[], stats: DriveStats): SpaceSuggestion[] {
  const suggestions: SpaceSuggestion[] = [];
  const trashedFiles = files.filter(f => f.trashed);

  // 1. Empty trash
  if (stats.trashedFiles > 0) {
    suggestions.push({
      id: 'empty_trash',
      type: 'empty_trash',
      title: 'Empty Trash',
      description: `You have ${stats.trashedFiles} file${stats.trashedFiles !== 1 ? 's' : ''} in trash (${stats.trashedSizeFormatted}). Permanently delete them to free up space.`,
      potentialSavings: stats.trashedSize,
      potentialSavingsFormatted: stats.trashedSizeFormatted,
      severity: stats.trashedSize > 5 * 1024 * 1024 * 1024 ? 'critical' : stats.trashedSize > 1 * 1024 * 1024 * 1024 ? 'high' : 'medium',
      fileIds: trashedFiles.map(f => f.id),
      actionable: true,
    });
  }

  // 2. Large files
  const largeFiles = files.filter(f => !f.trashed && f.size >= LARGE_FILE_THRESHOLD).sort((a, b) => b.size - a.size);
  if (largeFiles.length > 0) {
    const totalLarge = largeFiles.reduce((s, f) => s + f.size, 0);
    suggestions.push({
      id: 'large_files',
      type: 'large_files',
      title: `${largeFiles.length} Large File${largeFiles.length !== 1 ? 's' : ''} (>100 MB)`,
      description: `Review these large files taking up ${formatBytes(totalLarge)}. Consider downloading locally and removing from Drive.`,
      potentialSavings: totalLarge,
      potentialSavingsFormatted: formatBytes(totalLarge),
      severity: totalLarge > 5 * 1024 * 1024 * 1024 ? 'critical' : 'high',
      fileIds: largeFiles.map(f => f.id),
      actionable: true,
    });
  }

  // 3. Duplicates
  const dupGroups = findDuplicateGroups(files);
  const dupeFiles = dupGroups.flatMap(g => g.slice(1));
  if (dupeFiles.length > 0) {
    const dupeSize = dupeFiles.reduce((s, f) => s + f.size, 0);
    suggestions.push({
      id: 'duplicates',
      type: 'duplicates',
      title: `${dupeFiles.length} Potential Duplicate${dupeFiles.length !== 1 ? 's' : ''}`,
      description: `Found ${dupGroups.length} group${dupGroups.length !== 1 ? 's' : ''} of files with identical names and sizes. You could save ${formatBytes(dupeSize)} by removing duplicates.`,
      potentialSavings: dupeSize,
      potentialSavingsFormatted: formatBytes(dupeSize),
      severity: dupeSize > 500 * 1024 * 1024 ? 'high' : 'medium',
      fileIds: dupeFiles.map(f => f.id),
      actionable: true,
    });
  }

  // 4. Old unused files (>2 years, not modified)
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const oldFiles = files.filter(f => !f.trashed && f.mimeType !== 'application/vnd.google-apps.folder' && new Date(f.modifiedTime) < twoYearsAgo);
  if (oldFiles.length > 0) {
    const oldSize = oldFiles.reduce((s, f) => s + f.size, 0);
    suggestions.push({
      id: 'old_files',
      type: 'old_files',
      title: `${oldFiles.length} Old File${oldFiles.length !== 1 ? 's' : ''} (>2 years)`,
      description: `These files haven't been modified in over 2 years (${formatBytes(oldSize)} total). Consider archiving or removing them.`,
      potentialSavings: oldSize,
      potentialSavingsFormatted: formatBytes(oldSize),
      severity: oldSize > 2 * 1024 * 1024 * 1024 ? 'high' : 'low',
      fileIds: oldFiles.map(f => f.id),
      actionable: true,
    });
  }

  // 5. Google Docs export suggestion
  const googleDocs = files.filter(f => !f.trashed && f.mimeType.startsWith('application/vnd.google-apps.'));
  if (googleDocs.length > 50) {
    suggestions.push({
      id: 'google_docs_export',
      type: 'google_docs_export',
      title: `${googleDocs.length} Google Docs/Sheets/Slides`,
      description: 'You have many Google-native documents. Consider exporting unused ones to local files for backup and freeing cloud storage.',
      potentialSavings: 0,
      potentialSavingsFormatted: 'N/A',
      severity: 'low',
      fileIds: [],
      actionable: false,
    });
  }

  return suggestions.sort((a, b) => b.potentialSavings - a.potentialSavings);
}

function findDuplicateGroups(files: DriveFile[]): DriveFile[][] {
  const groups = new Map<string, DriveFile[]>();
  for (const f of files) {
    if (f.trashed) continue;
    const key = `${f.name.toLowerCase()}|${f.size}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  return Array.from(groups.values()).filter(g => g.length > 1);
}

// Download a file from Drive
export async function downloadDriveFile(accountId: string, fileId: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  const { accessToken, refreshToken } = await getValidTokens(accountId);
  const drive = google.drive({ version: 'v3', auth: getOAuthClient(accessToken, refreshToken) });

  // Get file metadata
  const metadata = await drive.files.get({ fileId, fields: 'id, name, mimeType, exportMimes' });

  const mimeTypes = (metadata.data.exportMimes as string[]) || [];
  let exportMime: string | undefined;
  let fileName = metadata.data.name || 'download';

  // For Google Docs, export to a standard format
  const exportMap: Record<string, string> = {
    'application/vnd.google-apps.document': 'application/pdf',
    'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.google-apps.presentation': 'application/pdf',
    'application/vnd.google-apps.drawing': 'image/png',
  };

  if (exportMap[metadata.data.mimeType || '']) {
    exportMime = exportMap[metadata.data.mimeType!];
    const extMap: Record<string, string> = {
      'application/pdf': '.pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'image/png': '.png',
    };
    if (extMap[exportMime]) fileName += extMap[exportMime];
  }

  let response: { data: unknown };

  if (exportMime) {
    response = await drive.files.export({ fileId, mimeType: exportMime, responseType: 'arraybuffer' });
  } else {
    response = await drive.files.get({ fileId, alt: 'media', responseType: 'arraybuffer' });
  }

  const buffer = Buffer.from(response.data as ArrayBuffer, 'binary');
  return { buffer, fileName, mimeType: exportMime || metadata.data.mimeType || 'application/octet-stream' };
}

// Delete files from Drive (move to trash or permanently delete)
export async function deleteDriveFiles(accountId: string, fileIds: string[], permanent: boolean = false): Promise<{ success: number; failed: number }> {
  const { accessToken, refreshToken } = await getValidTokens(accountId);
  const drive = google.drive({ version: 'v3', auth: getOAuthClient(accessToken, refreshToken) });

  let success = 0;
  let failed = 0;

  for (const fileId of fileIds) {
    try {
      await drive.files.update({
        fileId,
        requestBody: { trashed: true },
        ...(permanent ? { supportsAllDrives: true } : {}),
      });
      if (permanent) {
        await drive.files.delete({ fileId, supportsAllDrives: true });
      }
      success++;
    } catch {
      failed++;
    }
  }

  return { success, failed };
}
