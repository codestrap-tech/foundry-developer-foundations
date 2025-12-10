import { NextResponse } from 'next/server';

/**
 * POST /api/logout
 * Clears the userId cookie to log the user out.
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('userId');
  return response;
}

/**
 * GET /api/logout
 * Alternative method - redirects to home after clearing cookie.
 */
export async function GET() {
  const response = NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'));
  response.cookies.delete('userId');
  return response;
}

