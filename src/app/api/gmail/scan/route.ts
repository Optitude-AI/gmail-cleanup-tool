import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scanEmails, refreshAccessToken, type GmailMessage } from '@/lib/gmail';

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await request.json();

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const account = await db.gmailAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    let accessToken = account.accessToken;
    let refreshToken = account.refreshToken;

    // Check if token needs refresh
    if (account.tokenExpiry && new Date(account.tokenExpiry) < new Date()) {
      if (refreshToken) {
        const credentials = await refreshAccessToken(refreshToken);
        accessToken = credentials.access_token || accessToken;
        if (credentials.refresh_token) refreshToken = credentials.refresh_token;
        if (credentials.expiry_date) {
          await db.gmailAccount.update({
            where: { id: accountId },
            data: {
              accessToken,
              refreshToken,
              tokenExpiry: new Date(credentials.expiry_date),
            },
          });
        }
      } else {
        return NextResponse.json({ error: 'Token expired and no refresh token available. Please reconnect.' }, { status: 401 });
      }
    }

    // Scan emails
    const messages = await scanEmails(accessToken, refreshToken);

    // Group by sender and categorize
    const senderGroups = new Map<string, {
      senderEmail: string;
      senderName: string;
      category: string;
      messageIds: string[];
      threadIds: Set<string>;
      subjects: string[];
      dates: string[];
      unsubscribeUrls: string[];
    }>();

    for (const msg of messages) {
      const senderEmail = msg.from.match(/<([^>]+)>/)?.[1] || msg.from;
      const existing = senderGroups.get(senderEmail);

      if (existing) {
        existing.messageIds.push(msg.id);
        existing.threadIds.add(msg.threadId);
        existing.subjects.push(msg.subject);
        existing.dates.push(msg.date);
        existing.unsubscribeUrls.push(...msg.unsubscribeLinks);
      } else {
        senderGroups.set(senderEmail, {
          senderEmail,
          senderName: msg.from.match(/^"?([^"<]+)"?\s*</)?.[1]?.trim() || senderEmail.split('@')[0],
          category: msg.labelIds.includes('SPAM') || msg.labelIds.includes('JUNK') ? 'junk' : 'subscription',
          messageIds: [msg.id],
          threadIds: new Set([msg.threadId]),
          subjects: [msg.subject],
          dates: [msg.date],
          unsubscribeUrls: msg.unsubscribeLinks,
        });
      }
    }

    // Recategorize groups
    const JUNK_KEYWORDS = ['winner', 'congratulations', 'free money', 'click here', 'act now', 'limited time', 'urgent', 'exclusive deal', 'you won', 'prize', 'lottery', 'crypto', 'earn money'];
    const PROMO_KEYWORDS = ['newsletter', 'promo', 'marketing', 'offer', 'deals', 'sale', 'discount', 'coupon', 'noreply', 'no-reply', 'digest', 'weekly', 'updates', 'alerts', 'mailer', 'notification'];

    for (const [, group] of senderGroups) {
      const allText = `${group.senderEmail} ${group.senderName} ${group.subjects.join(' ')}`.toLowerCase();
      
      if (JUNK_KEYWORDS.some(k => allText.includes(k.toLowerCase()))) {
        group.category = 'junk';
      } else if (PROMO_KEYWORDS.some(k => allText.includes(k.toLowerCase()))) {
        group.category = 'subscription';
      } else if (['sale', 'discount', 'off', 'deal', 'clearance', 'shop', 'store', 'order'].some(k => allText.includes(k))) {
        group.category = 'sales';
      }
    }

    // Clear old scan results
    await db.scanResult.deleteMany({ where: { accountId } });

    // Save scan results
    const scanResults = [];
    for (const [, group] of senderGroups) {
      const unsubscribeUrl = group.unsubscribeUrls.find(u => u.startsWith('http')) || null;
      const lastDate = group.dates.sort((a, b) => b.localeCompare(a))[0];

      const result = await db.scanResult.create({
        data: {
          accountId,
          category: group.category,
          senderEmail: group.senderEmail,
          senderName: group.senderName,
          subject: group.subjects[0],
          threadId: [...group.threadIds][0],
          messageIds: JSON.stringify(group.messageIds),
          emailCount: group.messageIds.length,
          lastReceived: lastDate ? new Date(lastDate) : null,
          unsubscribeUrl,
        },
      });

      scanResults.push({
        ...result,
        messageIds: JSON.parse(result.messageIds),
      });
    }

    // Stats
    const stats = {
      total: scanResults.length,
      subscriptions: scanResults.filter(r => r.category === 'subscription').length,
      promotions: scanResults.filter(r => r.category === 'promotion').length,
      sales: scanResults.filter(r => r.category === 'sales').length,
      junk: scanResults.filter(r => r.category === 'junk').length,
      totalEmails: scanResults.reduce((sum, r) => sum + r.emailCount, 0),
      withUnsubscribe: scanResults.filter(r => r.unsubscribeUrl).length,
    };

    return NextResponse.json({
      success: true,
      stats,
      results: scanResults,
    });
  } catch (error: any) {
    console.error('Scan error:', error);
    return NextResponse.json(
      { error: 'Failed to scan emails', details: error.message },
      { status: 500 }
    );
  }
}
