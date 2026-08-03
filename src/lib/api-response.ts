import { NextResponse } from 'next/server'

/** Success response helper */
export function ok(data: unknown) {
  return NextResponse.json({ success: true, ...data })
}

/** Error response helper — never leaks internal details */
export function err(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status } as const)
}

/** Validation error */
export function validationErr(message: string) {
  return NextResponse.json({ error: message }, { status: 400 } as const)
}

/** Not found */
export function notFound(message = 'Resource not found') {
  return NextResponse.json({ error: message }, { status: 404 } as const)
}

/** Unauthorized */
export function unauthorized(message = 'Authentication required') {
  return NextResponse.json({ error: message }, { status: 401 } as const)
}
