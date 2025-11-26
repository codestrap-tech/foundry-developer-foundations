# TASK LIST

## TASK 1: Implement Automatic Meeting Conflict Resolution Feature

1. **Client Generation:** Generate a new Google service client named `gsuiteClient.v3`. This client must be an extension of the existing `packages/services/google/src/lib/gsuiteClient.v2.ts` client to follow the CodeStrap pattern of client evolution. Similar as `packages/services/google/src/lib/gsuiteClient.v2.ts` is a extension of `packages/services/google/src/lib/gsuiteClient.ts`.
2. **New Method:** Add a public API method to `gsuiteClient.v3` for the scheduling solution, named `resolveMeetingConflicts`. This function should accept an array of user email addresses as input.
3. **Conflict Resolution Logic:** Inside `resolveMeetingConflicts`, implement the following algorithm:
    * Retrieve the calendars for all supplied email addresses using existing functions in the `google services package`.
    * Find all meetings within those calendars that are in conflict (overlapping times).
    * Implement a new **Data Access Object (DAO)** to retrieve plain-text conflict resolution rules for the user from **Foundry** to be used in the LLM. (exact API call should be mocked for now, but DAO to be implemented similar as here `packages/services/palantir/src/lib/doa/communications/communications/read.ts`. We can copy that file and modify it to pull the conflict resolution rules from Foundry.)
    * Use an LLM to process the conflicting meetings, the full daily calendar, and the plain-text user rules. Rules going to be like:
      * Prioritize Linda over John
      * Prioritize external meetings over internal meetings
    * Use LLM to generate the list of meetings to reschedule.
    * Check if the output is valid and meeting can be rescheduled.
    * If the output is valid and meeting can be rescheduled, reschedule the meetings.
    * If the output is not valid or meeting can not be rescheduled, return the error.

branch: resolve-meeting-conflicts

## TASK 2: Fix Production Bug

1. Locate the production bug related to an unawaited promise in the **`createClient`** function.
2. Add the necessary **`await`** to ensure the promise resolves before code spin-ups, which should fix the "client is not authorized" issue on hard navigation.

## TASK 3: Environment Management Preparation

1. **Close Pull Request:** Close the existing, in-progress Pull Request for environment variables to avoid conflicts with current TypeScript definitions for ENV.
2. **Design Phase:** Prepare a design for a full, consolidated, and secure environment management solution. The design must propose using an asynchronous factory method within a new, single package (`@environment/factory` pattern) to allow for seamless future integration with various secret stores (e.g., Vercel, AWS Secrets Manager) and to consolidate ENVs and prevent environment sprawl. This design must be structured for review by Chemeck.

---

# Affected Files

```json
[
  {
    "file": "packages/services/google/src/lib/gsuiteClient.v3.ts",
    "type": "added"
  },
  {
    "file": "packages/services/google/src/lib/delegates/resolveMeetingConflicts.ts",
    "type": "added"
  },
  {
    "file": "packages/services/palantir/src/lib/doa/communications/conflictResolutionRules/read.ts",
    "type": "added"
  },
  {
    "file": "packages/services/google/src/lib/delegates/resolveMeetingConflicts.test.ts",
    "type": "added"
  },
  {
    "file": "packages/services/google/src/lib/gsuiteClient.v3.test.ts",
    "type": "added"
  },
  {
    "file": "packages/types/src/lib/types.ts",
    "type": "modified"
  },
  {
    "file": "packages/services/google/src/lib/gsuiteClient.v2.ts",
    "type": "required"
  },
  {
    "file": "packages/services/google/src/lib/gsuiteClient.ts",
    "type": "required"
  },
  {
    "file": "packages/services/google/src/lib/delegates/summerizeCalanders.ts",
    "type": "required"
  },
  {
    "file": "packages/services/palantir/src/lib/geminiService.ts",
    "type": "required"
  }
]
```

# Software Design Specification

- **Design spec**: Automatic Meeting Conflict Resolution v0.1
- **Instructions**: Implement a new Google service client, `gsuiteClient.v3`, extending `gsuiteClient.v2`. This client will include a public API method, `resolveMeetingConflicts`, which accepts an array of user email addresses. The method will retrieve calendars, identify conflicting meetings for the current day based on various criteria, fetch user-specific conflict resolution rules from Foundry, use an LLM to propose rescheduling solutions, validate these proposals, and then reschedule meetings by updating existing Google Calendar events after user confirmation. The method will return a detailed report of the process and outcomes.
- **Overview**: This feature introduces an automated system to detect and resolve scheduling conflicts within Google Calendars for specified users. Its purpose is to streamline meeting management by leveraging LLM capabilities guided by user-defined preferences. The primary users are individuals whose calendars are managed by the system. Success is defined by the accurate identification of conflicts, the generation of valid and actionable rescheduling proposals by the LLM, user confirmation of the resolution, and the successful update of Google Calendar events, or the clear reporting of unresolvable conflicts.
  - **Scope**: Conflict detection for the current day (unless a different day is specified by the user), retrieval of user-specific conflict resolution rules from Foundry, LLM processing of conflicts and rules, validation of LLM-generated proposals, user confirmation of the resolution, and rescheduling of conflicting meetings by updating existing events.
  - **Purpose**: To automatically resolve meeting conflicts for users, reducing manual intervention and improving scheduling efficiency.
  - **Success Criteria**:
    - `gsuiteClient.v3` is successfully generated and extends `gsuiteClient.v2`.
    - The `resolveMeetingConflicts` method correctly identifies all specified conflict criteria.
    - Conflict resolution rules are successfully retrieved from Foundry.
    - The LLM generates valid and actionable rescheduling proposals.
    - User is prompted to confirm the resolution before the changes are made.
    - Conflicting meetings are successfully rescheduled in Google Calendar.
    - A comprehensive report detailing conflicts, proposed resolutions, and outcomes is generated.
  - **Dependencies**: Google Calendar API, Foundry (for conflict resolution rules), existing LLM service, `gsuiteClient.v2`.
  - **Assumptions**:
    - The existing LLM service is capable of processing calendar data and rules to generate rescheduling proposals.
    - Foundry provides conflict resolution rules in a plain-text list of strings.
    - Users have the necessary Google Calendar permissions for reading and writing events.
    - The "current day" for calendar retrieval and conflict identification refers to the local current day of the user initiating the request. Unless the user specifies a different day, the current day is used.
- **Constraints**
  - **Language**: TypeScript (Node.js 20.x)
  - **Libraries**:
    - `googleapis@149.0.0`: For interacting with Google Calendar API.
    - `@google/generative-ai` (or equivalent existing LLM library): For LLM interaction.
    - `@codestrap/developer-foundations-types`: For shared type definitions.
    - `@codestrap/developer-foundations-utils`: For utility functions (e.g., date manipulation, logging).
- **Auth scopes required**
  - `https://www.googleapis.com/auth/calendar`: Provides full read/write access to calendars, necessary for retrieving events, identifying conflicts, and updating/rescheduling events.
  - `https://www.googleapis.com/auth/calendar.events`: More specific scope for managing events.
  - `https://www.googleapis.com/auth/calendar.readonly`: For retrieving calendar events.
  - `https://www.googleapis.com/auth/calendar.freebusy`: For checking free/busy information during validation.
- **Security and Privacy**
  - **Access Controls**: Implement least-privilege access for Google Calendar and Foundry. Ensure that the service account used has only the necessary permissions to read calendar events, retrieve rules, and update events.
  - **Data Protection**: Meeting details (title, description, attendees, times) and user-defined rules are sensitive. These should be handled securely, encrypted in transit and at rest.
  - **Privacy Measures**: User email addresses and calendar event details are Personally Identifiable Information (PII). Ensure these are not exposed unnecessarily and are processed in compliance with privacy regulations.
  - **Log Sanitization**: All logs containing PII (e.g., user emails, meeting titles, attendee lists) must be sanitized or masked before logging to prevent sensitive data leakage. LLM prompts and responses should also be sanitized.
  - **Least-Privilege Enforcement**: The service account should only be granted the minimum necessary OAuth scopes for Google Calendar and the minimum necessary permissions for Foundry.
- **External API Documentation References**
  - **Google Calendar API**:
    - Base URL: `https://www.googleapis.com/calendar/v3`
    - `calendar.events.list`:
      - Method: `GET`
      - Request: `GET /calendars/{calendarId}/events`
      - Response: List of events.
      - Key behaviors: Used to retrieve all events for a given calendar within a specified time range.
    - `calendar.events.update`:
      - Method: `PUT`
      - Request: `PUT /calendars/{calendarId}/events/{eventId}` with event body.
      - Response: Updated event resource.
      - Key behaviors: Used to modify an existing event, including its start/end times and attendees. `sendUpdates: 'all'` will be used to notify attendees.
    - `calendar.freebusy.query`:
      - Method: `POST`
      - Request: `POST /freeBusy` with time range and items (calendars).
      - Response: Free/busy information for specified calendars.
      - Key behaviors: Used to check for availability and validate proposed rescheduling times.
  - **Foundry API (Mocked for now)**:
    - Purpose: To retrieve plain-text conflict resolution rules for a given user.
    - Method: `GET` (or similar, to be defined by DAO).
    - Request: `GET /api/v1/users/{userEmail}/conflict-rules` (pseudo-endpoint).
    - Response: `string[]` (list of plain-text rules).
  - **LLM Service (Existing)**:
    - Purpose: To process conflicting meeting data and user rules to propose rescheduling solutions.
    - Method: `POST` (or similar, to be defined by existing LLM integration).
    - Request: JSON object containing conflicting meeting details, full daily calendar, and user rules.
    - Response: JSON object adhering to `LLMRescheduleProposal` schema.
- **Files Added/Modified/Required**:
  - **Added**:
    - `packages/services/google/src/lib/gsuiteClient.v3.ts`
    - `packages/services/google/src/lib/delegates/resolveMeetingConflicts.ts`
    - `packages/services/palantir/src/lib/doa/communications/conflictResolutionRules/read.ts`
    - `packages/services/google/src/lib/delegates/resolveMeetingConflicts.test.ts`
    - `packages/services/google/src/lib/gsuiteClient.v3.test.ts`
  - **Modified**:
    - `packages/types/src/lib/types.ts` (for `ResolveMeetingConflictsInput`, `ResolveMeetingConflictsOutput`, `ConflictingMeeting`, `LLMRescheduleProposal`, `ConflictResolutionReport`, `MeetingConflictCriteria`).
  - **Required**:
    - `packages/services/google/src/lib/gsuiteClient.v2.ts`
    - `packages/services/google/src/lib/gsuiteClient.ts` (for `makeGSuiteClient` and `GSUITE_SCOPES`).
    - `packages/services/google/src/lib/delegates/summerizeCalanders.ts` (for `summarizeCalendars` function).
    - `packages/services/palantir/src/lib/geminiService.ts` (for LLM service integration).
