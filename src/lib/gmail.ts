import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || '';

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
  return url;
}

export async function getTokens(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function getGmailClient(accessToken: string, refreshToken?: string | null) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken || undefined,
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  labelIds: string[];
  unsubscribeLinks: string[];
  bodyText?: string;
}

// Known unsubscribe / list-unsubscribe header patterns
const UNSUBSCRIBE_PATTERNS = [
  /<([^>]*(?:unsubscribe|remove|opt.?out|optout|list.?unsubscribe|mailto:\+?unsubscribe)[^>]*)>/gi,
  /https?:\/\/[^\s"'<>]*(?:unsubscribe|remove|opt.?out|optout|unsub)[^\s"'<>]*/gi,
  /mailto:[^\s"'<>]*(?:unsubscribe|remove|opt.?out|optout)[^\s"'<>]*/gi,
];

// Common promotional / marketing sender keywords
const PROMO_KEYWORDS = [
  'newsletter', 'newsletters', 'promo', 'promotion', 'marketing', 'offer', 'offers',
  'deals', 'sale', 'sales', 'discount', 'coupon', 'coupons', 'noreply', 'no-reply',
  'notifications', 'digest', 'weekly', 'monthly', 'updates', 'alerts',
  'donotreply', 'do-not-reply', 'mailer', 'mailers', 'mailing',
];

// Common junk / spam indicator keywords
const JUNK_KEYWORDS = [
  'winner', 'congratulations', 'free money', 'click here', 'act now',
  'limited time', 'urgent', 'exclusive deal', 'you won', 'prize',
  'lottery', 'cash bonus', 'make money', 'crypto', 'bitcoin', 'earn money',
];

function extractSenderEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

function extractSenderName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from.split('@')[0];
}

function extractUnsubscribeLinks(payload: any): string[] {
  const links: string[] = [];

  // Check List-Unsubscribe header
  const headers: Record<string, string> = {};
  if (payload.headers) {
    for (const h of payload.headers) {
      headers[h.name.toLowerCase()] = h.value;
    }
  }

  if (headers['list-unsubscribe']) {
    const value = headers['list-unsubscribe'];
    const bracketLinks = value.match(/<([^>]+)>/g);
    if (bracketLinks) {
      for (const link of bracketLinks) {
        const clean = link.slice(1, -1).trim();
        if (clean.startsWith('http')) links.push(clean);
      }
    }
  }

  // Also search in body for unsubscribe links
  const bodyParts: string[] = [];
  function traverseParts(parts: any[]) {
    if (!parts) return;
    for (const part of parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        bodyParts.push(Buffer.from(part.body.data, 'base64').toString('utf-8'));
      } else if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyParts.push(Buffer.from(part.body.data, 'base64').toString('utf-8'));
      }
      if (part.parts) traverseParts(part.parts);
    }
  }

  traverseParts(payload.parts || []);

  for (const text of bodyParts) {
    for (const pattern of UNSUBSCRIBE_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        for (const m of matches) {
          const clean = m.replace(/^<|>$/g, '').trim();
          if (clean.startsWith('http') && !links.includes(clean)) {
            links.push(clean);
          }
        }
      }
    }
  }

  return [...new Set(links)];
}

