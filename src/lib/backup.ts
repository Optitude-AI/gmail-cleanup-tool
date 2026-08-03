import archiver, { ZipArchive } from 'archiver';
import { PassThrough } from 'stream';
import { google } from 'googleapis';
import { getValidTokens, getOAuthClient } from '@/lib/google-auth';

export interface BackupItem {
  fileId: string;
  fileName: string;
  service: 'drive' | 'photos';
  baseUrl?: string;
}

/**
 * Downloads a single file from Google Drive or Photos for archiving.
 * Returns the file content as a Buffer, or null if the download fails.
 */
export async function downloadAndArchiveFile(
  accountId: string,
  fileId: string,
  fileName: string,
  service: 'drive' | 'photos',
  baseUrl?: string,
): Promise<Buffer | null> {
  try {
    const { accessToken, refreshToken } = await getValidTokens(accountId);
    const oauth2Client = getOAuthClient(accessToken, refreshToken);

    if (service === 'drive') {
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      // Check if it's a Google Docs-type file that needs export
      const metadata = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType',
      });

      const mimeType = metadata.data.mimeType || '';
      const googleDocMimeTypes: Record<string, string> = {
        'application/vnd.google-apps.document': 'application/pdf',
        'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.google-apps.presentation': 'application/pdf',
        'application/vnd.google-apps.drawing': 'image/png',
      };

      if (googleDocMimeTypes[mimeType]) {
        // For Google docs, export to a standard format (e.g. PDF)
        const exportMime = googleDocMimeTypes[mimeType];
        const response = await drive.files.export({
          fileId,
          mimeType: exportMime,
          responseType: 'arraybuffer',
        });
        return Buffer.from(response.data as ArrayBuffer, 'binary');
      }

      // For regular files, download directly
      const response = await drive.files.get({
        fileId,
        alt: 'media',
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data as ArrayBuffer, 'binary');
    }

    if (service === 'photos') {
      const url = baseUrl
        ? `${baseUrl}=d`
        : `https://photoslibrary.googleapis.com/v1/mediaItems/${fileId}:download`;

      const response = await fetch(url, {
        headers: baseUrl
          ? {}
          : { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        console.error(
          `Failed to download photo ${fileId}: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      return Buffer.from(await response.arrayBuffer());
    }

    return null;
  } catch (error) {
    console.error(
      `Error downloading file ${fileName} (${service}:${fileId}):`,
      error,
    );
    return null;
  }
}

/**
 * Creates a ZIP archive in memory containing all specified backup items.
 * Each item is downloaded from the appropriate Google service and added to the archive.
 * Returns the complete ZIP file as a Buffer.
 */
export async function createBackupArchive(
  accountId: string,
  items: BackupItem[],
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const archive = new ZipArchive({
      zlib: { level: 6 }, // Balanced compression level
    });

    // Collect archive output into a single buffer
    const passThrough = new PassThrough();
    const chunks: Buffer[] = [];

    passThrough.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    passThrough.on('end', () => {
      const finalBuffer = Buffer.concat(chunks);
      resolve(finalBuffer);
    });

    passThrough.on('error', (err: Error) => {
      reject(err);
    });

    archive.on('error', (err: Error) => {
      reject(err);
    });

    // Pipe archive output through PassThrough for collection
    archive.pipe(passThrough);

    // Process items sequentially to avoid rate limiting
    const processItems = async () => {
      for (const item of items) {
        try {
          const buffer = await downloadAndArchiveFile(
            accountId,
            item.fileId,
            item.fileName,
            item.service,
            item.baseUrl,
          );

          if (buffer && buffer.length > 0) {
            // Sanitize filename to prevent path traversal
            const safeName = item.fileName
              .replace(/[^a-zA-Z0-9._-]/g, '_')
              .replace(/^\.+/, '');
            archive.append(buffer, { name: safeName });
          } else {
            // Add a placeholder text file for failed downloads
            const placeholder = Buffer.from(
              `Backup of "${item.fileName}" could not be downloaded.\n` +
                `Service: ${item.service}\n` +
                `File ID: ${item.fileId}\n` +
                `Please download this file manually from Google ${
                  item.service === 'drive' ? 'Drive' : 'Photos'
                }.\n`,
            );
            const placeholderName = `FAILED_${item.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}.txt`;
            archive.append(placeholder, { name: placeholderName });
          }
        } catch (error) {
          console.error(
            `Error archiving item ${item.fileName}:`,
            error,
          );
          // Skip failed items but continue with others
        }
      }

      // Finalize the archive after all items are appended
      try {
        await archive.finalize();
      } catch (err) {
        reject(err);
      }
    };

    processItems().catch(reject);
  });
}
