/**
 * GSuite Client V3 (Template Example)
 * -----------------------------------
 * Pattern: Extend the previous client (V2) by:
 *   1) Importing and composing with makeGSuiteClientV2 (object spread).
 *   2) Defining additional OAuth scopes (Drive/Calendar/Gmail).
 *   3) Creating additional Google SDK clients (drive, calendar, gmail).
 *   4) Adding new capabilities that call delegates (encapsulate business logic).
 *
 * NOTE TO MODEL/HUMANS:
 * - For a new version, copy this file and:
 *     - Replace all occurrences of "V3" with "V__NEW_VERSION__".
 *     - Replace "OfficeServiceV3" with "OfficeServiceV__NEW_VERSION__".
 *     - Replace the imported "makeGSuiteClientV2" with "makeGSuiteClientV__PREV_VERSION__".
 * - Keep the *extension by de-structuring* pattern so older API remains compatible.
 * - keep the comments to call delegates but return the required types using placeholder (emptry strings/arrays)
 */

import {
  MeetingRequest,
  OfficeServiceV2,
  Summaries,
  DriveSearchParams,
  DriveSearchOutput,
} from '@codestrap/developer-foundations-types';

import { makeGSuiteClient as makeGSuiteClientV1 } from '@codestrap/developer-foundations-services-google';
import { makeGSuiteClientV2 } from '@codestrap/developer-foundations-services-google';

import { wallClockToUTC, workingHoursUTCForDate } from '@codestrap/developer-foundations-utils';
import { google } from 'googleapis';
import { loadServiceAccountFromEnv, makeGoogleAuth } from '@codestrap/developer-foundations-services-google/src/lib/helpers/googleAuth';

/**
 * OfficeServiceV3
 * ---------------
 * Teach the *extension pattern*: start from OfficeServiceV2, then add any new V3 methods.
 * For future versions: `export type OfficeServiceV__NEW_VERSION__ = OfficeServiceV__PREV_VERSION__ & {...}`
 */
export type OfficeServiceV3 = OfficeServiceV2 & {
  // Illustrative new capabilities for V3:
  listDriveSharedDrives?: (args?: { pageSize?: number; pageToken?: string }) => Promise<{
    message: string;
    drives: Array<{ id?: string; name?: string }>;
    nextPageToken?: string;
  }>;

  listCalendarLists?: (args?: { minAccessRole?: 'reader' | 'writer' | 'owner' }) => Promise<{
    message: string;
    calendars: Array<{ id?: string; summary?: string }>;
  }>;

  listGmailLabels?: (args?: { user?: string }) => Promise<{
    message: string;
    labels: Array<{ id?: string; name?: string }>;
  }>;
};

/**
 * makeGSuiteClientV3
 * ------------------
 * Extends V2 by adding scopes + clients + methods. The V1 client remains accessible
 * through V2’s spread (since V2 spreads V1). Keep *all lower-version methods* intact.
 */
export async function makeGSuiteClientV3(user: string): Promise<OfficeServiceV3> {
  // Compose with previous client version (V2).
  const v2Client = await makeGSuiteClientV2(user);

  // Load service account credentials once.
  const credentials = await loadServiceAccountFromEnv();

  /**
   * New/Additional Scopes for V3
   * ----------------------------
   * Demonstrate how to add scopes across Drive/Calendar/Gmail.
   * For new versions: add/remove scopes based on required capabilities.
   * Only add scopes for the required features
   * The scopes below are purely notional based on a specification that qould require them
   * Think carefully and perform a web search to verify the scope URIs needed.
   * Do not blindly copy the scopes below, reason about what scopes are actually required!
   */
  const driveScopes = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    // V3 adds: ability to list shared drives and changes
    'https://www.googleapis.com/auth/drive',
  ];

  const calendarScopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.freebusy',
    // V3 adds: calendar management
    'https://www.googleapis.com/auth/calendar',
  ];

  const gmailScopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.metadata',
    // V3 adds: labels and modify
    'https://www.googleapis.com/auth/gmail.modify',
  ];

  // Create auth clients
  /**
   * Google Auth Clients
   * ---------------------
   * Create separate auth clients per service with the appropriate scopes.
   * This keeps the principle of least privilege per service.
   * Only add clients for the services you need!
   */
  const driveAuth = makeGoogleAuth(credentials, driveScopes, user);
  const calendarAuth = makeGoogleAuth(credentials, calendarScopes, user);
  const gmailAuth = makeGoogleAuth(credentials, gmailScopes, user);

  // Instantiate Google SDK clients
  const driveClient = google.drive({ version: 'v3', auth: driveAuth });
  const calendarClient = google.calendar({ version: 'v3', auth: calendarAuth });
  const gmailClient = google.gmail({ version: 'v1', auth: gmailAuth });

  /**
   * Return the extended client
   * --------------------------
   * - Keep the spread of v2Client so all existing methods remain.
   * - Add/override properties to form the V3 capabilities.
   */
  const v3: OfficeServiceV3 = {
    ...v2Client,
    /**
     * V3: New capabilities (examples)
     * Keep these thin and delegate the business logic to dedicated modules.
     */
    /**
     * Delegates
     * ---------
     * - Add comments for calls to delegates: business logic lives in delegate modules. A human will add those later
     * - Be sure to return the correc types as per the OfficeServiceV__NEW_VERSION__ definitions you generated.
     */
    // Example: list shared drives
    listDriveSharedDrives: async (args = {}) => {
      // TODO call the delegate passing the params including the new driveClient client with the new scopes
      return { message: '', drives: [{ id: '', name: '' }], nextPageToken: '' }
    },

    // Example: list calendars for the authenticated user
    listCalendarLists: async (args = {}) => {
      // TODO call the delegate passing the params including the new calendarClient client with the new scopes
      return { message: '', calendars: [{ id:'', summary: '' }] }
    },

    // Example: list Gmail labels for the user
    listGmailLabels: async (args = {}) => {
      // TODO call the delegate passing the params including the new gmailClient with the new scopes
      return { message: '', labels: [{ id: '', name: ''}] }
    },

    // Overwrite getters for the underlying SDK clients if needed by delegates/consumers:
    getDriveClient: () => driveClient,
    getEmailClient: () => gmailClient,
    getCalendarClient: () => calendarClient,
  };

  return v3;
}

/**
 * HOW TO ADAPT THIS TEMPLATE FOR FUTURE VERSIONS
 * ----------------------------------------------
 * - Rename: makeGSuiteClientV3 -> makeGSuiteClientV__NEW_VERSION__
 * - Type:   OfficeServiceV3     -> OfficeServiceV__NEW_VERSION__
 * - Base:   makeGSuiteClientV2  -> makeGSuiteClientV__PREV_VERSION__
 * - Scopes: Adjust/add/remove scopes as needed for the new features.
 * - Clients: Instantiate additional google.* clients as needed (e.g., admin, sheets, etc.).
 * - Delegates: Keep business logic in delegates; wire them here with thin wrappers.
 * - Return: Spread the previous client, then add/override capabilities.
 */
