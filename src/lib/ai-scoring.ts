/**
 * AI Importance Scoring Module
 *
 * Provides heuristic-based importance scoring for emails and files.
 * Structured so the heuristic functions can be swapped with real LLM calls
 * in the future by replacing the internal scoring logic while keeping
 * the same public interface.
 */

// ---------------------------------------------------------------------------
// Email scoring
// ---------------------------------------------------------------------------

const TRANSACTIONAL_KEYWORDS = [
  'receipt',
  'invoice',
  'order',
  'payment',
  'confirmation',
];

const NO_REPLY_PATTERNS = [
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'mailer',
  'notifications',
];

/**
 * Score an email's importance on a 0-100 scale using heuristic rules.
 *
 * Rules:
 *  - Transactional / receipt emails:       +40
 *  - Personal contacts (not noreply):       +20
 *  - Recent (last 30 days):                 +15
 *  - Many emails from same sender (>10):    +10
 *  - Junk / promo category:                 -30
 *  - Unsubscribe available (marketing):     -10
 *
 * Result is clamped to [0, 100].
 */
export function scoreEmailImportance(email: {
  senderEmail: string;
  senderName: string | null;
  subject: string | null;
  category: string;
  emailCount: number;
  lastReceived: string | null;
}): number {
  let score = 50; // baseline

  // --- Transactional / receipt detection (+40) ---
  const subjectLower = (email.subject ?? '').toLowerCase();
  const senderLower = email.senderEmail.toLowerCase();

  if (
    TRANSACTIONAL_KEYWORDS.some((kw) => subjectLower.includes(kw)) ||
    TRANSACTIONAL_KEYWORDS.some((kw) => senderLower.includes(kw))
  ) {
    score += 40;
  }

  // --- Personal contacts — not a noreply address (+20) ---
  const localPart = email.senderEmail.split('@')[0]?.toLowerCase() ?? '';
  const isNoReply = NO_REPLY_PATTERNS.some((pat) => localPart.includes(pat));

  if (!isNoReply) {
    score += 20;
  }

  // --- Recent — received within last 30 days (+15) ---
  if (email.lastReceived) {
    const lastReceived = new Date(email.lastReceived).getTime();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    if (lastReceived >= thirtyDaysAgo) {
      score += 15;
    }
  }

  // --- Volume from same sender > 10 emails (+10) ---
  if (email.emailCount > 10) {
    score += 10;
  }

  // --- Junk / promo category (-30) ---
  const categoryLower = email.category.toLowerCase();
  if (categoryLower === 'junk' || categoryLower === 'spam') {
    score -= 30;
  } else if (categoryLower === 'promotions' || categoryLower === 'promo') {
    score -= 30;
  }

  // --- Unsubscribe available — likely marketing (-10) ---
  // This is determined by the caller; we'd need the unsubscribeUrl
  // passed in. Since the ScanResult model has this field, callers
  // should pass it. For now we don't have it in this interface, but
  // we handle it by accepting an optional field via the caller.
  // The scoring logic lives here so the caller passes `hasUnsubscribe`.

  // Clamp to [0, 100]
  return Math.max(0, Math.min(100, score));
}

/**
 * Extended version that also accepts an `unsubscribeUrl` to apply the -10 penalty.
 */
export function scoreEmailImportanceWithUnsubscribe(
  email: {
    senderEmail: string;
    senderName: string | null;
    subject: string | null;
    category: string;
    emailCount: number;
    lastReceived: string | null;
  } & { unsubscribeUrl: string | null },
): number {
  const base = scoreEmailImportance(email);

  if (email.unsubscribeUrl) {
    return Math.max(0, Math.min(100, base - 10));
  }

  return base;
}

// ---------------------------------------------------------------------------
// File scoring
// ---------------------------------------------------------------------------

const DOCUMENT_EXTENSIONS = ['doc', 'docx', 'pdf', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'rtf'];
const ARCHIVE_EXTENSIONS = ['zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif'];

/**
 * Score a file's importance on a 0-100 scale using heuristic rules.
 *
 * Rules:
 *  - Documents (doc, pdf, xlsx, …):        +30
 *  - Trashed:                               -50
 *  - Modified recently (30 days):           +15
 *  - Created recently (30 days):            +10
 *  - Very large (>500 MB, archive candidate): -5
 *  - Archives (zip, tar, …):                +5
 *  - Images:                                +5
 *
 * Result is clamped to [0, 100].
 */
export function scoreFileImportance(file: {
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdTime: string;
  modifiedTime: string;
  trashed: boolean;
}): number {
  let score = 50; // baseline

  const nameLower = file.fileName.toLowerCase();
  const mimeLower = file.mimeType.toLowerCase();

  // Extract file extension from fileName
  const ext = nameLower.includes('.')
    ? nameLower.split('.').pop() ?? ''
    : '';

  // --- Documents (+30) ---
  if (
    DOCUMENT_EXTENSIONS.includes(ext) ||
    mimeLower.includes('document') ||
    mimeLower.includes('pdf') ||
    mimeLower.includes('spreadsheet') ||
    mimeLower.includes('presentation')
  ) {
    score += 30;
  }

  // --- Trashed (-50) ---
  if (file.trashed) {
    score -= 50;
  }

  // --- Modified recently within 30 days (+15) ---
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  if (file.modifiedTime) {
    const modified = new Date(file.modifiedTime).getTime();
    if (modified >= thirtyDaysAgo) {
      score += 15;
    }
  }

  // --- Created recently within 30 days (+10) ---
  if (file.createdTime) {
    const created = new Date(file.createdTime).getTime();
    if (created >= thirtyDaysAgo) {
      score += 10;
    }
  }

  // --- Very large files > 500 MB — archive candidate (-5) ---
  const FIVE_HUNDRED_MB = 500 * 1024 * 1024;
  if (file.fileSize > FIVE_HUNDRED_MB) {
    score -= 5;
  }

  // --- Archives (+5) ---
  if (
    ARCHIVE_EXTENSIONS.includes(ext) ||
    mimeLower.includes('zip') ||
    mimeLower.includes('compressed') ||
    mimeLower.includes('archive')
  ) {
    score += 5;
  }

  // --- Images (+5) ---
  if (
    IMAGE_EXTENSIONS.includes(ext) ||
    mimeLower.startsWith('image/')
  ) {
    score += 5;
  }

  // Clamp to [0, 100]
  return Math.max(0, Math.min(100, score));
}
