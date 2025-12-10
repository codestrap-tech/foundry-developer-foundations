import { NextResponse } from 'next/server';
import { getAuthUrl } from '../../../../lib/google-oauth';

/**
 * GET /api/auth/google
 * Redirects the user to Google OAuth consent screen.
 */
export async function GET() {
  const authUrl = getAuthUrl();
  return NextResponse.redirect(authUrl);
}