- **Inputs and Outputs**
  - **Proposed Input Type Changes/Additions**:

    ```typescript
    // packages/types/src/lib/types.ts
    interface ResolveMeetingConflictsInput {
      userEmails: string[];
    }

    interface MeetingConflictCriteria {
      timeOverlap: boolean;
      attendeeOverlap: boolean;
      meetingType: 'internal' | 'external' | 'unknown';
      meetingImportance: 'high' | 'medium' | 'low' | 'unknown';
      meetingPriority: 'high' | 'medium' | 'low' | 'unknown';
      meetingStatus: 'confirmed' | 'tentative' | 'cancelled' | 'unknown';
      meetingLocation: string; // e.g., 'office', 'remote', 'conference room'
      meetingDuration: number; // in minutes
    }

    interface ConflictingMeeting {
      id: string;
      title: string;
      description?: string;
      organizer: string;
      attendees: Array<{ email: string; role: string }>;
      startTime: string; // ISO 8601
      endTime: string; // ISO 8601
      durationMinutes: number;
      location?: string;
      type?: 'internal' | 'external';
      importance?: 'high' | 'medium' | 'low';
      priority?: 'high' | 'medium' | 'low';
      status?: 'confirmed' | 'tentative' | 'cancelled';
      // Add other relevant meeting details for LLM
    }

    interface LLMRescheduleProposal {
      meetingsToReschedule: Array<{
        meetingId: string;
        newStartTime: string; // ISO 8601
        newEndTime: string; // ISO 8601
        // Potentially other modifications like attendee changes, subject updates
      }>;
    }
    ```

  - **Proposed Output Type Changes/Additions**:

    ```typescript
    // packages/types/src/lib/types.ts
    interface ConflictResolutionReport {
      meetingId: string;
      originalStartTime: string;
      originalEndTime: string;
      proposedNewStartTime?: string;
      proposedNewEndTime?: string;
      status:
        | 'rescheduled'
        | 'failed_reschedule'
        | 'no_action_taken'
        | 'invalid_proposal';
      reason?: string; // Details why it failed or no action was taken
      llmProposal?: LLMRescheduleProposal; // The raw LLM output for debugging/auditing
    }

    interface ResolveMeetingConflictsOutput {
      identifiedConflicts: ConflictingMeeting[];
      resolutionReports: ConflictResolutionReport[];
      summary: {
        totalConflicts: number;
        successfullyRescheduled: number;
        failedToReschedule: number;
        noActionTaken: number;
      };
      errors?: string[]; // General errors not tied to a specific meeting
    }
    ```

- **Functional Behavior**
  1. **Input Validation**: Validate that `userEmails` is a non-empty array of valid email addresses.
  2. **Client Initialization**: Create `gsuiteClient.v3` for each user in `userEmails`.
  3. **Calendar Retrieval**: For each user, retrieve their calendar events for the current day. The "current day" is defined as the 24-hour period from the start of the current day in the user's local timezone. Unless the user specifies a different day, the current day is used.
  4. **Conflict Identification**:
     - Iterate through all retrieved meetings across all users.
     - Identify meetings that are in conflict based on the following criteria:
       - **Time overlap**: Meetings occurring at the same time.
       - **Attendee overlap**: Meetings where the same attendee is double-booked.
       - **Meeting type**: Conflicts between internal/external meetings.
       - **Meeting importance**: Conflicts between high/medium/low importance meetings.
       - **Meeting priority**: Conflicts between high/medium/low priority meetings.
       - **Meeting status**: Consider confirmed, tentative, or cancelled meetings.
       - **Meeting location**: Conflicts involving physical locations (e.g., two meetings in the same conference room).
       - **Meeting duration**: Consider the length of the meetings.
     - Group conflicting meetings into conflict sets.
  5. **Foundry Rule Retrieval**: For each user involved in a conflict, call the new Foundry DAO (`packages/services/palantir/src/lib/doa/communications/conflictResolutionRules/read.ts`) to retrieve their plain-text conflict resolution rules using their email address.
  6. **LLM Input Preparation**: For each conflict set, construct a detailed prompt for the LLM, including:
     - Details of all conflicting meetings (`ConflictingMeeting` objects).
     - The full daily calendar for all involved attendees.
     - The aggregated plain-text conflict resolution rules for all involved users.
  7. **LLM Processing**: Invoke the existing LLM service with the prepared input. The LLM is expected to return a `LLMRescheduleProposal` object.
  8. **LLM Output Validation**: Before attempting to reschedule, validate the LLM's proposed changes:
     - **No New Conflicts**: Ensure the proposed new times do not introduce new same priority-level conflicts for any attendee (based on user-defined conflict resolution rules). This will involve checking free/busy information for all attendees for the proposed new time slots.
     - **Working Hours Adherence**: Verify that proposed new times fall within all attendees' defined working hours.
     - **Minimum Notice Period**: Check if the proposed rescheduling adheres to a reasonable minimum notice period (e.g., 15 minutes before the new start time).
     - **Duration Preservation**: Confirm that the proposed new meeting duration is the same as the original, or within an acceptable tolerance (e.g., +/- 15 minutes if explicitly allowed by rules).
     - **Attendee Handling**: Ensure required attendees are still included and optional attendees are handled according to rules (if specified).
  9. **User Confirmation**: Prompt the user to confirm the proposed resolution before any changes are made to Google Calendar. If the user declines, record the outcome as 'no_action_taken'.
  10. **Meeting Rescheduling**:
      - If the LLM's proposal is valid, the user confirms, and rescheduling is possible:
        - Update the existing Google Calendar event using `calendar.events.update`.
        - Set `sendUpdates: 'all'` to notify all attendees of the change.
      - If the LLM's proposal is invalid or rescheduling fails, record the failure.
  11. **Report Generation**: Compile a `ResolveMeetingConflictsOutput` report detailing all identified conflicts, the LLM's proposed resolutions, and the outcome for each (rescheduled, failed to reschedule, no action taken, invalid proposal).
  - **Idempotency**: The `resolveMeetingConflicts` method should be idempotent. Repeated calls with the same set of conflicting meetings should not lead to unintended duplicate actions or further changes if conflicts are already resolved. The conflict detection and validation steps will ensure that only truly conflicting and resolvable meetings are acted upon.
  - **Concurrency**: The method should handle concurrent calls that might involve overlapping sets of users or meetings. This will be managed by ensuring atomic updates to individual calendar events and robust error handling for concurrent modification attempts.
  - **Performance**: No specific performance requirements or Service Level Agreements (SLAs) for the conflict resolution process.
  - **Out of Scope**:
    - Handling of recurring meeting series as a whole; only individual instances of recurring meetings will be considered for rescheduling.
    - Complex negotiation with attendees beyond sending calendar updates.
    - User interface for reviewing or approving LLM proposals. (text based response from the user is sufficient)
- **Error Handling**
  - **Categories**:
    - `ValidationError`: For invalid input parameters (e.g., malformed email addresses).
    - `GoogleCalendarAPIError`: For failures during interaction with the Google Calendar API (e.g., permissions, rate limits).
    - `FoundryAPIError`: For failures during retrieval of conflict resolution rules from Foundry.
    - `LLMProcessingError`: For issues with the LLM service (e.g., invalid response format, service unavailability).
    - `ReschedulingValidationError`: When the LLM's proposed reschedule fails validation (e.g., introduces new conflicts).
    - `CalendarUpdateError`: When the actual calendar update operation fails after validation.
  - **HTTP Status Mappings**: (If exposed via an HTTP endpoint, otherwise internal error codes)
    - `400 Bad Request`: For `ValidationError`.
    - `500 Internal Server Error`: For `GoogleCalendarAPIError`, `FoundryAPIError`, `LLMProcessingError`, `CalendarUpdateError`.
    - `422 Unprocessable Entity`: For `ReschedulingValidationError`.
  - **Retry/Backoff Strategies**:
    - For transient `GoogleCalendarAPIError` (e.g., `429 Too Many Requests`, `5xx` server errors), implement an exponential backoff strategy with up to 3 retries.
    - Other errors will be propagated immediately.
  - **Sanitization of Logs**: All error messages and associated data logged must be sanitized to remove PII and sensitive meeting details. Only non-sensitive identifiers (e.g., `meetingId`) should be logged in raw form.
- **Acceptance Criteria**

  ```gherkin
  Feature: Automatic Meeting Conflict Resolution

    Scenario: Successfully resolve a simple meeting conflict
      Given a list of user emails with a single overlapping meeting conflict
      And Foundry returns valid conflict resolution rules for the users
      And the LLM proposes a valid new time for the conflicting meeting
      When `resolveMeetingConflicts` is called with the user emails
      And the user confirms the resolution
      Then the conflicting meeting is updated in Google Calendar with the new time
      And updates are sent to all attendees
      And the output report shows the meeting as 'rescheduled'

    Scenario: Handle multiple conflicting meetings for multiple users
      Given a list of user emails with multiple complex overlapping meeting conflicts
      And Foundry returns valid conflict resolution rules for all users
      And the LLM proposes valid new times for all conflicting meetings
      When `resolveMeetingConflicts` is called with the user emails
      And the user confirms the resolution
      Then all conflicting meetings are updated in Google Calendar with their respective new times
      And updates are sent to all attendees for each rescheduled meeting
      And the output report shows all meetings as 'rescheduled'

    Scenario: LLM proposes an invalid reschedule (introduces new conflict)
      Given a list of user emails with a meeting conflict
      And Foundry returns valid conflict resolution rules
      And the LLM proposes a new time that introduces a new conflict for an attendee
      When `resolveMeetingConflicts` is called with the user emails
      And the user confirms the resolution
      Then the original conflicting meeting is NOT updated
      And the output report shows the meeting as 'invalid_proposal' with a reason

    Scenario: LLM proposes an invalid reschedule (outside working hours)
      Given a list of user emails with a meeting conflict
      And Foundry returns valid conflict resolution rules
      And the LLM proposes a new time outside an attendee's working hours
      When `resolveMeetingConflicts` is called with the user emails
      And the user confirms the resolution
      Then the original conflicting meeting is NOT updated
      And the output report shows the meeting as 'invalid_proposal' with a reason

    Scenario: Google Calendar API fails during update
      Given a list of user emails with a meeting conflict
      And Foundry returns valid conflict resolution rules
      And the LLM proposes a valid new time
      And the Google Calendar API returns a transient error during the update
      When `resolveMeetingConflicts` is called with the user emails
      Then the Google Calendar API call is retried up to 3 times with exponential backoff
      And if retries fail, the original conflicting meeting is NOT updated
      And the output report shows the meeting as 'failed_reschedule' with a reason

    Scenario: Foundry API fails to retrieve rules
      Given a list of user emails with a meeting conflict
      And the Foundry API returns an error when retrieving conflict resolution rules
      Then no meetings are attempted to be rescheduled
      And the output report shows an error related to Foundry rule retrieval

    Scenario: No conflicts identified
      Given a list of user emails with no overlapping meeting conflicts
      When `resolveMeetingConflicts` is called with the user emails
      Then no meetings are updated in Google Calendar
      And the output report shows no identified conflicts and no resolution reports

    Scenario: Idempotent behavior on repeated calls
      Given a set of conflicting meetings that are successfully resolved on the first call
      When `resolveMeetingConflicts` is called again with the same input after resolution
      Then no further changes are made to the calendar events
      And the output report reflects that no new actions were taken for already resolved conflicts

    Scenario: Handling of concurrent calls
      Given two concurrent calls to `resolveMeetingConflicts` with overlapping sets of users/meetings
      When both calls attempt to resolve conflicts
      Then the system handles concurrent updates gracefully
      And ensures data consistency for calendar events
      And provides accurate resolution reports for each call
  ```

