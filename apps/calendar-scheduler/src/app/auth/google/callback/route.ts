import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getUserInfo } from '../../../../lib/google-oauth';
import { saveUserTokens } from '../../../../lib/token-storage';

/**
 * GET /auth/google/callback
 * Handles the OAuth callback from Google.
 * Exchanges the authorization code for tokens and stores them.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(new URL('/?error=oauth_error', request.url));
  }

  if (!code) {
    console.error('No authorization code received');
    return NextResponse.redirect(new URL('/?error=no_code', request.url));
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Missing access_token or refresh_token in response');
    }

    // Get user info to identify the user
    const userInfo = await getUserInfo(tokens.access_token);

    // Save tokens with user information
    await saveUserTokens({
      userId: userInfo.id,
      email: userInfo.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date || undefined,
    });

    console.log(`Successfully authenticated user: ${userInfo.email}`);

    // Set a cookie to track logged-in state and redirect to home
    const response = NextResponse.redirect(new URL('/?success=true', request.url));
    response.cookies.set('userId', userInfo.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Error exchanging code for tokens:', err);
    return NextResponse.redirect(new URL('/?error=token_exchange_failed', request.url));
  }
}

