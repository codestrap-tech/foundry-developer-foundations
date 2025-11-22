import { google } from 'googleapis';
import { Buffer } from 'buffer';
import type { ServiceAccountCredentials } from '@codestrap/developer-foundations-types';

export async function loadServiceAccountFromEnv(): Promise<ServiceAccountCredentials> {
  if (!process.env['GSUITE_SERVICE_ACCOUNT']) {
    throw new Error('GSUITE_SERVICE_ACCOUNT environment variable not set');
  }

  const jsonString = Buffer.from(
    process.env['GSUITE_SERVICE_ACCOUNT'],
    'base64',
  ).toString('utf8');
  const credentials = JSON.parse(jsonString) as ServiceAccountCredentials;

  console.log('✅ Service account file loaded successfully');
  return credentials;
}

export function makeGoogleAuth(
  credentials: ServiceAccountCredentials,
  scopes: string[],
  user: string,
) {
  return new google.auth.GoogleAuth({
    credentials,
    scopes,
    clientOptions: { subject: user },
  });
}