- **Usage (via client)**
  - Pseudo:

    ```typescript
    import { makeGSuiteClientV3 } from '@codestrap/developer-foundations-services-google/gsuiteClient.v3';

    async function main() {
      const userEmail = 'user@example.com'; // The user whose behalf the client is created
      const client = await makeGSuiteClientV3(userEmail);

      const userEmailsToResolve = [
        'linda@example.com',
        'john@example.com',
        'external@partner.com',
      ];

      try {
        const resolutionOutput =
          await client.resolveMeetingConflicts(userEmailsToResolve);

        console.log('Conflict Resolution Summary:', resolutionOutput.summary);
        resolutionOutput.resolutionReports.forEach((report) => {
          console.log(
            `Meeting ID: ${report.meetingId}, Status: ${report.status}, Reason: ${report.reason || 'N/A'}`,
          );
          if (report.proposedNewStartTime && report.proposedNewEndTime) {
            console.log(
              `  Proposed New Time: ${report.proposedNewStartTime} - ${report.proposedNewEndTime}`,
            );
          }
        });
      } catch (error) {
        console.error('Error resolving meeting conflicts:', error);
      }
    }

    main();
    ```

  - Example Request Shape:

    ```typescript
    // Input to resolveMeetingConflicts method
    const request: string[] = [
      'linda@example.com',
      'john@example.com',
      'sarah@example.com',
    ];
    ```

  - Example Successful Response Shape:

    ```typescript
    // Output from resolveMeetingConflicts method
    const response: ResolveMeetingConflictsOutput = {
      identifiedConflicts: [
        {
          id: 'meeting123',
          title: 'Project Sync',
          organizer: 'linda@example.com',
          attendees: [
            { email: 'linda@example.com', role: 'organizer' },
            { email: 'john@example.com', role: 'required' },
          ],
          startTime: '2025-11-21T10:00:00Z',
          endTime: '2025-11-21T11:00:00Z',
          durationMinutes: 60,
          // ... other details
        },
        // ... more conflicting meetings
      ],
      resolutionReports: [
        {
          meetingId: 'meeting123',
          originalStartTime: '2025-11-21T10:00:00Z',
          originalEndTime: '2025-11-21T11:00:00Z',
          proposedNewStartTime: '2025-11-21T14:00:00Z',
          proposedNewEndTime: '2025-11-21T15:00:00Z',
          status: 'rescheduled',
          reason: 'LLM proposed new time, validated and updated.',
          llmProposal: {
            meetingsToReschedule: [
              {
                meetingId: 'meeting123',
                newStartTime: '2025-11-21T14:00:00Z',
                newEndTime: '2025-11-21T15:00:00Z',
              },
            ],
          },
        },
        {
          meetingId: 'meeting456',
          originalStartTime: '2025-11-21T10:30:00Z',
          originalEndTime: '2025-11-21T11:30:00Z',
          status: 'failed_reschedule',
          reason: 'LLM proposed time introduced new conflict.',
          llmProposal: {
            /* ... */
          },
        },
      ],
      summary: {
        totalConflicts: 2,
        successfullyRescheduled: 1,
        failedToReschedule: 1,
        noActionTaken: 0,
      },
      errors: [],
    };
    ```

  - Example Error Response Shape:

    ```typescript
    // Output from resolveMeetingConflicts method in case of a top-level error
    // (e.g., invalid input, unrecoverable API error before processing conflicts)
    const errorResponse: ResolveMeetingConflictsOutput = {
      identifiedConflicts: [],
      resolutionReports: [],
      summary: {
        totalConflicts: 0,
        successfullyRescheduled: 0,
        failedToReschedule: 0,
        noActionTaken: 0,
      },
      errors: ['Invalid input: userEmails array cannot be empty.'],
    };
    ```


---

# Proposed Code Edits
File: packages/types/src/lib/types.ts (MODIFIED)
```diff
*** Begin Patch
*** Update File: packages/types/src/lib/types.ts
@@
 export type RequestContext = {
   token?: string | null | undefined;
   user?: User | null | undefined;
   requestId?: string | null | undefined;
 };
 
+/**
+ * Resolve Meeting Conflicts - Types
+ */
+export interface ResolveMeetingConflictsInput {
+  userEmails: string[];
+  /** optional ISO date string to target a specific day; if omitted use current day in user's tz */
+  targetDayISO?: string;
+  /** optional callback to confirm proposed changes; returns true to proceed */
+  confirm?: (summary: any) => Promise<boolean>;
+}
+
+export interface MeetingConflictCriteria {
+  timeOverlap: boolean;
+  attendeeOverlap: boolean;
+  meetingType: 'internal' | 'external' | 'unknown';
+  meetingImportance: 'high' | 'medium' | 'low' | 'unknown';
+  meetingPriority: 'high' | 'medium' | 'low' | 'unknown';
+  meetingStatus: 'confirmed' | 'tentative' | 'cancelled' | 'unknown';
+  meetingLocation: string;
+  meetingDuration: number;
+}
+
+export interface ConflictingMeeting {
+  id: string;
+  title: string;
+  description?: string;
+  organizer: string;
+  attendees: Array<{ email: string; role: string }>;
+  startTime: string;
+  endTime: string;
+  durationMinutes: number;
+  location?: string;
+  type?: 'internal' | 'external';
+  importance?: 'high' | 'medium' | 'low';
+  priority?: 'high' | 'medium' | 'low';
+  status?: 'confirmed' | 'tentative' | 'cancelled';
+}
+
+export interface LLMRescheduleProposal {
+  meetingsToReschedule: Array<{
+    meetingId: string;
+    newStartTime: string;
+    newEndTime: string;
+  }>;
+}
+
+export interface ConflictResolutionReport {
+  meetingId: string;
+  originalStartTime: string;
+  originalEndTime: string;
+  proposedNewStartTime?: string;
+  proposedNewEndTime?: string;
+  status:
+    | 'rescheduled'
+    | 'failed_reschedule'
+    | 'no_action_taken'
+    | 'invalid_proposal';
+  reason?: string;
+  llmProposal?: LLMRescheduleProposal;
+}
+
+export interface ResolveMeetingConflictsOutput {
+  identifiedConflicts: ConflictingMeeting[];
+  resolutionReports: ConflictResolutionReport[];
+  summary: {
+    totalConflicts: number;
+    successfullyRescheduled: number;
+    failedToReschedule: number;
+    noActionTaken: number;
+  };
+  errors?: string[];
+}
+
*** End Patch
```

File: packages/services/palantir/src/lib/doa/communications/conflictResolutionRules/read.ts (ADDED)
```typescript
import type { SupportedFoundryClients } from '@codestrap/developer-foundations-types';
import { foundryClientFactory } from '../../factory/foundryClientFactory';

/**
 * Read conflict resolution rules for a user from Foundry.
 * For now this is a thin wrapper around the foundry client. Returns string[].
 */
export async function readConflictResolutionRules(
  userEmail: string,
  clientType: SupportedFoundryClients = SupportedFoundryClients.PRIVATE
): Promise<string[]> {
  const { getToken, url, ontologyRid } = foundryClientFactory(
    process.env.FOUNDRY_CLIENT_TYPE || clientType,
    undefined
  );

  const apiKey = await getToken();
  const fullUrl = `${url}/api/v1/users/${encodeURIComponent(
    userEmail
  )}/conflict-rules`;

  const res = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Foundry read failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as { rules?: string[] } | string[];
  return Array.isArray(body) ? body : body.rules ?? [];
}
```