function categorizeEmail(from: string, subject: string, snippet: string, labelIds: string[]): string {
  const senderEmail = extractSenderEmail(from).toLowerCase();
  const senderName = extractSenderName(from).toLowerCase();
  const subjectLower = subject.toLowerCase();
  const snippetLower = snippet.toLowerCase();

  // Check Gmail labels first
  if (labelIds.includes('SPAM') || labelIds.includes('JUNK')) return 'junk';

  // Check for junk indicators
  const combinedText = `${subjectLower} ${snippetLower}`;
  for (const keyword of JUNK_KEYWORDS) {
    if (combinedText.includes(keyword.toLowerCase())) return 'junk';
  }

  // Check for promotional / subscription indicators
  for (const keyword of PROMO_KEYWORDS) {
    if (senderEmail.includes(keyword.toLowerCase()) ||
        senderName.includes(keyword.toLowerCase()) ||
        subjectLower.includes(keyword.toLowerCase())) {
      return 'subscription';
    }
  }

  // Check for sales-related
  if (['sale', 'sales', 'discount', 'off!', '% off', 'deal', 'clearance', 'shop', 'store', 'order', 'receipt', 'invoice'].some(k => combinedText.includes(k))) {
    return 'sales';
  }

  // Check if from promotions tab
  if (labelIds.includes('CATEGORY_PROMOTIONS')) return 'promotion';
  if (labelIds.includes('CATEGORY_UPDATES')) return 'subscription';

  return 'subscription';
}

export async function scanEmails(accessToken: string, refreshToken?: string | null, maxResults: number = 100) {
  const gmail = await getGmailClient(accessToken, refreshToken);
  const results: GmailMessage[] = [];

  // Query for promotional, update, and potentially spam emails
  const queries = [
    'category:promotions',
    'category:updates',
    'category:social',
    'in:spam newer_than:30d',
    'is:unread newer_than:60d',
  ];

  const seenIds = new Set<string>();

  for (const query of queries) {
    try {
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: Math.ceil(maxResults / queries.length),
      });

      if (!res.data.messages) continue;

      for (const msg of res.data.messages) {
        if (seenIds.has(msg.id!)) continue;
        seenIds.add(msg.id!);

        try {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date', 'List-Unsubscribe'],
          });

          const headers: Record<string, string> = {};
          if (detail.data.payload?.headers) {
            for (const h of detail.data.payload.headers) {
              headers[h.name.toLowerCase()] = h.value;
            }
          }

          // Get full message for unsubscribe link extraction
          let unsubscribeLinks: string[] = [];
          try {
            const fullDetail = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id!,
              format: 'full',
            });
            if (fullDetail.data.payload) {
              unsubscribeLinks = extractUnsubscribeLinks(fullDetail.data.payload);
            }
          } catch {
            // Fall back to header-only unsubscribe
          }

          const from = headers['from'] || '';
          const category = categorizeEmail(
            from,
            headers['subject'] || '',
            detail.data.snippet || '',
            detail.data.labelIds || []
          );

          results.push({
            id: msg.id!,
            threadId: msg.threadId!,
            from,
            to: headers['to'] || '',
            subject: headers['subject'] || '(No Subject)',
            date: headers['date'] || '',
            snippet: detail.data.snippet || '',
            labelIds: detail.data.labelIds || [],
            unsubscribeLinks,
          });
        } catch {
          // Skip individual message errors
        }
      }
    } catch {
      // Skip query errors (e.g. empty category)
    }
  }

  return results;
}

export async function deleteEmails(accessToken: string, refreshToken: string | null | undefined, messageIds: string[]) {
  const gmail = await getGmailClient(accessToken, refreshToken);
  const results: { success: string[]; failed: string[] } = { success: [], failed: [] };

  // Gmail API allows batch deletion
  for (const id of messageIds) {
    try {
      await gmail.users.messages.delete({
        userId: 'me',
        id,
      });
      results.success.push(id);
    } catch {
      results.failed.push(id);
    }
  }

  return results;
}

export async function bulkDeleteByQuery(accessToken: string, refreshToken: string | null | undefined, queries: string[]) {
  const gmail = await getGmailClient(accessToken, refreshToken);
  let totalDeleted = 0;

  for (const query of queries) {
    try {
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 500,
      });

      if (res.data.messages) {
        const ids = res.data.messages.map(m => m.id!);
        for (const id of ids) {
          try {
            await gmail.users.messages.delete({ userId: 'me', id });
            totalDeleted++;
          } catch {
            // skip
          }
        }
      }
    } catch {
      // skip
    }
  }

  return totalDeleted;
}
