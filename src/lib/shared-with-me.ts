import { google } from 'googleapis';
import { getValidTokens, getOAuthClient } from '@/lib/google-auth';

interface SharedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  ownerEmail: string;
  modifiedTime: string;
  webViewLink: string;
  lastAccessedDays: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export async function findStaleSharedFiles(
  accountId: string,
  daysThreshold: number = 90
): Promise<SharedFile[]> {
  const { accessToken, refreshToken } = await getValidTokens(accountId);
  const oauth2Client = getOAuthClient(accessToken, refreshToken);

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

  const res = await drive.files.list({
    q: 'sharedWithMe',
    fields:
      'files(id, name, mimeType, size, owners, modifiedTime, webViewLink)',
    corpora: 'user',
    pageSize: 200,
    orderBy: 'modifiedTime',
  });

  const files = res.data.files || [];
  const now = new Date();

  const staleFiles: SharedFile[] = files
    .filter((file) => {
      const modifiedTime = new Date(file.modifiedTime!);
      return modifiedTime < cutoffDate;
    })
    .map((file) => {
      const modifiedTime = new Date(file.modifiedTime!);
      const diffMs = now.getTime() - modifiedTime.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      return {
        id: file.id!,
        name: file.name || 'Unnamed',
        mimeType: file.mimeType || 'unknown',
        size: file.size ? parseInt(file.size, 10) : 0,
        ownerEmail: file.owners?.[0]?.emailAddress || 'unknown',
        modifiedTime: file.modifiedTime || '',
        webViewLink: file.webViewLink || '',
        lastAccessedDays: diffDays,
      };
    });

  // Sort by size descending (largest first)
  staleFiles.sort((a, b) => b.size - a.size);

  return staleFiles.slice(0, 200);
}