File: packages/services/google/src/lib/delegates/resolveMeetingConflicts.ts (ADDED)
```typescript
import {
  ResolveMeetingConflictsInput,
  ResolveMeetingConflictsOutput,
  ConflictingMeeting,
  LLMRescheduleProposal,
  ConflictResolutionReport,
} from '@codestrap/developer-foundations-types';
import { summarizeCalendars } from '../delegates/summerizeCalanders';
import { readConflictResolutionRules } from '@codestrap/developer-foundations-palantir/doa/communications/conflictResolutionRules/read';
import { geminiService } from '@codestrap/developer-foundations-palantir/geminiService';
import { calendar_v3, google } from 'googleapis';
import { toUTCFromWallClockLocal } from '@codestrap/developer-foundations-utils';

/**
 * Minimal conflict detection (time overlap + attendee overlap) and orchestration:
 * - fetch calendars for day
 * - detect conflicts (group sets)
 * - fetch user rules
 * - call LLM (geminiService) to propose reschedules
 * - validate proposals with freebusy
 * - ask for confirmation via optional confirm callback
 * - perform updates via calendar.events.update
 *
 * Note: This is intentionally pure-ish and uses Promise.all for concurrency.
 */

type CalendarSummary = {
  email: string;
  events: {
    id: string;
    subject: string;
    description?: string;
    start: string;
    end: string;
    participants: string[];
    durationMinutes: number;
  }[];
};

function isoOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

function toConflictingMeeting(evt: any): ConflictingMeeting {
  return {
    id: evt.id,
    title: evt.subject,
    description: evt.description,
    organizer: evt.participants?.[0] ?? 'unknown',
    attendees: (evt.participants ?? []).map((e: string) => ({ email: e, role: 'required' })),
    startTime: evt.start,
    endTime: evt.end,
    durationMinutes: evt.durationMinutes,
    location: undefined,
  };
}

export async function resolveMeetingConflictsDelegate(args: {
  calendarClient: calendar_v3.Calendar;
  userEmails: string[];
  timezone: string;
  windowStartLocal: Date;
  windowEndLocal: Date;
  confirm?: (summary: any) => Promise<boolean>;
}): Promise<ResolveMeetingConflictsOutput> {
  const { calendarClient, userEmails, timezone, windowStartLocal, windowEndLocal, confirm } = args;

  const timeMin = toUTCFromWallClockLocal(windowStartLocal, timezone).toISOString();
  const timeMax = toUTCFromWallClockLocal(windowEndLocal, timezone).toISOString();

  // fetch calendars in parallel
  const summaries = await summarizeCalendars({
    calendar: calendarClient,
    emails: userEmails,
    timezone,
    windowStartLocal,
    windowEndLocal,
  });

  const calendars = summaries.calendars as CalendarSummary[];

  // flatten events with owner info
  const allEvents = calendars.flatMap((c) =>
    c.events.map((e) => ({ ...e, owner: c.email }))
  );

  // detect conflicts: pairwise compare and build sets
  const conflictSets: Map<string, ConflictingMeeting[]> = new Map();

  allEvents.forEach((evt, idx) => {
    const conflicts = allEvents
      .filter((other, jdx) => idx !== jdx)
      .filter((other) => isoOverlap(evt.start, evt.end, other.start, other.end) ||
        other.participants.some((p) => (evt.participants ?? []).includes(p))
      );

    if (conflicts.length > 0) {
      const key = [evt.id, ...conflicts.map((c) => c.id)].sort().join('|');
      const set = [evt, ...conflicts].map(toConflictingMeeting);
      conflictSets.set(key, set);
    }
  });

  // dedupe sets (they are keyed by sorted ids)
  const conflictArrays = Array.from(conflictSets.values());

  // fetch rules per involved user (unique emails)
  const involvedUsers = Array.from(new Set(allEvents.flatMap((e) => e.participants).concat(allEvents.map(e => e.owner))));
  const rulesMap = new Map(
    await Promise.all(involvedUsers.map(async (u) => {
      try {
        const r = await readConflictResolutionRules(u);
        return [u, r] as const;
      } catch (err) {
        return [u, []] as const;
      }
    }))
  );

  // For each conflict set, call LLM to propose
  const llmPromises = conflictArrays.map(async (set) => {
    const payload = {
      conflictSet: set,
      rules: Array.from(new Set(set.flatMap((m) => m.attendees.map(a => a.email))))
        .map((email) => ({ email, rules: rulesMap.get(email) ?? [] })),
      fullDay: calendars,
    };

    // call LLM (geminiService) - expect JSON string back
    const llmRaw = await geminiService('system', JSON.stringify(payload), { extractJsonString: true } as any).catch((e) => {
      throw new Error('LLMProcessingError: ' + (e?.message ?? String(e)));
    });

    // try parse as JSON
    let proposal: LLMRescheduleProposal | null = null;
    try {
      proposal = JSON.parse(llmRaw) as LLMRescheduleProposal;
    } catch {
      // fallback: attempt to find JSON inside string
      const m = llmRaw.match(/\{[\s\S]*\}/);
      if (m) {
        proposal = JSON.parse(m[0]) as LLMRescheduleProposal;
      }
    }
    if (!proposal) throw new Error('LLMProcessingError: invalid response');

    return { set, proposal };
  });

  const llmResults = await Promise.allSettled(llmPromises);

  const resolutionReports: ConflictResolutionReport[] = [];
  const errors: string[] = [];

  // Validate proposals using freebusy queries in parallel
  const toUpdate: Array<{
    originalEvent: ConflictingMeeting;
    proposed: { start: string; end: string };
    proposalRaw?: LLMRescheduleProposal;
  }> = [];

  llmResults.forEach((res) => {
    if (res.status === 'rejected') {
      errors.push(res.reason?.message ?? 'LLM failed');
      return;
    }
    const { set, proposal } = res.value!;
    // validate each meeting in proposal
    (proposal.meetingsToReschedule ?? []).forEach((m) => {
      const original = set.find((s) => s.id === m.meetingId);
      if (!original) {
        resolutionReports.push({
          meetingId: m.meetingId,
          originalStartTime: '',
          originalEndTime: '',
          status: 'invalid_proposal',
          reason: 'Meeting id not found in conflict set',
          llmProposal: proposal,
        });
        return;
      }
      // basic validation: preserve duration
      const origDur = (new Date(original.endTime).getTime() - new Date(original.startTime).getTime()) / 60000;
      const newDur = (new Date(m.newEndTime).getTime() - new Date(m.newStartTime).getTime()) / 60000;
      if (Math.abs(origDur - newDur) > 15) {
        resolutionReports.push({
          meetingId: original.id,
          originalStartTime: original.startTime,
          originalEndTime: original.endTime,
          status: 'invalid_proposal',
          reason: 'Duration change too large',
          llmProposal: proposal,
        });
        return;
      }
      // enqueue for freebusy validation
      toUpdate.push({ originalEvent: original, proposed: { start: m.newStartTime, end: m.newEndTime }, proposalRaw: proposal });
    });
  });

  // Build freebusy request items
  const freeBusyReq = {
    timeMin: toUpdate.length ? toUpdate.map(t => t.proposed.start).reduce((a,b)=> a<b?a:b) : timeMin,
    timeMax: toUpdate.length ? toUpdate.map(t => t.proposed.end).reduce((a,b)=> a>b?a:b) : timeMax,
    items: Array.from(new Set(toUpdate.flatMap(t => t.originalEvent.attendees.map(a=>a.email)))).map(email => ({ id: email })),
  };

  // If no updates to validate, return early
  if (toUpdate.length === 0) {
    return {
      identifiedConflicts: conflictArrays.flat(),
      resolutionReports,
      summary: {
        totalConflicts: conflictArrays.flat().length,
        successfullyRescheduled: 0,
        failedToReschedule: resolutionReports.filter(r=>r.status==='failed_reschedule').length,
        noActionTaken: resolutionReports.filter(r=>r.status==='no_action_taken').length,
      },
      errors: errors.length ? errors : undefined,
    };
  }

  // call freebusy
  const fbRes = await calendarClient.freebusy.query({
    requestBody: {
      timeMin: freeBusyReq.timeMin,
      timeMax: freeBusyReq.timeMax,
      items: freeBusyReq.items,
    },
  }).catch((e) => { throw new Error('GoogleCalendarAPIError: freebusy query failed'); });

  const busyMap = new Map(
    (fbRes.data.calendars ? Object.entries(fbRes.data.calendars) : []).map(([k, v]) => [
      k,
      (v.busy ?? []).map((b: any) => ({ start: b.start, end: b.end })),
    ])
  );

  // validate no conflicts for proposed slots
  toUpdate.forEach((u) => {
    const attendees = u.originalEvent.attendees.map(a => a.email);
    const conflictFound = attendees.some((email) => {
      const busy = busyMap.get(email) ?? [];
      return busy.some((b: any) => isoOverlap(u.proposed.start, u.proposed.end, b.start, b.end));
    });
    if (conflictFound) {
      resolutionReports.push({
        meetingId: u.originalEvent.id,
        originalStartTime: u.originalEvent.startTime,
        originalEndTime: u.originalEvent.endTime,
        status: 'invalid_proposal',
        reason: 'Proposed time introduces conflicts for attendees',
        llmProposal: u.proposalRaw,
      });
      return;
    }
    // otherwise mark as candidate
    resolutionReports.push({
      meetingId: u.originalEvent.id,
      originalStartTime: u.originalEvent.startTime,
      originalEndTime: u.originalEvent.endTime,
      proposedNewStartTime: u.proposed.start,
      proposedNewEndTime: u.proposed.end,
      status: 'no_action_taken', // will change if user confirms & update succeeds
      llmProposal: u.proposalRaw,
    });
  });

  // Ask user confirmation if provided
  const candidates = resolutionReports.filter(r => r.status === 'no_action_taken');
  let userConfirmed = true;
  if (confirm && candidates.length) {
    userConfirmed = await confirm({
      summary: {
        totalProposals: candidates.length,
        proposals: candidates.map(c => ({ meetingId: c.meetingId, from: c.originalStartTime, to: c.proposedNewStartTime })),
      },
    }).catch(() => false);
  }

  if (!userConfirmed) {
    // mark as no action taken
    resolutionReports.forEach((r) => {
      if (r.status === 'no_action_taken') {
        r.status = 'no_action_taken';
        r.reason = 'User declined proposed reschedule';
      }
    });

    return {
      identifiedConflicts: conflictArrays.flat(),
      resolutionReports,
      summary: {
        totalConflicts: conflictArrays.flat().length,
        successfullyRescheduled: 0,
        failedToReschedule: 0,
        noActionTaken: resolutionReports.filter(r=>r.status==='no_action_taken').length,
      },
      errors: errors.length ? errors : undefined,
    };
  }

  // perform calendar updates in parallel with retry/backoff (up to 3)
  const updatePromises = resolutionReports
    .filter(r => r.status === 'no_action_taken' && r.proposedNewStartTime)
    .map(async (r) => {
      const original = toUpdate.find(t => t.originalEvent.id === r.meetingId)!;
      const maxRetries = 3;
      let attempt = 0;
      while (attempt < maxRetries) {
        try {
          await calendarClient.events.update({
            calendarId: original.originalEvent?.organizer ?? original.originalEvent.attendees[0]?.email ?? 'primary',
            eventId: original.originalEvent.id,
            sendUpdates: 'all',
            requestBody: {
              start: { dateTime: r.proposedNewStartTime },
              end: { dateTime: r.proposedNewEndTime },
            },
          } as any);
          r.status = 'rescheduled';
          r.reason = 'LLM proposed new time, validated and updated.';
          return r;
        } catch (err) {
          attempt += 1;
          // simple exponential backoff
          await new Promise((res) => setTimeout(res, 250 * Math.pow(2, attempt)));
          if (attempt >= maxRetries) {
            r.status = 'failed_reschedule';
            r.reason = `Calendar update failed after ${maxRetries} attempts`;
            return r;
          }
        }
      }
    });

  const finalResults = await Promise.allSettled(updatePromises);
  // ensure resolutionReports reflect any updates from promises (they mutate r)
  // compile final summary
  const successfullyRescheduled = resolutionReports.filter(r => r.status === 'rescheduled').length;
  const failedToReschedule = resolutionReports.filter(r => r.status === 'failed_reschedule').length;
  const noActionTaken = resolutionReports.filter(r => r.status === 'no_action_taken').length;

  return {
    identifiedConflicts: conflictArrays.flat(),
    resolutionReports,
    summary: {
      totalConflicts: conflictArrays.flat().length,
      successfullyRescheduled,
      failedToReschedule,
      noActionTaken,
    },
    errors: errors.length ? errors : undefined,
  };
}
```

File: packages/services/google/src/lib/gsuiteClient.v3.ts (ADDED)
```typescript
import { makeGSuiteClient } from './gsuiteClient';
import { makeGSuiteClientV2 } from './gsuiteClient.v2';
import { resolveMeetingConflictsDelegate } from './delegates/resolveMeetingConflicts';
import {
  ResolveMeetingConflictsInput,
  ResolveMeetingConflictsOutput,
} from '@codestrap/developer-foundations-types';
import { calendar_v3 } from 'googleapis';

/**
 * makeGSuiteClientV3 extends V2 adding resolveMeetingConflicts API.
 */
export async function makeGSuiteClientV3(user: string) {
  const v2 = await makeGSuiteClientV2(user);
  const v1 = await makeGSuiteClient(user);

  return {
    ...v2,
    resolveMeetingConflicts: async (
      userEmails: string[] | ResolveMeetingConflictsInput
    ): Promise<ResolveMeetingConflictsOutput> => {
      const input: ResolveMeetingConflictsInput =
        Array.isArray(userEmails) ? { userEmails } : (userEmails as ResolveMeetingConflictsInput);

      if (!input.userEmails || !Array.isArray(input.userEmails) || input.userEmails.length === 0) {
        return {
          identifiedConflicts: [],
          resolutionReports: [],
          summary: {
            totalConflicts: 0,
            successfullyRescheduled: 0,
            failedToReschedule: 0,
            noActionTaken: 0,
          },
          errors: ['Invalid input: userEmails array cannot be empty.'],
        };
      }

      // determine day window: default to today in user's timezone (approx using local)
      const now = input.targetDayISO ? new Date(input.targetDayISO) : new Date();
      const windowStartLocal = new Date(now);
      windowStartLocal.setHours(0, 0, 0, 0);
      const windowEndLocal = new Date(now);
      windowEndLocal.setHours(23, 59, 59, 999);

      // delegate does heavy lifting
      const result = await resolveMeetingConflictsDelegate({
        calendarClient: v1.getCalendarClient() as calendar_v3.Calendar,
        userEmails: input.userEmails,
        timezone: 'UTC', // best-effort; delegate may use per-user tz in future
        windowStartLocal,
        windowEndLocal,
        confirm: input.confirm,
      });

      return result;
    },
  };
}
```

