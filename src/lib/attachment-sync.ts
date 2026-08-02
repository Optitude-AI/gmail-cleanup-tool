import { google } from 'googleapis';
import { Readable } from 'stream';
import { getValidTokens, getOAuthClient } from '@/lib/google-auth';

interface GmailAttachment {
  messageId: string;
  partId: string;
  fileName: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

interface SyncResult {
  synced: number;
  failed: number;
  totalSize: number;
  totalSizeFormatted: string;
  driveFolderId: string;
  files: { fileName: string; driveFileId: string; size: number }[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

async function downloadAttachment(
  accountId: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const { accessToken, refreshToken } = await getValidTokens(accountId);
  const oauth2Client = getOAuthClient(accessToken, refreshToken);

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const attachment = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });

  return Buffer.from(attachment.data.data, 'base64');
}

export async function findLargeAttachments(
  accountId: string,
  minSizeKB: number = 500
): Promise<GmailAttachment[]> {
  const { accessToken, refreshToken } = await getValidTokens(accountId);
  const oauth2Client = getOAuthClient(accessToken, refreshToken);

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const query = `has:attachment larger:${minSizeKB}k`;

  // First, list messages matching the query
  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 50,
  });

  const messages = listResponse.data.messages || [];
  const attachments: GmailAttachment[] = [];

  for (const msg of messages) {
    if (!msg.id) continue;

    const messageResponse = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'full',
    });

    const payload = messageResponse.data.payload;
    if (!payload) continue;

    // Recursively extract attachments from parts
    const parts = payload.parts || [];
    for (const part of parts) {
      if (part.body?.attachmentId && part.filename) {
        attachments.push({
          messageId: msg.id!,
          partId: part.partId || '',
          fileName: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
          attachmentId: part.body.attachmentId,
        });
      }

      // Check nested parts (e.g., multipart/mixed inside multipart/alternative)
      if (part.parts) {
        for (const nestedPart of part.parts) {
          if (nestedPart.body?.attachmentId && nestedPart.filename) {
            attachments.push({
              messageId: msg.id!,
              partId: nestedPart.partId || '',
              fileName: nestedPart.filename,
              mimeType: nestedPart.mimeType || 'application/octet-stream',
              size: nestedPart.body.size || 0,
              attachmentId: nestedPart.body.attachmentId,
            });
          }
        }
      }
    }
  }

  // Sort by size descending and limit to 50
  attachments.sort((a, b) => b.size - a.size);
  return attachments.slice(0, 50);
}

export async function syncAttachmentsToDrive(
  accountId: string,
  attachments: GmailAttachment[],
  folderName: string = 'Gmail Attachments'
): Promise<SyncResult> {
  const { accessToken, refreshToken } = await getValidTokens(accountId);
  const oauth2Client = getOAuthClient(accessToken, refreshToken);

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  // Find or create the target folder
  const folderSearch = await drive.files.list({
    q: `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
    pageSize: 1,
  });

  let folderId: string;

  if (folderSearch.data.files && folderSearch.data.files.length > 0) {
    folderId = folderSearch.data.files[0].id!;
  } else {
    const folder = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });
    folderId = folder.data.id!;
  }

  const files: SyncResult['files'] = [];
  let synced = 0;
  let failed = 0;
  let totalSize = 0;

  for (const att of attachments) {
    try {
      const buffer = await downloadAttachment(accountId, att.messageId, att.attachmentId);

      const driveFile = await drive.files.create({
        requestBody: {
          name: att.fileName,
          parents: [folderId],
        },
        media: {
          mimeType: att.mimeType,
          body: Readable.from(buffer),
        },
        fields: 'id, name, size',
      });

      files.push({
        fileName: driveFile.data.name || att.fileName,
        driveFileId: driveFile.data.id!,
        size: driveFile.data.size || att.size,
      });

      totalSize += driveFile.data.size || att.size;
      synced++;
    } catch (error) {
      console.error(
        `Failed to sync attachment "${att.fileName}" (message: ${att.messageId}):`,
        error
      );
      failed++;
    }
  }

  return {
    synced,
    failed,
    totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    driveFolderId: folderId,
    files,
  };
}
