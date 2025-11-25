import type { drive_v3 } from 'googleapis';
import type {
  DriveSearchParams,
  DriveSearchResult,
  DriveFile} from '@codestrap/developer-foundations-types';
import {
  DriveDateField,
} from '@codestrap/developer-foundations-types';

/**
 * Builds a Google Drive search query from the provided parameters
 *
 * Keyword search behavior:
 * - Uses 'name contains' for substring matching anywhere in filename
 * - Case-insensitive search
 * - Multiple keywords are combined with OR logic
 * - Handles special characters and whitespaces properly
 *
 * @param params - The search parameters
 * @returns The constructed Google Drive search query
 */
function buildSearchQuery(params: DriveSearchParams): string {
  const escapeKeywords = (s: string, escapeDot = false) => {
    let out = s
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/\*/g, '\\*')
      .replace(/\?/g, '\\?')
      .replace(/\+/g, '\\+')
      .replace(/\|/g, '\\|')
      .replace(/\^/g, '\\^')
      .replace(/\$/g, '\\$')
      .replace(/!/g, '\\!');
    if (escapeDot) out = out.replace(/\./g, '\\.');
    return out;
  };

  const keywordsClause =
    params.keywords && params.keywords.length > 0
      ? `(${params.keywords
          .map((k) => `name contains '${escapeKeywords(k.trim(), true)}'`)
          .join(' or ')})`
      : undefined;

  const dateRangeField = params.dateRange?.field ?? DriveDateField.MODIFIED_TIME;
  const dateClause =
    params.dateRange?.startDate && params.dateRange?.endDate
      ? `${dateRangeField} >= '${params.dateRange.startDate.toISOString()}' and ${dateRangeField} <= '${params.dateRange.endDate.toISOString()}'`
      : params.dateRange?.startDate
      ? `${dateRangeField} >= '${params.dateRange.startDate.toISOString()}'`
      : params.dateRange?.endDate
      ? `${dateRangeField} <= '${params.dateRange.endDate.toISOString()}'`
      : undefined;

  const mimeClause = params.mimeType?.trim()
    ? `mimeType = '${escapeKeywords(params.mimeType.trim())}'`
    : undefined;

  const ownerClause = params.owner?.trim()
    ? `'${escapeKeywords(params.owner.trim())}' in owners`
    : undefined;

  const sharedClause = params.sharedWithMe ? 'sharedWithMe' : undefined;

  const trashedClause =
    params.trashed !== undefined
      ? `trashed = ${params.trashed}`
      : 'trashed = false';

  const parts = [
    keywordsClause,
    dateClause,
    mimeClause,
    ownerClause,
    sharedClause,
    trashedClause,
  ].filter(Boolean) as string[];

  return parts.join(' and ');
}

/**
 * Converts Google Drive API file response to our simplified DriveFile interface
 * @param driveApiFile - The file object from Google Drive API
 * @returns Converted DriveFile object
 */
function convertDriveFile(driveApiFile: drive_v3.Schema$File): DriveFile {
  return {
    id: driveApiFile.id!,
    name: driveApiFile.name!,
    mimeType: driveApiFile.mimeType!,
    size: driveApiFile.size ?? undefined,
    createdTime: driveApiFile.createdTime ?? undefined,
    modifiedTime: driveApiFile.modifiedTime ?? undefined,
    webViewLink: driveApiFile.webViewLink ?? undefined,
    webContentLink: driveApiFile.webContentLink ?? undefined,
    owners: driveApiFile.owners?.map((owner) => ({
      displayName: owner.displayName ?? undefined,
      emailAddress: owner.emailAddress ?? undefined,
    })),
    lastModifyingUser: driveApiFile.lastModifyingUser
      ? {
          displayName: driveApiFile.lastModifyingUser.displayName ?? undefined,
          emailAddress:
            driveApiFile.lastModifyingUser.emailAddress ?? undefined,
        }
      : undefined,
    parents: driveApiFile.parents ?? undefined,
    description: driveApiFile.description ?? undefined,
    starred: driveApiFile.starred ?? undefined,
    trashed: driveApiFile.trashed ?? undefined,
  };
}

/**
 * Searches for files in Google Drive based on the provided parameters
 * @param driveClient - The Google Drive API client
 * @param params - The search parameters
 * @returns Promise resolving to search results
 */
export async function searchDriveFiles(
  driveClient: drive_v3.Drive,
  params: DriveSearchParams
): Promise<DriveSearchResult> {
  const searchQuery = buildSearchQuery(params);

  const driveApiRequestParams: drive_v3.Params$Resource$Files$List = {
    q: searchQuery,
    pageSize: params.pageSize || 100,
    pageToken: params.pageToken,
    orderBy: params.orderBy || 'modifiedTime desc',
    fields:
      params.fields ||
      'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,owners,lastModifyingUser,parents,description,starred,trashed)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  };

  const driveApiResponse = await driveClient.files.list(driveApiRequestParams);

  const convertedFiles: DriveFile[] = (driveApiResponse.data.files || []).map(
    convertDriveFile
  );

  return {
    files: convertedFiles,
    nextPageToken: driveApiResponse.data.nextPageToken || undefined,
    incompleteSearch: driveApiResponse.data.incompleteSearch || undefined,
  };
}