File: packages/services/google/src/lib/delegates/resolveMeetingConflicts.test.ts (ADDED)
```typescript
/**
 * Test skeleton for resolveMeetingConflicts delegate
 *
 * Gherkin scenarios are included as comments for developer to implement tests.
 *
 * Scenario outlines already provided in design spec.
 */

// NOTE: Leave tests blank for developers to implement.
// Developers should import resolveMeetingConflictsDelegate and mock google calendar/freebusy,
// Foundry read, and geminiService to exercise the acceptance criteria.
```

File: packages/services/google/src/lib/gsuiteClient.v3.test.ts (ADDED)
```typescript
/**
 * Test skeleton for GSuiteClient V3
 *
 * Gherkin acceptance criteria included as comments.
 *
 * Tests intentionally left blank for developers to implement.
 */

/*
Feature: Automatic Meeting Conflict Resolution

  Scenario: Successfully resolve a simple meeting conflict
    Given a list of user emails with a single overlapping meeting conflict
    And Foundry returns valid conflict resolution rules for the users
    And the LLM proposes a valid new time for the conflicting meeting
    When `resolveMeetingConflicts` is called with the user emails
    And the user confirms the resolution
    Then the conflicting meeting is updated in Google Calendar with the new time
    And updates are sent to all attendees
    And the output report shows the meeting as 'rescheduled'
*/
```

File: packages/services/google/src/lib/gsuiteClient.v3.test.ts (ADDED)
```typescript
/**
 * Placeholder - duplicate filename detected above; ensure CI places tests in correct path.
 *
 * Leave actual test cases blank per specification. Include gherkin scenarios as comments.
 */
```


