import { google } from 'googleapis';
import { db } from '@/lib/db';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/photoslibrary.readonly',
];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || '';
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

export async function getTokens(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function exchangeCodeAndUserInfo(code: string) {
  const tokens = await getTokens(code);
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  return {
    tokens,
    email: userInfo.data.email || '',
    name: userInfo.data.name || '',
  };
}

export function getOAuthClient(accessToken: string, refreshToken?: string | null) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken || undefined,
  });
  return oauth2Client;
}

export async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

export async function getValidTokens(accountId: string) {
  const account = await db.gmailAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error('Account not found');

  let accessToken = account.accessToken;
  let refreshToken = account.refreshToken;

  // Refresh if expired
  if (account.tokenExpiry && new Date(account.tokenExpiry) < new Date()) {
    if (refreshToken) {
      const credentials = await refreshAccessToken(refreshToken);
      accessToken = credentials.access_token || accessToken;
      if (credentials.refresh_token) refreshToken = credentials.refresh_token;
      if (credentials.expiry_date) {
        await db.gmailAccount.update({
          where: { id: accountId },
          data: { accessToken, refreshToken, tokenExpiry: new Date(credentials.expiry_date) },
        });
      }
    } else {
      throw new Error('Token expired. Please reconnect.');
    }
  }

  return { accessToken, refreshToken };
}
