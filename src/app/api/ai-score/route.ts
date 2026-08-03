import { NextRequest } from 'next/server';
import { scoreEmailImportance, scoreFileImportance } from '@/lib/ai-scoring';
import { validateBody, aiScoreSchema } from '@/lib/validations';
import { ok, err, validationErr } from '@/lib/api-response';

interface ScoreableItem {
  id: string;
  service: 'gmail' | 'drive' | 'photos';
  name?: string;
  fileName?: string;
  size?: number;
  fileSize?: number;
  mimeType?: string;
  senderEmail?: string;
  senderName?: string;
  subject?: string;
  category?: string;
  emailCount?: number;
  lastReceived?: string;
  createdAt?: string;
  modifiedTime?: string;
  trashed?: boolean;
}

interface ScoredItem extends ScoreableItem {
  importanceScore: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, error } = validateBody(aiScoreSchema, body);
    if (error) {
      return validationErr(error.message);
    }
    const items = data.items as ScoreableItem[];

    const scored: ScoredItem[] = items.map((item) => {
      const score = item.senderEmail
        ? scoreEmailImportance({ senderEmail: item.senderEmail, senderName: item.senderName, subject: item.subject, category: item.category, emailCount: item.emailCount || 1, lastReceived: item.lastReceived })
        : scoreFileImportance({ fileName: item.name || item.fileName, mimeType: item.mimeType, fileSize: item.size || item.fileSize || 0, createdTime: item.createdAt || '', modifiedTime: item.modifiedTime || '', trashed: item.trashed || false });
      return { ...item, importanceScore: score };
    });

    scored.sort((a, b) => a.importanceScore - b.importanceScore);
    return ok({ scored });
  } catch (error: unknown) {
    console.error('Scoring error:', error);
    return err('Operation failed. Please try again.');
  }
}