# The complete current contents of all files being modified without any changes applied
# Current contents of the Files to be Modified
- File path: packages/types/src/lib/types.ts
- Contents:
```typescript
import { ComputeModule } from '@palantir/compute-module';
import type { Client } from '@osdk/client';
import { Type, Static } from '@sinclair/typebox';
import { StateValue } from 'xstate';
import { calendar_v3, gmail_v1, drive_v3 } from 'googleapis';
import { User as FoundryUser } from '@osdk/foundry.admin';

export const TYPES = {
  FoundryClient: Symbol.for('FoundryClient'),
  RangrClient: Symbol.for('RangrClient'),
  WeatherService: Symbol.for('WeatherService'),
  EnergyService: Symbol.for('EnergyService'),
  WorldDao: Symbol.for('WorldDao'),
  UserDao: Symbol.for('UserDao'),
  MachineDao: Symbol.for('MachineDao'),
  TicketDao: Symbol.for('TicketDao'),
  CommsDao: Symbol.for('CommsDao'),
  TelemetryDao: Symbol.for('TelemetryDao'),
  ThreadsDao: Symbol.for('ThreadsDao'),
  SQLLiteThreadsDao: Symbol.for('SQLLiteThreadsDao'),
  RfpRequestsDao: Symbol.for('RfpRequestsDao'),
  RangrRfpRequestsDao: Symbol.for('RangrRfpRequestsDao'),
  ResearchAssistant: Symbol.for('ResearchAssistant'),
  CodingResearchAssistant: Symbol.for('CodingResearchAssistant'),
  CodingArchitect: Symbol.for('CodingArchitect'),
  MemoryRecallDao: Symbol.for('MemoryRecallDao'),
  ContactsDao: Symbol.for('ContactsDao'),
  GeminiService: Symbol.for('GeminiService'),
  Gpt4oService: Symbol.for('Gpt4oService'),
  GeminiSearchStockMarket: Symbol.for('GeminiSearchStockMarket'),
  OfficeService: Symbol.for('OfficeService'),
  VersionControlService: Symbol.for('VersionControlService'),
  MessageService: Symbol.for('MessageService'),
  EmbeddingsService: Symbol.for('EmbeddingsService'),
  TrainingDataDao: Symbol.for('TrainingDataDao'),
  LoggingService: Symbol.for('LoggingService'),
};

export type ResearchAssistant = (
  userInput: string,
  num?: number,
  dateRestrict?: string,
  siteSearch?: string,
  siteSearchFilter?: string,
  searchEngineId?: string
) => Promise<string>;

export type CodingResearchAssistant = (
  userInput: string,
  num?: number,
  dateRestrict?: string,
  siteSearch?: string,
  siteSearchFilter?: string,
  searchEngineId?: string
) => Promise<string>;

export type CodingArchitect = (
  userInput: string,
  num?: number,
  dateRestrict?: string,
  siteSearch?: string,
  siteSearchFilter?: string,
  searchEngineId?: string
) => Promise<string>;

// Schema Definitions for compute module
// IMPORTANT:  @sinclair/typebox is required!!!
// https://github.com/palantir/typescript-compute-module?tab=readme-ov-file#schema-registration
export const Schemas = {
  SendEmail: {
    input: Type.Object({
      recipients: Type.Array(Type.String()),
      subject: Type.String(),
      message: Type.String(),
    }),
    output: Type.Object({
      id: Type.String(),
      threadId: Type.String(),
      labelIds: Type.Array(Type.String()),
    }),
  },
  ReadEmailHistory: {
    input: Type.String(),
    output: Type.Object({
      messages: Type.Array(
        Type.Object({
          subject: Type.Optional(Type.String()),
          from: Type.Optional(Type.String()),
          body: Type.Optional(Type.String()),
          id: Type.Optional(Type.String()),
          threadId: Type.Optional(Type.String()),
        })
      ),
    }),
  },
  WatchEmails: {
    input: Type.Object({
      config: Type.Array(
        Type.Object({
          topicName: Type.String(),
          users: Type.Array(Type.String()),
          labelIds: Type.Array(Type.String()),
          labelFilterBehavior: Type.String(),
        })
      ),
    }),
    output: Type.Object({
      status: Type.Integer(),
      errors: Type.Optional(Type.Array(Type.String())),
      responses: Type.Optional(Type.Array(Type.String())),
    }),
  },
  ScheduleMeeting: {
    input: Type.Object({
      summary: Type.String(),
      description: Type.Optional(Type.String()),
      start: Type.String(),
      end: Type.String(),
      attendees: Type.Array(Type.String()),
    }),
    output: Type.Object({
      id: Type.String(),
      htmlLink: Type.String(),
      status: Type.String(),
    }),
  },
  FindOptimalMeetingTime: {
    input: Type.Object({
      participants: Type.Array(Type.String()),
      timeframe_context: Type.String(),
      duration_minutes: Type.Optional(Type.Number({ default: 30 })),
      working_hours: Type.Optional(
        Type.Object({
          start_hour: Type.Number({ default: 9 }),
          end_hour: Type.Number({ default: 17 }),
        })
      ),
      timezone: Type.String(),
    }),
    output: Type.Object({
      suggested_times: Type.Array(
        Type.Object({
          start: Type.String(),
          end: Type.String(),
          score: Type.Number(),
        })
      ),
      message: Type.String(),
    }),
  },
};

// Types from Schemas
export type ScheduleMeetingInput = Static<typeof Schemas.ScheduleMeeting.input>;
export type ScheduleMeetingOutput = Static<
  typeof Schemas.ScheduleMeeting.output
>;
export type SendEmailOutput = Static<typeof Schemas.SendEmail.output>;
export type SendEmailInput = Static<typeof Schemas.SendEmail.input>;
export type ReadEmailOutput = Static<typeof Schemas.ReadEmailHistory.output>;
export type ReadEmailInput = Static<typeof Schemas.ReadEmailHistory.input>;
export type WatchEmailsOutput = Static<typeof Schemas.WatchEmails.output>;
export type WatchEmailsInput = Static<typeof Schemas.WatchEmails.input>;
export type FindOptimalMeetingTimeInput = Static<
  typeof Schemas.FindOptimalMeetingTime.input
>;
export type FindOptimalMeetingTimeOutput = Static<
  typeof Schemas.FindOptimalMeetingTime.output
>;

export type UserProfile = {
  name: string | undefined;
  id: string | undefined;
  email: string | undefined;
  timezone: string | undefined;
};

export type MessageResponse = {
  ok: boolean;
  channel: string;
  ts: number;
  error?: string;
};

export type Message = {
  channelId: string;
  message: string;
};

export interface EmailConfig {
  recipients: string[];
  defaultSubject: string;
  defaultMessage: string;
}

export interface CalendarConfig {
  attendees: string[];
  defaultSummary: string;
  defaultDescription: string;
  defaultTimeframe: string;
  defaultDuration: number;
  defaultWorkingHours: WorkingHours;
}

export interface Config {
  email: EmailConfig;
  calendar: CalendarConfig;
}

export interface WorkingHours {
  start_hour: number;
  end_hour: number;
}

export interface TimeSlot {
  start: string;
  end: string;
  score?: number;
  attendees?: string;
  id?: string;
  startLocalDate?: string;
  endLocalDate?: string;
  duration?: number;
}

export interface EmailContext {
  from: string;
  recipients: string[];
  subject: string;
  message: string;
}

export interface ReadEmailHistoryContext {
  email: string;
  publishTime: string;
  labels?: string[];
}

export interface CalendarContext {
  summary: string;
  description?: string;
  start: string;
  end: string;
  attendees: string[];
}

export interface OptimalTimeContext {
  participants: string[];
  timeframe_context: string;
  duration_minutes?: number;
  working_hours?: WorkingHours;
  timezone?: string;
}

export interface TimeRange {
  startTime: Date;
  endTime: Date;
}

export interface BusyPeriod {
  start: string;
  end: string;
}

export type EmailMessage = {
  subject?: string;
  from?: string;
  body?: string;
  id?: string;
  threadId?: string;
};

export type AvailableTime = {
  start: string; // Available start time
  end: string; // IANA time zone (e.g., "America/New_York")
  availableAttendees: string[]; // Attendees available at this time
  unavailableAttendees: string[]; // Attendees unavailable at this time
};

export type ProposedTimes = {
  times: AvailableTime[]; // Array of available time slots
  subject: string; // Meeting subject or title
  agenda?: string; // Optional agenda
  durationInMinutes: number; // Meeting duration in minutes
  allAvailable: boolean; // are all required attendees available
};

export type MeetingRequest = {
  participants: Array<string>;
  subject: string;
  timeframe_context:
  | 'user defined exact date/time'
  | 'as soon as possible'
  | 'this week'
  | 'next week';
  localDateString?: string;
  duration_minutes: number;
  working_hours: {
    start_hour: number;
    end_hour: number;
  };
};

export type DerivedWindow = {
  windowStartLocal: Date;
  windowEndLocal: Date;
  slotStepMinutes: number;
};

export type Meeting = {
  id: string;
  status: string;
  htmlLink: string;
};

export interface GeminiParameters {
  stopSequences?: Array<string>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  extractJsonString?: boolean;
}

export interface GeminiService {
  (user: string, system: string, params?: GeminiParameters): Promise<string>;
}

type GptSpecificToolChoice = {
  function?: { name: string } | undefined;
};

type GptTool = {
  function?:
  | {
    name: string;
    description?: string | undefined;
    strict?: boolean | undefined;
    parameters: Map<string, string>;
  }
  | undefined;
};

type GptToolChoice = {
  auto?: unknown | undefined;
  none?: unknown | undefined;
  specific?: GptSpecificToolChoice | undefined;
  required?: unknown | undefined;
};

type GptResponseFormat = {
  jsonSchema?: Map<string, string> | undefined;
  type: string;
};

export interface Gpt40Parameters {
  toolChoice?: GptToolChoice | undefined;
  presencePenalty?: number | undefined;
  stop?: Array<string> | undefined;
  seed?: number | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  logitBias?: Map<number, number> | undefined;
  responseFormat?: GptResponseFormat | undefined;
  topP?: number | undefined;
  frequencyPenalty?: number | undefined;
  tools?: Array<GptTool> | undefined;
  n?: number | undefined;
}

export interface Gpt4oService {
  (user: string, system: string, params?: Gpt40Parameters): Promise<string>;
}

export interface EmbeddingsService {
  (input: string): Promise<[number[]]>;
}

export interface Token {
  readonly access_token: string;
  readonly expires_in: number;
  readonly refresh_token?: string;
  readonly expires_at: number;
}

export interface BaseOauthClient {
  (): Promise<string>;
  getTokenOrUndefined: () => string | undefined;
  signIn: () => Promise<Token>;
  signOut: () => Promise<void>;
}

export interface FoundryClient {
  client: Client;
  auth: BaseOauthClient;
  ontologyRid: string;
  url: string;
  getUser: () => Promise<FoundryUser>;
  getToken: () => Promise<string>;
}

export interface RangrClient {
  client: Client;
  auth: BaseOauthClient;
  ontologyRid: string;
  url: string;
  getUser: () => Promise<User>;
  getToken: () => Promise<string>;
}

export interface GasScenarioResult {
  date: string;
  baselinePrice: number;
  scenarioPrice: number;
  deltaVsBaseline: number;
  annualIncrementalCostBn: number;
  pctOfCaGdp: number;
  impliedUsGdpDrag: number;
}

export interface EIAResponse {
  response?: {
    data?: Array<{
      period: string;
      value: string;
    }>;
  };
}

export interface VegaGasTrackerData {
  $schema: string;
  description: string;
  data: {
    name: string;
    values: Array<{
      date: string;
      scenario: number;
      delta: number;
      annualCost: number;
      pctOfCaGdp: number;
      usGdpDrag: number;
    }>;
  };
  mark: string;
  encoding: {
    x: {
      field: string;
      type: string;
      title: string;
    };
    y: {
      field: string;
      type: string;
      title: string;
    };
    tooltip: Array<{
      field: string;
      type: string;
      title: string;
    }>;
  };
}

// Basic example of calling other services besides Foundry.
export type EnergyService = {
  read: (
    scenarioPrices?: number[],
    caGallonsYearn?: number,
    caGdp?: number,
    caShareUsGdp?: number
  ) => Promise<GasScenarioResult[]>;
  getVegaChartData: (results: GasScenarioResult[]) => VegaGasTrackerData;
};

export interface WeatherService {
  (city: string): Promise<string>;
}

export interface GeminiSearchStockMarket {
  (userQuery: string): Promise<string>;
}

export interface APIError extends Error {
  response?: {
    data: any;
  };
}

export interface ModuleConfig {
  isTest?: boolean;
}

export interface TestModule {
  listeners: Record<string, any>;
  on(event: string, handler: Function): TestModule;
  register(operation: string, handler: Function): TestModule;
}

export type ComputeModuleType = TestModule | ComputeModule<any>;

export interface GreetingInput {
  message: string;
  userId: string;
}

export interface GreetingResult {
  id: string;
  greeting: string;
}

export interface User {
  id: string;
  username: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  organization?: string;
  attributes: Record<string, any>;
}

export interface MachineExecutions {
  /** Current State */
  /** holds the current state of the state machine */
  currentState: string | undefined;
  /** Id */
  /** The uuid of the machine execution. It uniquely identifies the machine. */
  readonly id: string;
  /** Logs */
  /** Holds the execution logs from a machine execution. The logs are generated by the TypeScript functions */
  logs: string | undefined;
  /** Machine */
  /** Holds the state machine generated for the solution. The machine is a JSON string using the x-reason JSON schema. */
  machine: string | undefined;
  /** State */
  /** The current state of the state machine execution */
  state: string | undefined;
  /** The mutex used for distributed locks. This prevents things like infinite loops when resolving meeting conflicts */
  lockOwner?: string;
  /** The time expire of the lock */
  lockUntil?: number;
}

export interface Communications {
  /** Channel */
  channel: string | undefined;
  /** Completion Error Task List */
  completionErrorTaskList: string | undefined;
  /** Created On */
  createdOn: number | undefined;
  /** Formatted Message */
  formattedMessage: string | undefined;
  /** Id */
  readonly id: string;
  /** Machine */
  /** Holds the generated state machine for the given task list */
  machine: string | undefined;
  /** Owner */
  owner: string | undefined;
  /** Question Prompt */
  questionPrompt: string | undefined;
  /** Status */
  /** The current status of the tasks to perform. Must be one of Open, Accepted, or Rejected */
  status: string | undefined;
  /** Task List */
  taskList: string | undefined;
  /** Tokens */
  tokens: number | undefined;
  /** type */
  type: string | undefined;
}

export interface Threads {
  /** appId */
  appId: string | undefined;
  /** id */
  readonly id: string;
  /** messages */
  messages: string | undefined;
  /** userId */
  userId: string | undefined;
}

/** Holds rfp requests */
export interface RfpRequests {
  /** Created On */
  createdOn: number;
  /** id */
  readonly id: string;
  /** machineExecutionId */
  machineExecutionId: string | undefined;
  /** rfp */
  rfp: string | undefined;
  /** rfpResponse */
  rfpResponse: string | undefined;
  /** rfpResponseStatus Contains the response status, ie 200, 400, 401, 404, 500 etc*/
  rfpResponseStatus: number | undefined;
  /** vendorId */
  vendorId: string | undefined;
}

export interface Tickets {
  /** Ticket Id */
  readonly alertId: string;
  /** Ticket Title */
  alertTitle: string | undefined;
  /** Ticket Type */
  alertType: string | undefined;
  /** Assignee */
  assignees: string | undefined;
  /** createdOn */
  createdOn: number;
  /** Description */
  description: string | undefined;
  /** Machine */
  /** Holds the generated state machine based on the Task List */
  machine: string | undefined;
  /** modifiedOn */
  modifiedOn: number;
  /** points */
  points: number;
  /** Severity */
  severity: string | undefined;
  /** Status */
  status: string | undefined;
}

/** This is the object type for all names of partners, palantir and customers */
export interface Contacts {
  /** This is an array that stores the key CodeStrap contacts and aligns to the relationship status array. */
  codestrapPoc: ReadonlyArray<string> | undefined;
  /** Company */
  /** This property is the company the individual works at directly. This is the employer or the company they run/own. */
  company: string | undefined;
  /** Contact Category */
  /** This stores the values in three categories: Palantir, Partner, or Client. Palantir stores all objects for individuals who work at Palantir. Partner stores all objects for individuals who work at a partner organization (e.g., Northslope, PwC, Axis, Rangr). Client stores all objects for individuals who work at a client or customer. */
  contactCategory: string | undefined;
  /** Country Of Residence */
  /** This is where this person's home is located and where they are located. It can be used for scheduling for timezones as well. */
  countryOfResidence: string | undefined;
  /** Email */
  /** This is the individual's email address, used for direct communication. */
  email: string | undefined;
  /** Executive Assistant */
  /** This is someone who can help schedule meetings for this person */
  executiveAssistant: string | undefined;
  /** First Name */
  /** This is the individual's first name. */
  firstName: string | undefined;
  /** Full Name */
  /** This is the full name of the individual that combines the First Name and the Last Name of the individual. */
  fullName: string | undefined;
  /** Key Accounts */
  /** These are the key accounts we know these individuals work on and may lead from a relationship perspective */
  keyAccounts: string | undefined;
  /** Last Name */
  /** This is the individual's last name. */
  lastName: string | undefined;
  /** LinkedIn */
  /** This is the individual's profile on the social media site LinkedIn. */
  linkedIn: string | undefined;
  /** Notes */
  /** These are all the notes from everyone for this client. This will be the starting point for SalesForge, the notes were */
  notes: ReadonlyArray<string> | undefined;
  /** Phone Number Main */
  /** This is the phone number most used by the individual and should be used for the main reach out from calling and texting. */
  phoneNumberMain: string | undefined;
  /** Phone Number Secondary */
  /** This is the phone number used as a backup by the individual and should be used only when Phone Number Main is NOT successful */
  phoneNumberSecondary: string | undefined;
  /** Primary Key */
  /** This is the primary key derived from concatenating the full name of the individual and their email */
  readonly primaryKey_: string;
  /** Relationship Status */
  /** This is an array that stores the relationship status aligned to the CodeStrap poc stored in the same order. */
  relationshipStatus: ReadonlyArray<string> | undefined;
  /** Role */
  /** This is the individual's job title or role they hold at the Company they work for or manage */
  role: string | undefined;
  /** Talks To */
  /** These are the people the individual talks to and is the main point of contact */
  talksTo: string | undefined;
}

/** Used for retrieving relevant context for LLMs */
export interface MemoryRecall {
  /** Created On */
  createdOn: number;
  /** Id */
  readonly id: string;
  /** Original Text */
  originalText: string | undefined;
  /** Source */
  source: string | undefined;
  /** User Id */
  userId: string | undefined;
}

/** Holds the training data for all X-Reasons */
export interface TrainingData {
  /** Human Review */
  humanReview: string | undefined;
  /** Is Good */
  isGood: boolean | undefined;
  /** Machine */
  machine: string | undefined;
  /** Primary Key */
  readonly primaryKey_: string;
  /** Solution */
  solution: string | undefined;
  /** type */
  /** Either programmer or solver type. */
  type: string | undefined;
  /** X-Reason */
  xReason: string | undefined;
}

export type ListCalendarArgs = {
  calendar: calendar_v3.Calendar;
  emails: string[]; // calendars to query (primary)
  timezone: string; // e.g. "America/Los_Angeles"
  windowStartLocal: Date; // PT wall clock
  windowEndLocal: Date; // PT wall clock
};

export type EventSummary = {
  id: string;
  subject: string;
  description?: string;
  start: string; // local ISO with offset, e.g. 2025-07-22T10:30:00-07:00
  end: string; // same format
  durationMinutes: number;
  participants: string[]; // attendee email list
  meetingLink?: string; // Meet/Zoom/Teams link if found
};

export type CalendarSummary = {
  email: string;
  events: EventSummary[];
};

export type Summaries = {
  message: string;
  calendars: CalendarSummary[];
};

export type VersionControlService = {
  getFile: (params: {
    owner: string;
    repo: string;
    path: string;
    ref?: string; // branch/tag/SHA
  }) => Promise<{
    sha: string;
    size: number;
    encoding: string;
    content: Buffer<ArrayBuffer>;
    path: string;
  }>;
  checkinFile: (params: {
    owner: string;
    repo: string;
    path: string;
    message: string;
    content: string | Buffer;   // raw content, will be base64-encoded
    branch?: string;
    sha?: string;               // required for updates
    committer?: { name: string; email: string };
    author?: { name: string; email: string };
  }) => Promise<{
    content: {
      path: string | undefined;
      sha: string | undefined;
      size: number | undefined;
      url: string | undefined;
    };
    commit: {
      sha: string | undefined;
      url: string | undefined;
    };
  }>;
};

export type OfficeService = {
  getAvailableMeetingTimes: (
    meetingRequest: MeetingRequest
  ) => Promise<FindOptimalMeetingTimeOutput>;
  scheduleMeeting: (meeting: CalendarContext) => Promise<ScheduleMeetingOutput>;
  sendEmail: (email: EmailContext) => Promise<SendEmailOutput>;
  readEmailHistory: (
    context: ReadEmailHistoryContext
  ) => Promise<ReadEmailOutput>;
  watchEmails: (context: WatchEmailsInput) => Promise<WatchEmailsOutput>;
};

export type OfficeServiceV2 = {
  summarizeCalendars: (args: {
    emails: string[];
    timezone: string;
    windowStartLocal: Date;
    windowEndLocal: Date;
  }) => Promise<Summaries>;
  searchDriveFiles: (params: DriveSearchParams) => Promise<DriveSearchOutput>;
  getDriveClient: () => drive_v3.Drive;
} & OfficeServiceV1;

// V1 Google Workspace service surface (Calendar + Gmail operations and raw clients)
export type OfficeServiceV1 = {
  getCalendarClient: () => calendar_v3.Calendar;
  getEmailClient: () => gmail_v1.Gmail;
} & OfficeService;

// Backward-compatible alias (historical name kept to avoid breaking imports)
export type GSuiteCalendarService = OfficeServiceV1;

export type MessageService = {
  sendMessage: (message: Message) => Promise<MessageResponse>;
};

// Service Account Credentials for Google APIs
export type ServiceAccountCredentials = {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
};

// Google Drive Search Types

/**
 * Common MIME types for Google Drive files
 * Use these constants instead of file extensions for more accurate results
 */
export const DRIVE_MIME_TYPES = {
  // Documents
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  DOC: 'application/msword',
  TXT: 'text/plain',

  // Spreadsheets
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  XLS: 'application/vnd.ms-excel',
  CSV: 'text/csv',

  // Presentations
  PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  PPT: 'application/vnd.ms-powerpoint',

  // Images
  JPG: 'image/jpeg',
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  GIF: 'image/gif',
  SVG: 'image/svg+xml',

  // Google Workspace Files
  GOOGLE_DOC: 'application/vnd.google-apps.document',
  GOOGLE_SHEET: 'application/vnd.google-apps.spreadsheet',
  GOOGLE_SLIDE: 'application/vnd.google-apps.presentation',
  GOOGLE_FORM: 'application/vnd.google-apps.form',
  GOOGLE_DRAWING: 'application/vnd.google-apps.drawing',

  // Archives
  ZIP: 'application/zip',
  RAR: 'application/x-rar-compressed',

  // Audio/Video
  MP4: 'video/mp4',
  MP3: 'audio/mpeg',
  WAV: 'audio/wav',
} as const;

/**
 * Date field types for Google Drive search
 */
export enum DriveDateField {
  CREATED_TIME = 'createdTime',
  MODIFIED_TIME = 'modifiedTime',
}

/**
 * Safe ordering fields and formats for Drive file queries.
 */
export type DriveOrderField =
  | 'modifiedTime'
  | 'createdTime'
  | 'viewedByMeTime'
  | 'name';
export type SortDir = 'asc' | 'desc';
export type DriveOrderBy = DriveOrderField | `${DriveOrderField} ${SortDir}`;

// DriveFile interface
export interface DriveFile {
  id: string; // Unique file ID
  name: string; // File name
  mimeType: string; // File MIME type
  size?: string; // File size in bytes
  createdTime?: string; // Creation timestamp
  modifiedTime?: string; // Last modification timestamp
  webViewLink?: string; // Link to view file in Drive
  webContentLink?: string; // Direct download link
  owners?: Array<{
    // File owners
    displayName?: string;
    emailAddress?: string;
  }>;
  lastModifyingUser?: {
    // Last user who modified
    displayName?: string;
    emailAddress?: string;
  };
  parents?: string[]; // Parent folder IDs
  description?: string; // File description
  starred?: boolean; // Whether file is starred
  trashed?: boolean; // Whether file is trashed
}

export interface DriveSearchParams {
  keywords?: string[];
  dateRange?: {
    startDate?: Date;
    endDate?: Date;
    field?: DriveDateField;
  };
  mimeType?: string;
  owner?: string;
  sharedWithMe?: boolean;
  trashed?: boolean;
  pageSize?: number;
  pageToken?: string;
  orderBy?: DriveOrderBy;
  fields?: string;
}

export interface DriveSearchResult {
  files: DriveFile[];
  nextPageToken?: string;
  incompleteSearch?: boolean;
}

export interface DriveSearchOutput {
  message: string;
  files: DriveFile[];
  totalResults: number;
  nextPageToken?: string;
  incompleteSearch?: boolean;
}

export type LoggingService = {
  getLog: (executionId: string) => string;
  log: (executionId: string, message: string) => void;
};

export type RfpResponsesResult = {
  allResponsesReceived: boolean;
  vendors: string[];
};

/** Holds rfp responses */
export type RfpRequestResponse = {
  status: number;
  message: string;
  machineExecutionId: string;
  vendorName: string;
  vendorId: string;
  received: boolean;
  response?: string;
  error?: string;
  receipt?: {
    id: string;
    timestamp: Date;
  };
};

// Receipt sent back to vendors when their response is recorded
export type RfpResponseReceipt = {
  status: number;
  message: string;
  machineExecutionId: string;
  error?: string;
  reciept?: {
    id: string;
    timestamp: number;
  };
};

export type TicketsDao = {
  upsert: (
    id: string,
    alertTitle: string,
    alertType: string,
    description: string,
    severity: string,
    status: string,
    points?: number,
    assignees?: string
  ) => Promise<Tickets>;
  delete: (id: string) => Promise<void>;
  read: (id: string) => Promise<Tickets>;
};

export type WorldDao = (input: GreetingInput) => Promise<GreetingResult>;

export type UserDao = (userId?: string) => Promise<User>;

export type MachineDao = {
  upsert: (
    id: string,
    stateMachine: string,
    state: string,
    logs: string,
    lockOwner?: string,
    lockUntil?: number
  ) => Promise<MachineExecutions>;
  delete: (machineExecutionId: string) => Promise<void>;
  read: (machineExecutionId: string) => Promise<MachineExecutions>;
};

export type TelemetryDao = (inputJSON: string) => Promise<string>;

export type CommsDao = {
  upsert: (
    channel: string,
    formattedMessage: string,
    status: string,
    taskList: string,
    comType: string,
    owner: string,
    questionPrompt?: string,
    tokens?: number,
    id?: string
  ) => Promise<Communications>;
  delete: (id: string) => Promise<void>;
  read: (id: string) => Promise<Communications>;
};

export type ThreadsDao = {
  upsert: (messages: string, appId: string, id?: string) => Promise<Threads>;
  delete: (id: string) => Promise<void>;
  read: (id: string) => Promise<Threads>;
  listAll?: () => Promise<Threads[]>;
};

export type RfpRequestsDao = {
  upsert: (
    rfp: string,
    rfpVendorResponse: string,
    vendorId: string,
    machineExecutionId: string,
    id?: string,
    rfpResponseStatus?: number
  ) => Promise<RfpRequests>;
  delete: (id: string) => Promise<void>;
  read: (id: string) => Promise<RfpRequests>;
  search: (
    machineExecutionId: string,
    vendorId: string
  ) => Promise<RfpRequests>;
};

export type RangrRequestsDao = {
  submit: (
    rfp: string,
    machineExecutionId: string
  ) => Promise<RfpRequestResponse>;
};

export type MemoryRecallDao = {
  upsert: (
    id: string,
    originalText: string,
    source: string,
    userId?: string
  ) => Promise<MemoryRecall>;
  delete: (id: string) => Promise<void>;
  read: (id: string) => Promise<MemoryRecall>;
  search: (input: string, kValue: number) => Promise<MemoryRecall[]>;
};

export type TrainingDataDao = {
  upsert: (
    id: string,
    isGood: boolean,
    type: string,
    xReason: string,
    machine?: string,
    solution?: string,
    humanReview?: string
  ) => Promise<TrainingData>;
  delete: (id: string) => Promise<void>;
  read: (id: string) => Promise<TrainingData>;
  search: (xReason: string, type: string) => Promise<TrainingData[]>;
};

export type ContactsDao = {
  upsert: (
    primaryKey_: string,
    email: string,
    firstName: string,
    lastName: string,
    codestrapPoc?: string[],
    company?: string,
    contactCategory?: string,
    countryOfResidence?: string,
    executiveAssistant?: string,
    fullName?: string,
    keyAccounts?: string,
    linkedIn?: string,
    notes?: string[],
    phoneNumberMain?: string,
    phoneNumberSecondary?: string,
    relationshipStatus?: string[],
    role?: string,
    talksTo?: string
  ) => Promise<Contacts>;
  delete: (id: string) => Promise<void>;
  read: (id: string) => Promise<Contacts>;
  search: (
    fullName: string,
    company: string,
    pageSize?: number
  ) => Promise<Contacts[]>;
};

export type GetNextStateResult = {
  value: StateValue;
  theResultOfEachTask: {
    taskName: string;
    taskOutput: any;
  }[];
  orderTheTasksWereExecutedIn: string[];
};

export enum SupportedFoundryClients {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

export type RequestContext = {
  token?: string | null | undefined;
  user?: User | null | undefined;
  requestId?: string | null | undefined;
};

```

