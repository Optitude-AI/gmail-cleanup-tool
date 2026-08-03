import { NextRequest, NextResponse } from 'next/server';

/** Routes that don't require authentication (public endpoints) */
const PUBLIC_PATHS = [
  '/api/gmail/auth',
  '/api/gmail/callback',
  '/api/gmail/status',
];

/** Routes that return binary data (skip JSON middleware processing) */
const BINARY_PATHS = [
  '/api/drive/download',
  '/api/photos/download',
  '/api/backup/create',
];

/**
 * Next.js middleware — runs on every request.
 * Enforces authentication on API routes (except public ones),
 * adds security headers, and rejects malformed requests.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only process /api/ routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip public endpoints
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return addSecurityHeaders(request, NextResponse.next());
  }

  // Skip binary download endpoints for content checks
  if (BINARY_PATHS.some(p => pathname.startsWith(p))) {
    return addSecurityHeaders(request, NextResponse.next());
  }

  // Enforce JSON content-type on POST/PUT/PATCH requests with body
  const method = request.method;
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 415 },
      );
    }
  }

  return addSecurityHeaders(request, NextResponse.next());
}

/** Attach common security headers to the response */
function addSecurityHeaders(request: NextRequest, response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Timing-Allow-Origin', '*');
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
