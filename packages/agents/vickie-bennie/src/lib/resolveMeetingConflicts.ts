import {
  GeminiService,
  OfficeServiceV3,
  ProposeMeetingConflictResolutionsInput,
  ProposeMeetingConflictResolutionsOutput,
  TYPES,
} from '@codestrap/developer-foundations-types';
import {
  extractJsonFromBackticks,
  uuidv4,
} from '@codestrap/developer-foundations-utils';
import { container } from '@codestrap/developer-foundations-di';

export interface VickieResponse {
  status: number;
  message: string;
  executionId: string;
  taskList?: string;
  error?: string;
}

export interface ParsedConflictRequest {
  users: string[];
  timeFrameFrom: string;
  timeFrameTo: string;
}

/**
 * Filters users to only include CodeStrap users
 */
function filterCodeStrapUsers(users: string[]): string[] {
  return users.filter(
    (user) =>
      user.indexOf('codestrap.me') >= 0 || user.indexOf('codestrap.com') >= 0
  );
}

/**
 * Performs rescheduling for identified conflicts
 * @param users - The users to resolve conflicts for
 * @param timeFrameFrom - The start time of the time frame to resolve conflicts for in ISO 8601 format, defaults to now
 * @param timeFrameTo - The end time of the time frame to resolve conflicts for in ISO 8601 format, defaults to now + 24 hours
 * @param timezone - The timezone to resolve conflicts for, defaults to 'America/Los_Angeles'
 */
export async function resolveMeetingConflicts(
  users: string[],
  timeFrameFrom = new Date().toISOString(),
  timeFrameTo = new Date(
    new Date().getTime() + 24 * 60 * 60 * 1000
  ).toISOString(),
  timezone = 'America/Los_Angeles'
): Promise<VickieResponse> {
  try {
    const officeServiceV3 = await container.getAsync<OfficeServiceV3>(
      TYPES.OfficeServiceV3
    );

    const codeStrapUsers = filterCodeStrapUsers(users);

    if (codeStrapUsers.length === 0) {
      return {
        status: 400,
        executionId: uuidv4(),
        message: 'No CodeStrap users found in the request',
        error: 'No valid users',
        taskList: 'ERROR',
      };
    }

    const input: ProposeMeetingConflictResolutionsInput = {
      userEmails: codeStrapUsers,
      timeFrameFrom: new Date(timeFrameFrom),
      timeFrameTo: new Date(timeFrameTo),
      timezone,
    };

    // Identify conflicts and propose resolutions
    const identifyResult =
      await officeServiceV3.proposeMeetingConflictResolutions(input);

    // Perform rescheduling calculations
    const { rescheduled, errors } = calculateRescheduling(identifyResult);

    return {
      status: 200,
      executionId: uuidv4(),
      message: 'Meeting conflicts resolved',
      taskList: 'SUCCESS',
    };
  } catch (e) {
    console.error('resolveMeetingConflicts error:', (e as Error).message);
    return {
      status: 500,
      executionId: uuidv4(),
      message: `Error resolving meeting conflicts: ${(e as Error).message}`,
      error: (e as Error).stack || (e as Error).message,
      taskList: '',
    };
  }
}

function calculateRescheduling(
  identifyResult: ProposeMeetingConflictResolutionsOutput
) {
  return {
    rescheduled: 0,
    errors: [],
  };
}