- File path: packages/services/google/src/lib/gsuiteClient.v2.ts
- Contents:
```typescript
import {
  MeetingRequest,
  OfficeServiceV2,
  Summaries,
  DriveSearchParams,
  DriveSearchOutput,
} from '@codestrap/developer-foundations-types';
import { makeGSuiteClient } from './gsuiteClient';

import { findOptimalMeetingTimeV2 } from './delegates/findOptimalMeetingTime.v2';
import { deriveWindowFromTimeframe } from './delegates/deriveWindowFromTimeframe';
import { summarizeCalendars } from './delegates/summerizeCalanders';
import { searchDriveFiles } from './delegates/searchDriveFiles';
import { wallClockToUTC, workingHoursUTCForDate } from '@codestrap/developer-foundations-utils';
import { google } from 'googleapis';
import { loadServiceAccountFromEnv, makeGoogleAuth } from './helpers/googleAuth';

export async function makeGSuiteClientV2(
  user: string
): Promise<OfficeServiceV2> {
  const v1Client = await makeGSuiteClient(user);

  const credentials = await loadServiceAccountFromEnv();

  const driveScopes = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
  ];

  const driveAuth = makeGoogleAuth(credentials, driveScopes, user);

  const driveClient = google.drive({ version: 'v3', auth: driveAuth });

  return {
    ...v1Client,
    summarizeCalendars: async (args: {
      emails: string[];
      timezone: string;
      windowStartLocal: Date;
      windowEndLocal: Date;
    }): Promise<Summaries> => {
      const result = await summarizeCalendars({
        ...args,
        calendar: v1Client.getCalendarClient(),
      });

      return result;
    },
    getAvailableMeetingTimes: async (
      meetingRequest: MeetingRequest
    ): Promise<{
      message: string;
      suggested_times: { start: string; end: string; score: number }[];
    }> => {
      // TODO, get the TZ from the user profile
      const timezone = 'America/Los_Angeles';

      // "now" as an absolute UTC instant (portable across machines)
      const nowUTC = new Date();

      // Compute UTC working hours for *today in the target tz* (e.g., 08:00–17:00 local)
      const workingHours = workingHoursUTCForDate(nowUTC, timezone, 8, 17);

      if (meetingRequest.timeframe_context === 'user defined exact date/time') {
        //localDateString
        meetingRequest.localDateString = wallClockToUTC(meetingRequest.localDateString!, timezone).toISOString();
      }

      // Ensure the request carries the UTC hours we just computed
      const req = { ...meetingRequest, working_hours: workingHours };

      console.log(`calling deriveWindowFromTimeframe`, { req, timezone, nowUTC: nowUTC.toISOString() });

      const { windowStartLocal, windowEndLocal, slotStepMinutes } =
        deriveWindowFromTimeframe(req);
      console.log(`deriveWindowFromTimeframe returned start time of ${windowStartLocal} and end time of ${windowEndLocal}`)

      const slots = await findOptimalMeetingTimeV2({
        calendar: v1Client.getCalendarClient(),
        attendees: meetingRequest.participants,
        timezone,
        windowStartUTC: windowStartLocal,
        windowEndUTC: windowEndLocal,
        durationMinutes: meetingRequest.duration_minutes,
        workingHours,
        slotStepMinutes,
        skipFriday: false,
      });

      const suggested_times = slots.map((s) => ({
        start: s.start,
        end: s.end,
        score: s.score ?? 0,
      }));

      return {
        message: `Found ${suggested_times.length} suggested times`,
        suggested_times,
      };
    },
    searchDriveFiles: async (params: DriveSearchParams): Promise<DriveSearchOutput> => {
      const result = await searchDriveFiles(driveClient, params);

      return {
        message: `Found ${result.files.length} files matching your search criteria`,
        files: result.files,
        totalResults: result.files.length,
        nextPageToken: result.nextPageToken,
        incompleteSearch: result.incompleteSearch,
      };
    },
    getDriveClient: () => driveClient,
  };
}

```

