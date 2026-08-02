import { NextRequest, NextResponse } from 'next/server';
import { scoreEmailImportance, scoreFileImportance } from '@/lib/ai-scoring';

export async function POST(request: NextRequest) {
  try {
    const { items } = await request.json();
    if (!items?.length) return NextResponse.json({ error: 'Items required' }, { status: 400 });

    const scored = items.map((item: any) => {
      const score = item.senderEmail
        ? scoreEmailImportance({ senderEmail: item.senderEmail, senderName: item.senderName, subject: item.subject, category: item.category, emailCount: item.emailCount || 1, lastReceived: item.lastReceived })
        : scoreFileImportance({ fileName: item.name || item.fileName, mimeType: item.mimeType, fileSize: item.size || item.fileSize || 0, createdTime: item.createdTime || '', modifiedTime: item.modifiedTime || '', trashed: item.trashed || false });
      return { ...item, importanceScore: score };
    });

    scored.sort((a: any, b: any) => a.importanceScore - b.importanceScore);
    return NextResponse.json({ success: true, scored });
  } catch (error: any) {
    return NextResponse.json({ error: 'Scoring failed', details: error.message }, { status: 500 });
  }
}