- File path: packages/services/google/src/lib/gsuiteClient.ts
- Contents:
```typescript
import { google } from 'googleapis';
import {
  CalendarContext,
  EmailContext,
  FindOptimalMeetingTimeOutput,
  OfficeServiceV1,
  MeetingRequest,
  ReadEmailHistoryContext,
  ScheduleMeetingOutput,
  SendEmailOutput,
  WatchEmailsInput,
} from '@codestrap/developer-foundations-types';
import { findOptimalMeetingTime } from './delegates/findOptimalMeetingTime';
import { scheduleMeeting } from './delegates/scheduleMeeting';
import { sendEmail } from './delegates/sendEmail';
import { readEmailHistory } from './delegates/readEmailHistory';
import { watchEmails } from './delegates/watchEmails';
import { loadServiceAccountFromEnv, makeGoogleAuth } from './helpers/googleAuth';

export enum GSUITE_SCOPES {
  CALENDAR_READ = 'https://www.googleapis.com/auth/calendar.readonly',
  CALENDAR_WRITE = 'https://www.googleapis.com/auth/calendar.events',
  CALENDAR_FREEBUSY = 'https://www.googleapis.com/auth/calendar.freebusy',
  CALENDAR_ALL = 'https://www.googleapis.com/auth/calendar',
  GMAIL_SEND = 'https://www.googleapis.com/auth/gmail.send',
  GMAIL_READ = 'https://www.googleapis.com/auth/gmail.readonly',
  GMAIL_META = 'https://www.googleapis.com/auth/gmail.metadata',
  GMAIL_MODIFY = 'https://www.googleapis.com/auth/gmail.modify',
}

async function makeClient(user: string) {
  console.log(`Creating client for user: ${user}`);
  // load the service account one time
  const credentials = await loadServiceAccountFromEnv();

  const mailScopes: GSUITE_SCOPES[] = [
    GSUITE_SCOPES.GMAIL_SEND,
    GSUITE_SCOPES.CALENDAR_READ,
    GSUITE_SCOPES.GMAIL_READ,
  ];

  const calendarScopes: GSUITE_SCOPES[] = [
    GSUITE_SCOPES.CALENDAR_ALL,
    GSUITE_SCOPES.CALENDAR_FREEBUSY,
    GSUITE_SCOPES.CALENDAR_READ,
    GSUITE_SCOPES.CALENDAR_WRITE,
  ];

  const emailAuth = makeGoogleAuth(credentials, mailScopes, user);
  const calAuth = makeGoogleAuth(credentials, calendarScopes, user);

  const mailClient = await emailAuth.getClient();
  const calClient = await calAuth.getClient();

  if (!mailClient.getRequestHeaders || !calClient.getRequestHeaders) {
    throw new Error('Invalid auth client - missing methods');
  }

  const calendarClient = google.calendar({ version: 'v3', auth: calAuth });
  const emailClient = google.gmail({ version: 'v1', auth: emailAuth });

  return { emailClient, calendarClient };
}

export async function makeGSuiteClient(
  user: string
): Promise<OfficeServiceV1> {
  const { emailClient, calendarClient } = await makeClient(user);

  return {
    getAvailableMeetingTimes: async (
      meetingRequest: MeetingRequest
    ): Promise<FindOptimalMeetingTimeOutput> => {
      const result = await findOptimalMeetingTime(
        calendarClient,
        meetingRequest
      );

      return result;
    },
    scheduleMeeting: async (
      meeting: CalendarContext
    ): Promise<ScheduleMeetingOutput> => {
      const result = await scheduleMeeting(calendarClient, meeting);

      return result;
    },
    sendEmail: async (email: EmailContext): Promise<SendEmailOutput> => {
      const result = await sendEmail(emailClient, email);

      return result;
    },
    readEmailHistory: async (context: ReadEmailHistoryContext) => {
      const { emailClient } = await makeClient(context.email);
      const result = await readEmailHistory(emailClient, context);

      return {
        messages: result,
      };
    },
    watchEmails: async (context: WatchEmailsInput) => {
      // we pass makeClient because this operations requires scoped clients to the user's email!
      const result = await watchEmails(context, makeClient);

      return result;
    },
    getCalendarClient: () => calendarClient,
    getEmailClient: () => emailClient,
  };
}

```

- File path: packages/services/google/src/lib/delegates/summerizeCalanders.ts
- Contents:
```typescript
// types/summarizeCalendars.ts
import { calendar_v3 } from 'googleapis';
import {
  toZonedISOString,
  toUTCFromWallClockLocal,
} from '@codestrap/developer-foundations-utils';
import {
  CalendarSummary,
  EventSummary,
  ListCalendarArgs,
  Summaries,
} from '@codestrap/developer-foundations-types';

/* ----------------------------------------------------------------------- */

function extractMeetingLink(evt: calendar_v3.Schema$Event): string | undefined {
  // Google Meet
  if (evt.hangoutLink) return evt.hangoutLink;
  // 3P links in description or location
  const text = `${evt.summary ?? ''} ${evt.description ?? ''} ${evt.location ?? ''}`;
  const regex =
    /(https?:\/\/[^\s]*?(zoom\.us|teams\.microsoft\.com|meet\.google\.com|gotomeet\.|webex\.com)[^\s]*)/i;
  const m = text.match(regex);
  return m ? m[1] : undefined;
}

async function fetchCalendar(
  cal: calendar_v3.Calendar,
  email: string,
  timeMin: string,
  timeMax: string,
  tz: string
): Promise<CalendarSummary> {
  const events: EventSummary[] = [];
  let pageTok: string | undefined;

  do {
    const res = await cal.events.list({
      calendarId: email,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      pageToken: pageTok,
    });

    (res.data.items ?? []).forEach((evt) => {
      if (!evt.start?.dateTime || !evt.end?.dateTime) return;

      const startUTC = new Date(evt.start.dateTime);
      const endUTC = new Date(evt.end.dateTime);
      if (isNaN(startUTC.getTime()) || isNaN(endUTC.getTime())) return;

      const dur = (endUTC.getTime() - startUTC.getTime()) / 60000;

      events.push({
        id: evt.id!,
        subject: evt.summary ?? '',
        description: evt.description ?? undefined,
        start: toZonedISOString(startUTC, tz),
        end: toZonedISOString(endUTC, tz),
        durationMinutes: Math.round(dur),
        participants: (evt.attendees ?? []).map((a) => a.email!).filter(Boolean),
        meetingLink: extractMeetingLink(evt),
      });
    });

    pageTok = res.data.nextPageToken ?? undefined;
  } while (pageTok);

  return { email, events };
}

export async function summarizeCalendars(
  args: ListCalendarArgs
): Promise<Summaries> {
  const { calendar, emails, timezone, windowStartLocal, windowEndLocal } = args;

  // Convert local wall-clock bounds to UTC instants using your utils.
  const timeMin = toUTCFromWallClockLocal(windowStartLocal, timezone).toISOString();
  const timeMax = toUTCFromWallClockLocal(windowEndLocal, timezone).toISOString();

  console.log(`summarizeCalendars fetchCalendar for timeMin ${timeMin} timeMax ${timeMax}`);

  // Kick off all fetches in parallel
  const settled = await Promise.allSettled(
    emails.map((email) => fetchCalendar(calendar, email, timeMin, timeMax, timezone))
  );

  // Split successes / failures
  const calendars: CalendarSummary[] = [];
  const failures: string[] = [];

  settled.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      calendars.push(result.value);
    } else {
      failures.push(`${emails[idx]}: ${result.reason?.message ?? 'unknown error'}`);
    }
  });

  const eventCount = calendars.reduce((n, c) => n + c.events.length, 0);
  const message =
    failures.length === 0
      ? `Fetched ${eventCount} events`
      : `Fetched ${eventCount} events; ${failures.length} calendar(s) failed`;

  return { message, calendars };
}

```

- File path: packages/services/palantir/src/lib/geminiService.ts
- Contents:
```typescript
import {
  SupportedFoundryClients,
  type GeminiParameters,
} from '@codestrap/developer-foundations-types';
import { foundryClientFactory } from "./factory/foundryClientFactory";

export async function geminiService(
  user: string,
  system: string,
  params?: GeminiParameters
): Promise<string> {
  const { getToken, url, ontologyRid } = foundryClientFactory(process.env.FOUNDRY_CLIENT_TYPE || SupportedFoundryClients.PRIVATE, undefined);

  const apiKey = await getToken();

  const fullUrl = `${url}/api/v2/ontologies/${ontologyRid}/queries/gemniFlash20Proxy/execute`;

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const body = JSON.stringify({
    parameters: {
      user,
      system,
      params,
    },
  });

  const apiResult = await fetch(fullUrl, {
    method: 'POST',
    headers: headers,
    body: body,
  });

  const result = (await apiResult.json()) as any;

  return result.value as string;
}

```

