## Overview

The Google services package wraps Google APIs (`import { google } from 'googleapis';`) in our Office Service (OfficeServiceV2, OfficeServiceV1) interfaces. These interfaces are injected into other parts of our application stack with inversify. This injection is always async to handle scoping the client:

```typescript
// injection example
const officeService = await container.getAsync<OfficeService>(
  TYPES.OfficeService,
);
```

Excerpt for google client setup:

```typescript
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
```

The delegates directory (`packages/services/google/src/lib/delegates`) is where we store delegates. Delegates are just a way to keep code more readable in our office clients. This is where the actual operations with the APIs are typically performed like sending emails, searching drive, etc.

When modifying an OfficeService function or adding a new one to the interface you will have to modify or create the backing delegate. Delegates are listed below along with their exported functions.

## Root Directory and Layout

Project root: packages/services/google
File tree and exported symbols:
packages/services/google/src/lib/gsuiteClient.v2.ts
└─ makeGSuiteClientV2
packages/services/google/src/lib/gsuiteClient.ts
└─ makeGSuiteClient
└─ GSUITE_SCOPES
packages/services/google/src/lib/delegates/findOptimalMeetingTime.v2.ts
└─ findOptimalMeetingTimeV2
└─ Slot
└─ FindArgs
packages/services/google/src/lib/delegates/deriveWindowFromTimeframe.ts
└─ deriveWindowFromTimeframe
packages/services/google/src/lib/delegates/summerizeCalanders.ts
└─ summarizeCalendars
packages/services/google/src/lib/delegates/searchDriveFiles.ts
└─ searchDriveFiles
packages/services/google/src/lib/helpers/googleAuth.ts
└─ loadServiceAccountFromEnv
└─ makeGoogleAuth
packages/types/src/lib/types.ts
└─ TYPES
└─ ResearchAssistant
└─ CodingResearchAssistant
└─ CodingArchitect
└─ Schemas
└─ ScheduleMeetingInput
└─ ScheduleMeetingOutput
└─ SendEmailOutput
└─ SendEmailInput
└─ ReadEmailOutput
└─ ReadEmailInput
└─ WatchEmailsOutput
└─ WatchEmailsInput
└─ FindOptimalMeetingTimeInput
└─ FindOptimalMeetingTimeOutput
└─ UserProfile
└─ MessageResponse
└─ Message
└─ EmailConfig
└─ CalendarConfig
└─ Config
└─ WorkingHours
└─ TimeSlot
└─ EmailContext
└─ ReadEmailHistoryContext
└─ CalendarContext
└─ OptimalTimeContext
└─ TimeRange
└─ BusyPeriod
└─ EmailMessage
└─ AvailableTime
└─ ProposedTimes
└─ MeetingRequest
└─ DerivedWindow
└─ Meeting
└─ GeminiParameters
└─ GeminiService
└─ Gpt40Parameters
└─ Gpt4oService
└─ EmbeddingsService
└─ Token
└─ BaseOauthClient
└─ FoundryClient
└─ RangrClient
└─ GasScenarioResult
└─ EIAResponse
└─ VegaGasTrackerData
└─ EnergyService
└─ WeatherService
└─ GeminiSearchStockMarket
└─ APIError
└─ ModuleConfig
└─ TestModule
└─ ComputeModuleType
└─ GreetingInput
└─ GreetingResult
└─ User
└─ MachineExecutions
└─ Communications
└─ Threads
└─ RfpRequests
└─ Tickets
└─ Contacts
└─ MemoryRecall
└─ TrainingData
└─ ListCalendarArgs
└─ EventSummary
└─ CalendarSummary
└─ Summaries
└─ OfficeService
└─ OfficeServiceV2
└─ OfficeServiceV1
└─ GSuiteCalendarService
└─ MessageService
└─ ServiceAccountCredentials
└─ DRIVE_MIME_TYPES
└─ DriveDateField
└─ DriveOrderField
└─ SortDir
└─ DriveOrderBy
└─ DriveFile
└─ DriveSearchParams
└─ DriveSearchResult
└─ DriveSearchOutput
└─ LoggingService
└─ RfpResponsesResult
└─ RfpRequestResponse
└─ RfpResponseReceipt
└─ TicketsDao
└─ WorldDao
└─ UserDao
└─ MachineDao
└─ TelemetryDao
└─ CommsDao
└─ ThreadsDao
└─ RfpRequestsDao
└─ RangrRequestsDao
└─ MemoryRecallDao
└─ TrainingDataDao
└─ ContactsDao
└─ GetNextStateResult
└─ SupportedFoundryClients
└─ RequestContext
packages/types/src/lib/x-reason/types.ts
└─ ActionType
└─ Context
└─ MachineEvent
└─ Transition
└─ Task
└─ StateMachineConfig
└─ Solver
└─ Programer
└─ EvaluationInput
└─ EvaluatorResult
└─ Evaluator
└─ AiTransition
└─ Prompt
└─ ReasoningEngine
└─ ICallable
└─ InterpreterInput
└─ Interpreter
└─ StateConfig
└─ Result
└─ Workflow
└─ Solutions
└─ SystemStatus
packages/services/google/src/lib/delegates/findOptimalMeetingTime.ts
└─ findOptimalMeetingTime
packages/services/google/src/lib/delegates/scheduleMeeting.ts
└─ scheduleMeeting
packages/services/google/src/lib/delegates/sendEmail.ts
└─ sendEmail
packages/services/google/src/lib/delegates/readEmailHistory.ts
└─ readEmailHistory
packages/services/google/src/lib/delegates/watchEmails.ts
└─ watchEmails
packages/utils/src/lib/Extractors.ts
└─ extractJsonFromBackticks
└─ extractHtmlFromBackticks
└─ cleanJsonString
packages/utils/src/lib/date.ts
└─ formatIsoDateStringForLocalDate
packages/utils/src/lib/logCollector.ts
└─ getLogger
packages/utils/src/lib/sanitizers.ts
└─ sanitizeJSONString
packages/utils/src/lib/StateMachines.ts
└─ getUniqueStateIds
packages/utils/src/lib/uuid.ts
└─ uuidv4
packages/utils/src/lib/Markdown.ts
└─ generateMarkdownTable
packages/utils/src/lib/Vectors.ts
└─ dotProduct
packages/utils/src/lib/loggingService.ts
└─ createLoggingService
packages/utils/src/lib/utc.ts
└─ partsInTZ
└─ toZonedISOString
└─ toUTCFromWallClockLocal
└─ wallClockToUTC
└─ workingHoursUTCForDate
└─ dowInTZ
└─ mondayOfWeek
└─ fridayOfWeek
└─ dayInTZ
└─ detectIanaTimeZone

## Public API (Exports) <!-- anchor: public_api -->

| export                            | kind     | signature                                                                                                                                                                                                                                                                                                  | description                                                                                                                                                                                                                                                                                     |
| --------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `makeGSuiteClientV2`              | function | `function makeGSuiteClientV2(user: string) => Promise<OfficeServiceV2>`                                                                                                                                                                                                                                    |                                                                                                                                                                                                                                                                                                 |
| `makeGSuiteClient`                | function | `function makeGSuiteClient(user: string) => Promise<OfficeServiceV1>`                                                                                                                                                                                                                                      |                                                                                                                                                                                                                                                                                                 |
| `findOptimalMeetingTimeV2`        | function | `function findOptimalMeetingTimeV2({ calendar, attendees, timezone, windowStartUTC, windowEndUTC, durationMinutes, workingHours, slotStepMinutes, skipFriday, }: FindArgs) => Promise<Slot[]>`                                                                                                             |                                                                                                                                                                                                                                                                                                 |
| `deriveWindowFromTimeframe`       | function | `function deriveWindowFromTimeframe(req: MeetingRequest, now?: Date) => DerivedWindow`                                                                                                                                                                                                                     | /\*\* _ Derive a scheduling window from a MeetingRequest. _ _ Assumptions: _ - All input instants and strings are UTC. _ - All computations use UTC getters/setters (host-TZ agnostic). _ _ @param req Meeting request _ @param now "Now" (defaults to system clock; must be a UTC instant) \*/ |
| `summarizeCalendars`              | function | `function summarizeCalendars(args: ListCalendarArgs) => Promise<Summaries>`                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                 |
| `searchDriveFiles`                | function | `function searchDriveFiles(driveClient: drive_v3.Drive, params: DriveSearchParams) => Promise<DriveSearchResult>`                                                                                                                                                                                          | /\*\* _ Searches for files in Google Drive based on the provided parameters _ @param driveClient - The Google Drive API client _ @param params - The search parameters _ @returns Promise resolving to search results \*/                                                                       |
| `extractJsonFromBackticks`        | function | `function extractJsonFromBackticks(text: string) => string`                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                 |
| `extractHtmlFromBackticks`        | function | `function extractHtmlFromBackticks(text: string) => string`                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                 |
| `cleanJsonString`                 | function | `function cleanJsonString(src: string) => string`                                                                                                                                                                                                                                                          |                                                                                                                                                                                                                                                                                                 |
| `formatIsoDateStringForLocalDate` | function | `function formatIsoDateStringForLocalDate(date: Date) => string`                                                                                                                                                                                                                                           |                                                                                                                                                                                                                                                                                                 |
| `getLogger`                       | function | `function getLogger() => { getLog: () => string; log: (message: string) => string; }`                                                                                                                                                                                                                      |                                                                                                                                                                                                                                                                                                 |
| `sanitizeJSONString`              | function | `function sanitizeJSONString(input: string) => string`                                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                 |
| `getUniqueStateIds`               | function | `function getUniqueStateIds(inputArray: StateConfig[], parent?: StateConfig) => StateConfig[]`                                                                                                                                                                                                             |                                                                                                                                                                                                                                                                                                 |
| `uuidv4`                          | function | `function uuidv4() => string`                                                                                                                                                                                                                                                                              |                                                                                                                                                                                                                                                                                                 |
| `generateMarkdownTable`           | function | `function generateMarkdownTable(jsonData: Record<string, any>[]) => string`                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                 |
| `dotProduct`                      | function | `function dotProduct(arr1: K[], arr2: K[]) => number`                                                                                                                                                                                                                                                      |                                                                                                                                                                                                                                                                                                 |
| `createLoggingService`            | function | `function createLoggingService(perExecBytes?: number, globalBytes?: number, now?: () => number) => { log: (executionId: string, message: string) => void; getLog: (executionId: string) => string; __debug: () => { executionIds: string[]; totalBytes: number; bufferBytes: (id: string) => number; }; }` |                                                                                                                                                                                                                                                                                                 |
| `partsInTZ`                       | function | `function partsInTZ(d: Date, tz: string) => { year: number; month: number; day: number; hour: number; minute: number; second: number; }`                                                                                                                                                                   | /\*_ Extract Y/M/D/h/m/s as seen in `tz` for a given UTC instant. _/                                                                                                                                                                                                                            |
| `toZonedISOString`                | function | `function toZonedISOString(utc: Date, tz: string) => string`                                                                                                                                                                                                                                               | /\*_ Render the SAME UTC instant as local time in `tz` with ±HH:MM suffix. _/                                                                                                                                                                                                                   |
| `toUTCFromWallClockLocal`         | function | `function toUTCFromWallClockLocal(wallClock: Date, tz: string) => Date`                                                                                                                                                                                                                                    | /\*_ Build "YYYY-MM-DDTHH:mm:ss" from a wall-clock Date and convert to the UTC instant for `tz`. _/                                                                                                                                                                                             |
| `wallClockToUTC`                  | function | `function wallClockToUTC(isoOrOffsetStr: string, tz: string) => Date`                                                                                                                                                                                                                                      | /\*_ Convert a wall-clock string in `tz` to a UTC instant. _ Supports: _ - ISO no-offset: "YYYY-MM-DDTHH:mm[:ss]" → interpret as wall-clock in `tz` _ - Explicit offset/Z (e.g., "...Z", "...+02:00", "GMT-0700 (...)") → parsed as real instant \*/                                            |
| `workingHoursUTCForDate`          | function | `function workingHoursUTCForDate(baseUTC: Date, tz: string, localStartHour: number, localEndHour: number) => { start_hour: number; end_hour: number; }`                                                                                                                                                    | /\*_ Return UTC-hour numbers for the intended local working hours on the given date. _/                                                                                                                                                                                                         |
| `dowInTZ`                         | function | `function dowInTZ(dUTC: Date, tz: string) => number`                                                                                                                                                                                                                                                       | /\*_ Day-of-week index (0=Sun..6=Sat) for a UTC instant as seen in `tz`. _/                                                                                                                                                                                                                     |
| `mondayOfWeek`                    | function | `function mondayOfWeek(dUTC: Date, tz: string) => Date`                                                                                                                                                                                                                                                    | /\*_ Monday at LOCAL start-hour for the week containing `dUTC` in `tz` → UTC instant. _/                                                                                                                                                                                                        |
| `fridayOfWeek`                    | function | `function fridayOfWeek(dUTC: Date, tz: string) => Date`                                                                                                                                                                                                                                                    | /\*_ Friday at LOCAL end-hour for the week containing `dUTC` in `tz` → UTC instant. _/                                                                                                                                                                                                          |
| `dayInTZ`                         | function | `function dayInTZ(isoWithOffset: string, tz: string) => number`                                                                                                                                                                                                                                            |                                                                                                                                                                                                                                                                                                 |
| `detectIanaTimeZone`              | function | `function detectIanaTimeZone() => string`                                                                                                                                                                                                                                                                  |                                                                                                                                                                                                                                                                                                 |
| `loadServiceAccountFromEnv`       | function | `function loadServiceAccountFromEnv() => Promise<ServiceAccountCredentials>`                                                                                                                                                                                                                               |                                                                                                                                                                                                                                                                                                 |
| `makeGoogleAuth`                  | function | `function makeGoogleAuth(credentials: ServiceAccountCredentials, scopes: string[], user: string) => import("node_modules/google-auth-library/build/src/index").GoogleAuth<import("node_modules/google-auth-library/build/src/auth/googleauth").JSONClient>`                                                |                                                                                                                                                                                                                                                                                                 |
| `findOptimalMeetingTime`          | function | `function findOptimalMeetingTime(calendar: calendar_v3.Calendar, context: OptimalTimeContext) => Promise<FindOptimalMeetingTimeOutput>`                                                                                                                                                                    |                                                                                                                                                                                                                                                                                                 |
| `scheduleMeeting`                 | function | `function scheduleMeeting(calendar: calendar_v3.Calendar, context: CalendarContext) => Promise<ScheduleMeetingOutput>`                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                 |
| `sendEmail`                       | function | `function sendEmail(gmail: gmail_v1.Gmail, context: EmailContext) => Promise<SendEmailOutput>`                                                                                                                                                                                                             |                                                                                                                                                                                                                                                                                                 |
| `readEmailHistory`                | function | `function readEmailHistory(gmail: gmail_v1.Gmail, context: ReadEmailHistoryContext) => Promise<EmailMessage[]>`                                                                                                                                                                                            |                                                                                                                                                                                                                                                                                                 |
| `watchEmails`                     | function | `function watchEmails(context: WatchEmailsInput, makeClient: (userId: string) => Promise<{ emailClient: gmail_v1.Gmail; calendarClient: calendar_v3.Calendar; }>) => Promise<WatchEmailsOutput>`                                                                                                           |                                                                                                                                                                                                                                                                                                 |
| `extractJsonFromBackticks`        | function | `function extractJsonFromBackticks(text: string) => string`                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                 |
| `extractHtmlFromBackticks`        | function | `function extractHtmlFromBackticks(text: string) => string`                                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                 |
| `cleanJsonString`                 | function | `function cleanJsonString(src: string) => string`                                                                                                                                                                                                                                                          |                                                                                                                                                                                                                                                                                                 |
| `formatIsoDateStringForLocalDate` | function | `function formatIsoDateStringForLocalDate(date: Date) => string`                                                                                                                                                                                                                                           |                                                                                                                                                                                                                                                                                                 |
| `getLogger`                       | function | `function getLogger() => { getLog: () => string; log: (message: string) => string; }`                                                                                                                                                                                                                      |                                                                                                                                                                                                                                                                                                 |
| `sanitizeJSONString`              | function | `function sanitizeJSONString(input: string) => string`                                                                                                                                                                                                                                                     |                                                                                                                                                                                                                                                                                                 |
| `getUniqueStateIds`               | function | `function getUniqueStateIds(inputArray: StateConfig[], parent?: StateConfig) => StateConfig[]`                                                                                                                                                                                                             |                                                                                                                                                                                                                                                                                                 |
| `uuidv4`                          | function | `function uuidv4() => string`                                                                                                                                                                                                                                                                              |                                                                                                                                                                                                                                                                                                 |
| `generateMarkdownTable`           | function | `function generateMarkdownTable(jsonData: Record<string, any>[]) => string`                                                                                                                                                                                                                                |                                                                                                                                                                                                                                                                                                 |
| `dotProduct`                      | function | `function dotProduct(arr1: K[], arr2: K[]) => number`                                                                                                                                                                                                                                                      |                                                                                                                                                                                                                                                                                                 |
| `createLoggingService`            | function | `function createLoggingService(perExecBytes?: number, globalBytes?: number, now?: () => number) => { log: (executionId: string, message: string) => void; getLog: (executionId: string) => string; __debug: () => { executionIds: string[]; totalBytes: number; bufferBytes: (id: string) => number; }; }` |                                                                                                                                                                                                                                                                                                 |
| `partsInTZ`                       | function | `function partsInTZ(d: Date, tz: string) => { year: number; month: number; day: number; hour: number; minute: number; second: number; }`                                                                                                                                                                   | /\*_ Extract Y/M/D/h/m/s as seen in `tz` for a given UTC instant. _/                                                                                                                                                                                                                            |
| `toZonedISOString`                | function | `function toZonedISOString(utc: Date, tz: string) => string`                                                                                                                                                                                                                                               | /\*_ Render the SAME UTC instant as local time in `tz` with ±HH:MM suffix. _/                                                                                                                                                                                                                   |
| `toUTCFromWallClockLocal`         | function | `function toUTCFromWallClockLocal(wallClock: Date, tz: string) => Date`                                                                                                                                                                                                                                    | /\*_ Build "YYYY-MM-DDTHH:mm:ss" from a wall-clock Date and convert to the UTC instant for `tz`. _/                                                                                                                                                                                             |
| `wallClockToUTC`                  | function | `function wallClockToUTC(isoOrOffsetStr: string, tz: string) => Date`                                                                                                                                                                                                                                      | /\*_ Convert a wall-clock string in `tz` to a UTC instant. _ Supports: _ - ISO no-offset: "YYYY-MM-DDTHH:mm[:ss]" → interpret as wall-clock in `tz` _ - Explicit offset/Z (e.g., "...Z", "...+02:00", "GMT-0700 (...)") → parsed as real instant \*/                                            |
| `workingHoursUTCForDate`          | function | `function workingHoursUTCForDate(baseUTC: Date, tz: string, localStartHour: number, localEndHour: number) => { start_hour: number; end_hour: number; }`                                                                                                                                                    | /\*_ Return UTC-hour numbers for the intended local working hours on the given date. _/                                                                                                                                                                                                         |
| `dowInTZ`                         | function | `function dowInTZ(dUTC: Date, tz: string) => number`                                                                                                                                                                                                                                                       | /\*_ Day-of-week index (0=Sun..6=Sat) for a UTC instant as seen in `tz`. _/                                                                                                                                                                                                                     |
| `mondayOfWeek`                    | function | `function mondayOfWeek(dUTC: Date, tz: string) => Date`                                                                                                                                                                                                                                                    | /\*_ Monday at LOCAL start-hour for the week containing `dUTC` in `tz` → UTC instant. _/                                                                                                                                                                                                        |
| `fridayOfWeek`                    | function | `function fridayOfWeek(dUTC: Date, tz: string) => Date`                                                                                                                                                                                                                                                    | /\*_ Friday at LOCAL end-hour for the week containing `dUTC` in `tz` → UTC instant. _/                                                                                                                                                                                                          |
| `dayInTZ`                         | function | `function dayInTZ(isoWithOffset: string, tz: string) => number`                                                                                                                                                                                                                                            |                                                                                                                                                                                                                                                                                                 |
| `detectIanaTimeZone`              | function | `function detectIanaTimeZone() => string`                                                                                                                                                                                                                                                                  |                                                                                                                                                                                                                                                                                                 |

## Key Concepts & Data Flow <!-- anchor: concepts_flow -->

We use the framework established by Titus Winters & Hyrum Wright when defining what good tests are:
Correctness - verify the requirements of the system are met. IE executes real scenarios with real inputs.
Readability - Avoid too much bolier plate. Tests should be obvious to the und user. Use the `packages/utils/src/lib/__fixtures__` directory for fixtures.
Completeness - don't just test happy path. Test common inputs and edge cases. Do not test APIs that are not directly owned by the code being tested.
Demonstrability - tests should serve as a demonstration of how the API works.
Resilience - Tests should be deterministic and not depend on things like the time of day or external conditions. Don't write flakey tests.

## Quickstart (Worked Examples from Jest Tests) <!-- anchor: worked_examples -->

- **user defined exact date/time: uses the exact minute and step=1 (inside hours)** — _packages/services/google/src/lib/delegates/deriveWindowFromTimeframe.test.ts_

```ts
it('user defined exact date/time: uses the exact minute and step=1 (inside hours)', () => {
  // 10:10 local → UTC payload
  const candidateUTC = wallClockToUTC('2025-07-22T10:10:00', timezone);
  const nowUTC = wallClockToUTC('2025-07-22T09:00:00', timezone);
  const hoursUTC = workingHoursUTCForDate(
    nowUTC,
    timezone,
    LOCAL_START,
    LOCAL_END,
  );

  const req = buildReq(
    {
      timeframe_context: 'user defined exact date/time',
      localDateString: candidateUTC.toISOString(), // pass UTC instant
      duration_minutes: 30,
    },
    hoursUTC,
  );

  const { windowStartLocal, windowEndLocal, slotStepMinutes } =
    deriveWindowFromTimeframe(req, nowUTC);

  expect(slotStepMinutes).toBe(1);
  expectWallClock(windowStartLocal, timezone, 2025, 7, 22, 10, 10);
  expectWallClock(windowEndLocal, timezone, 2025, 7, 22, 10, 40);
});
```

- **user defined exact date/time: clamps start to start_hour if given before-hours time** — _packages/services/google/src/lib/delegates/deriveWindowFromTimeframe.test.ts_

```ts
it('user defined exact date/time: clamps start to start_hour if given before-hours time', () => {
  const candidateUTC = wallClockToUTC('2025-07-22T07:15:00', timezone);
  const nowUTC = wallClockToUTC('2025-07-22T06:00:00', timezone);
  const hoursUTC = workingHoursUTCForDate(
    nowUTC,
    timezone,
    LOCAL_START,
    LOCAL_END,
  );

  const req = buildReq(
    {
      timeframe_context: 'user defined exact date/time',
      localDateString: candidateUTC.toISOString(),
      duration_minutes: 30,
    },
    hoursUTC,
  );

  const { windowStartLocal, windowEndLocal, slotStepMinutes } =
    deriveWindowFromTimeframe(req, nowUTC);

  expect(slotStepMinutes).toBe(1);
  expectWallClock(windowStartLocal, timezone, 2025, 7, 22, 8, 0);
  expectWallClock(windowEndLocal, timezone, 2025, 7, 22, 8, 30);
});
```

- **as soon as possible: inside working hours → start = now (clamped), end = Friday 17:00 of same week** — _packages/services/google/src/lib/delegates/deriveWindowFromTimeframe.test.ts_

```ts
it('as soon as possible: inside working hours → start = now (clamped), end = Friday 17:00 of same week', () => {
  const nowUTC = wallClockToUTC('2025-07-22T10:05:00', timezone); // Tue
  const hoursUTC = workingHoursUTCForDate(
    nowUTC,
    timezone,
    LOCAL_START,
    LOCAL_END,
  );
  const req = buildReq({ timeframe_context: 'as soon as possible' }, hoursUTC);

  const { windowStartLocal, windowEndLocal, slotStepMinutes } =
    deriveWindowFromTimeframe(req, nowUTC);

  expect(slotStepMinutes).toBe(30);
  expectWallClock(windowStartLocal, timezone, 2025, 7, 22, 10, 5);

  const expectedFri = fridayOfWeek(nowUTC, timezone);
  expect(windowEndLocal.getTime()).toBe(expectedFri.getTime());
});
```

- **as soon as possible: after hours → next business day 08:00, end = Friday 17:00** — _packages/services/google/src/lib/delegates/deriveWindowFromTimeframe.test.ts_

```ts
it('as soon as possible: after hours → next business day 08:00, end = Friday 17:00', () => {
  const nowUTC = wallClockToUTC('2025-07-22T18:10:00', timezone); // Tue after hours
  const hoursUTC = workingHoursUTCForDate(
    nowUTC,
    timezone,
    LOCAL_START,
    LOCAL_END,
  );
  const req = buildReq({ timeframe_context: 'as soon as possible' }, hoursUTC);

  const { windowStartLocal, windowEndLocal } = deriveWindowFromTimeframe(
    req,
    nowUTC,
  );

  // next day 08:00 (Wed) in target tz
  expectWallClock(windowStartLocal, timezone, 2025, 7, 23, 8, 0);

  const expectedFri = fridayOfWeek(nowUTC, timezone);
  expect(windowEndLocal.getTime()).toBe(expectedFri.getTime());
});
```

- **as soon as possible: on Saturday → start Monday 08:00, end Friday 17:00 (next week)** — _packages/services/google/src/lib/delegates/deriveWindowFromTimeframe.test.ts_

```ts
it('as soon as possible: on Saturday → start Monday 08:00, end Friday 17:00 (next week)', () => {
  const nowUTC = wallClockToUTC('2025-07-26T12:00:00', timezone); // Sat
  const hoursUTC = workingHoursUTCForDate(
    nowUTC,
    timezone,
    LOCAL_START,
    LOCAL_END,
  );
  const req = buildReq({ timeframe_context: 'as soon as possible' }, hoursUTC);

  const { windowStartLocal, windowEndLocal } = deriveWindowFromTimeframe(
    req,
    nowUTC,
  );

  // Monday 08:00 (2025-07-28)
  expectWallClock(windowStartLocal, timezone, 2025, 7, 28, 8, 0);

  const expectedFri = fridayOfWeek(
    wallClockToUTC('2025-07-28T09:00:00', timezone),
    timezone,
  );
  expect(windowEndLocal.getTime()).toBe(expectedFri.getTime());
});
```

- **this week: mid-week → start = clamped now, end = Friday 17:00 this week** — _packages/services/google/src/lib/delegates/deriveWindowFromTimeframe.test.ts_

```ts
it('this week: mid-week → start = clamped now, end = Friday 17:00 this week', () => {
  const nowUTC = wallClockToUTC('2025-07-23T07:10:00', timezone); // Wed before hours
  const hoursUTC = workingHoursUTCForDate(
    nowUTC,
    timezone,
    LOCAL_START,
    LOCAL_END,
  );
  const req = buildReq({ timeframe_context: 'this week' }, hoursUTC);

  const { windowStartLocal, windowEndLocal } = deriveWindowFromTimeframe(
    req,
    nowUTC,
  );

  expectWallClock(windowStartLocal, timezone, 2025, 7, 23, 8, 0);
  const expectedFri = fridayOfWeek(nowUTC, timezone);
  expect(windowEndLocal.getTime()).toBe(expectedFri.getTime());
});
```

- **this week: past Friday close → rolls to next week Mon 08:00 → Fri 17:00** — _packages/services/google/src/lib/delegates/deriveWindowFromTimeframe.test.ts_

```ts
it('this week: past Friday close → rolls to next week Mon 08:00 → Fri 17:00', () => {
  const nowUTC = wallClockToUTC('2025-07-25T18:10:00', timezone); // Fri after hours
  const hoursUTC = workingHoursUTCForDate(
    nowUTC,
    timezone,
    LOCAL_START,
    LOCAL_END,
  );
  const req = buildReq({ timeframe_context: 'this week' }, hoursUTC);

  const { windowStartLocal, windowEndLocal } = deriveWindowFromTimeframe(
    req,
    nowUTC,
  );

  const expectedNextMon = mondayOfWeek(
    wallClockToUTC('2025-07-28T00:00:00', timezone),
    timezone,
  ); // 2025-07-28 08:00
  expect(windowStartLocal.getTime()).toBe(expectedNextMon.getTime());

  const expectedNextFri = fridayOfWeek(expectedNextMon, timezone);
  expect(windowEndLocal.getTime()).toBe(expectedNextFri.getTime());
});
```

- **next week: Mon 08:00 next week → Fri 17:00 next week** — _packages/services/google/src/lib/delegates/deriveWindowFromTimeframe.test.ts_

```ts
it('next week: Mon 08:00 next week → Fri 17:00 next week', () => {
  const nowUTC = wallClockToUTC('2025-07-23T10:00:00', timezone); // Wed
  const hoursUTC = workingHoursUTCForDate(
    nowUTC,
    timezone,
    LOCAL_START,
    LOCAL_END,
  );
  const req = buildReq({ timeframe_context: 'next week' }, hoursUTC);

  const { windowStartLocal, windowEndLocal, slotStepMinutes } =
    deriveWindowFromTimeframe(req, nowUTC);

  expect(slotStepMinutes).toBe(30);

  const expectedMon = mondayOfWeek(
    wallClockToUTC('2025-07-28T00:00:00', timezone),
    timezone,
  ); // next week’s Monday 08:00
  expect(windowStartLocal.getTime()).toBe(expectedMon.getTime());

  const expectedFri = fridayOfWeek(expectedMon, timezone);
  expect(windowEndLocal.getTime()).toBe(expectedFri.getTime());
});
```

- **should get an exact time within PT working hours** — _packages/services/google/src/lib/delegates/findOptimalMeetingTimeV2.e2e.test.ts_

```ts
it('should get an exact time within PT working hours', async () => {
  // LA wall-clock "YYYY-MM-DDT10:30:00" one week from now:
  const p = partsInTZ(new Date(), 'America/Los_Angeles');
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const localDateString = `${p.year}-${pad(p.month)}-${pad(p.day + 7)}T10:30:00`;

  const slots = await client.getAvailableMeetingTimes({
    participants: ['dsmiley@codestrap.me'],
    subject: 'Circle Up',
    timeframe_context: 'user defined exact date/time',
    localDateString,
    duration_minutes: 30,
    working_hours: {
      start_hour: 8,
      end_hour: 17,
    },
  });

  expect(slots.suggested_times.length).toBeGreaterThan(0);
}, 60000);
```

- **single-day, 3 attendees: outputs slots that do not intersect busy times and lie within PT working hours** — _packages/services/google/src/lib/delegates/findOptimalMeetingTimeV2.test.ts_

```ts
it('single-day, 3 attendees: outputs slots that do not intersect busy times and lie within PT working hours', async () => {
  currentCalendarsFixture = fbSingleDayCalendars;

  const windowStartUTC = wallClockToUTC('2025-07-22T08:00:00', timezone); // PT → UTC
  const windowEndUTC = wallClockToUTC('2025-07-22T17:00:00', timezone); // PT → UTC
  const workingHours = workingHoursUTCForDate(windowStartUTC, timezone, 8, 17);

  const slots = await findOptimalMeetingTimeV2({
    calendar,
    attendees: Object.keys(fbSingleDayCalendars),
    timezone,
    windowStartUTC,
    windowEndUTC,
    durationMinutes,
    workingHours,
    slotStepMinutes,
    skipFriday: false,
  });

  expect(slots.length).toBeGreaterThan(0);
  assertNoOverlap(slots, flattenBusy(fbSingleDayCalendars));
  assertWithinLocalWorkingHours(slots, { start_hour: 8, end_hour: 17 });
});
```

- **multi-day window: handles union of busy blocks across attendees and days** — _packages/services/google/src/lib/delegates/findOptimalMeetingTimeV2.test.ts_

```ts
it('multi-day window: handles union of busy blocks across attendees and days', async () => {
  currentCalendarsFixture = fbMultiDayCalendars;

  const windowStartUTC = wallClockToUTC('2025-07-22T08:00:00', timezone); // PT → UTC
  const windowEndUTC = wallClockToUTC('2025-07-23T17:00:00', timezone); // PT → UTC
  const workingHours = workingHoursUTCForDate(windowStartUTC, timezone, 8, 17);

  const slots = await findOptimalMeetingTimeV2({
    calendar,
    attendees: Object.keys(fbMultiDayCalendars),
    timezone,
    windowStartUTC,
    windowEndUTC,
    durationMinutes,
    workingHours,
    slotStepMinutes,
    skipFriday: false,
  });

  expect(slots.length).toBeGreaterThan(0);
  assertNoOverlap(slots, flattenBusy(fbMultiDayCalendars));
  assertWithinLocalWorkingHours(slots, { start_hour: 8, end_hour: 17 });
});
```

- **skipFriday=true → zero slots for a Friday-only window** — _packages/services/google/src/lib/delegates/findOptimalMeetingTimeV2.test.ts_

```ts
it('skipFriday=true → zero slots for a Friday-only window', async () => {
  currentCalendarsFixture = fbFridayCalendars;

  const windowStartUTC = wallClockToUTC('2025-07-25T08:00:00', timezone); // Fri PT
  const windowEndUTC = wallClockToUTC('2025-07-25T17:00:00', timezone); // PT
  const workingHours = workingHoursUTCForDate(windowStartUTC, timezone, 8, 17);

  const slots = await findOptimalMeetingTimeV2({
    calendar,
    attendees: Object.keys(fbFridayCalendars),
    timezone,
    windowStartUTC,
    windowEndUTC,
    durationMinutes,
    workingHours,
    slotStepMinutes,
    skipFriday: true,
  });

  expect(slots).toHaveLength(0);
});
```

- **DST boundary spanning Nov 1–3 2025: returns slots with proper -07:00 or -08:00 offsets** — _packages/services/google/src/lib/delegates/findOptimalMeetingTimeV2.test.ts_

```ts
it('DST boundary spanning Nov 1–3 2025: returns slots with proper -07:00 or -08:00 offsets', async () => {
  currentCalendarsFixture = fbDSTCalendars;

  const windowStartUTC = wallClockToUTC('2025-11-01T08:00:00', timezone); // PDT
  const windowEndUTC = wallClockToUTC('2025-11-03T17:00:00', timezone); // PST
  const workingHours = workingHoursUTCForDate(windowStartUTC, timezone, 8, 17);

  const slots = await findOptimalMeetingTimeV2({
    calendar,
    attendees: Object.keys(fbDSTCalendars),
    timezone,
    windowStartUTC,
    windowEndUTC,
    durationMinutes,
    workingHours,
    slotStepMinutes,
    skipFriday: false,
  });

  expect(slots.length).toBeGreaterThan(0);
  const offsetRegex = /(-07:00|-08:00)$/;
  for (const s of slots) {
    expect(offsetRegex.test(s.start) || offsetRegex.test(s.end)).toBeTruthy();
  }
});
```

- **works with hardcoded UTC instants (no wallClockToUTC usage)** — _packages/services/google/src/lib/delegates/findOptimalMeetingTimeV2.test.ts_

```ts
it('works with hardcoded UTC instants (no wallClockToUTC usage)', async () => {
  currentCalendarsFixture = fbSingleDayCalendars;

  // July in PT is UTC-7 → 08:00 PT == 15:00Z, 09:00 PT == 16:00Z
  const windowStartUTC = new Date('2025-07-22T15:00:00Z');
  const windowEndUTC = new Date('2025-07-22T16:00:00Z');

  // PT business hours 08–17 → in UTC they’re 15 → 00 (end wraps to next UTC day)
  const workingHours = { start_hour: 15, end_hour: 0 };

  const slots = await findOptimalMeetingTimeV2({
    calendar,
    attendees: Object.keys(fbSingleDayCalendars),
    timezone,
    windowStartUTC,
    windowEndUTC,
    durationMinutes,
    workingHours,
    slotStepMinutes,
    skipFriday: false,
  });

  expect(slots.length).toBeGreaterThan(0);
  const offsetRegex = /(-07:00|-08:00)$/;
  for (const s of slots) {
    expect(offsetRegex.test(s.start)).toBe(true);
  }
});
```

- **rounds up first slot to step boundary and supports step < duration** — _packages/services/google/src/lib/delegates/findOptimalMeetingTimeV2.test.ts_

```ts
it('rounds up first slot to step boundary and supports step < duration', async () => {
  // Working window 08:00–10:00. Leave free 08:05–09:10 local.
  // Block 1: 08:00–08:05 PT => 15:00–15:05Z (PDT, -07:00)
  // Block 2: 09:10–10:00 PT => 16:10–17:00Z
  currentCalendarsFixture = {
    'a@corp.com': {
      busy: [
        { start: '2025-07-22T15:00:00Z', end: '2025-07-22T15:05:00Z' },
        { start: '2025-07-22T16:10:00Z', end: '2025-07-22T17:00:00Z' },
      ],
    },
  };

  const windowStartUTC = wallClockToUTC('2025-07-22T08:00:00', timezone); // PT
  const windowEndUTC = wallClockToUTC('2025-07-22T10:00:00', timezone); // PT
  const workingHours = workingHoursUTCForDate(windowStartUTC, timezone, 8, 17);

  const slots = await findOptimalMeetingTimeV2({
    calendar,
    attendees: Object.keys(currentCalendarsFixture),
    timezone,
    windowStartUTC,
    windowEndUTC,
    durationMinutes: 30,
    workingHours,
    slotStepMinutes: 15,
    skipFriday: false,
  });

  // Free gap 08:05–09:10 with 30-min duration and 15-min step → 08:15–08:45, 08:30–09:00.
  expect(slots.length).toBeGreaterThanOrEqual(2);
  expect(slots[0].start.slice(11, 16)).toBe('08:15');
  expect(slots[0].end.slice(11, 16)).toBe('08:45');
  expect(slots[1].start.slice(11, 16)).toBe('08:30');
  expect(slots[1].end.slice(11, 16)).toBe('09:00');
  assertNoOverlap(slots, flattenBusy(currentCalendarsFixture));
});
```

- **returns 0 when all free gaps are shorter than duration** — _packages/services/google/src/lib/delegates/findOptimalMeetingTimeV2.test.ts_

```ts
it('returns 0 when all free gaps are shorter than duration', async () => {
  // Only free 12:00–12:20 local; duration=30 → 0 slots.
  // Busy: 08:00–12:00 PT (15:00–19:00Z) and 12:20–17:00 PT (19:20–00:00Z next day)
  currentCalendarsFixture = {
    'a@corp.com': {
      busy: [
        { start: '2025-07-22T15:00:00Z', end: '2025-07-22T19:00:00Z' },
        { start: '2025-07-22T19:20:00Z', end: '2025-07-23T00:00:00Z' },
      ],
    },
  };

  const windowStartUTC = wallClockToUTC('2025-07-22T08:00:00', timezone);
  const windowEndUTC = wallClockToUTC('2025-07-22T17:00:00', timezone);
  const workingHours = workingHoursUTCForDate(windowStartUTC, timezone, 8, 17);

  const slots = await findOptimalMeetingTimeV2({
    calendar,
    attendees: Object.keys(currentCalendarsFixture),
    timezone,
    windowStartUTC,
    windowEndUTC,
    durationMinutes: 30,
    workingHours,
    slotStepMinutes: 10,
    skipFriday: false,
  });

  expect(slots).toHaveLength(0);
});
```

- **skips weekends even across multi-day spans** — _packages/services/google/src/lib/delegates/findOptimalMeetingTimeV2.test.ts_

```ts
it('skips weekends even across multi-day spans', async () => {
  currentCalendarsFixture = { 'a@corp.com': { busy: [] } };

  const windowStartUTC = wallClockToUTC('2025-07-26T08:00:00', timezone); // Sat PT
  const windowEndUTC = wallClockToUTC('2025-07-28T17:00:00', timezone); // Mon PT
  const workingHours = workingHoursUTCForDate(windowStartUTC, timezone, 8, 17);

  const slots = await findOptimalMeetingTimeV2({
    calendar,
    attendees: Object.keys(currentCalendarsFixture),
    timezone,
    windowStartUTC,
    windowEndUTC,
    durationMinutes,
    workingHours,
    slotStepMinutes,
    skipFriday: false,
  });

  expect(slots.length).toBeGreaterThan(0);
  // All slots should be Monday (getDay()==1) in PT
  for (const s of slots) expect(dayInTZ(s.start, timezone)).toBe(1);
});
```

- **skipFriday=true removes Friday slots in mixed Thu→Fri range** — _packages/services/google/src/lib/delegates/findOptimalMeetingTimeV2.test.ts_

```ts
it('skipFriday=true removes Friday slots in mixed Thu→Fri range', async () => {
  currentCalendarsFixture = { 'a@corp.com': { busy: [] } };

  const windowStartUTC = wallClockToUTC('2025-07-24T08:00:00', timezone); // Thu PT
  const windowEndUTC = wallClockToUTC('2025-07-25T17:00:00', timezone); // Fri PT
  const workingHours = workingHoursUTCForDate(windowStartUTC, timezone, 8, 17);

  const slots = await findOptimalMeetingTimeV2({
    calendar,
    attendees: Object.keys(currentCalendarsFixture),
    timezone,
    windowStartUTC,
    windowEndUTC,
    durationMinutes,
    workingHours,
    slotStepMinutes,
    skipFriday: true,
  });

  expect(slots.length).toBeGreaterThan(0);
  for (const s of slots) expect(dayInTZ(s.start, timezone)).toBe(4); // Thursday
});
```

- **honors windowStart inside the working day (rounds to step)** — _packages/services/google/src/lib/delegates/findOptimalMeetingTimeV2.test.ts_

```ts
it('honors windowStart inside the working day (rounds to step)', async () => {
  currentCalendarsFixture = { 'a@corp.com': { busy: [] } };

  const windowStartUTC = wallClockToUTC('2025-07-22T10:10:00', timezone); // PT
  const windowEndUTC = wallClockToUTC('2025-07-22T12:00:00', timezone); // PT
  const workingHours = workingHoursUTCForDate(windowStartUTC, timezone, 8, 17);

  const slots = await findOptimalMeetingTimeV2({
    calendar,
    attendees: Object.keys(currentCalendarsFixture),
    timezone,
    windowStartUTC,
    windowEndUTC,
    durationMinutes: 30,
    workingHours,
    slotStepMinutes: 30,
    skipFriday: false,
  });

  expect(slots.length).toBeGreaterThan(0);
  expect(slots[0].start.slice(11, 16)).toBe('10:30');
});
```

- **returns 0 on a day fully covered by busy** — _packages/services/google/src/lib/delegates/findOptimalMeetingTimeV2.test.ts_

```ts
it('returns 0 on a day fully covered by busy', async () => {
  // Busy covers 08:00–17:00 PT ⇒ 15:00Z → 00:00Z next day
  currentCalendarsFixture = {
    'a@corp.com': {
      busy: [{ start: '2025-07-22T15:00:00Z', end: '2025-07-23T00:00:00Z' }],
    },
  };

  const windowStartUTC = wallClockToUTC('2025-07-22T08:00:00', timezone);
  const windowEndUTC = wallClockToUTC('2025-07-22T17:00:00', timezone);
  const workingHours = workingHoursUTCForDate(windowStartUTC, timezone, 8, 17);

  const slots = await findOptimalMeetingTimeV2({
    calendar,
    attendees: Object.keys(currentCalendarsFixture),
    timezone,
    windowStartUTC,
    windowEndUTC,
    durationMinutes,
    workingHours,
    slotStepMinutes,
    skipFriday: false,
  });

  expect(slots).toHaveLength(0);
});
```

- **merges overlapping and unsorted busy blocks correctly** — _packages/services/google/src/lib/delegates/findOptimalMeetingTimeV2.test.ts_

```ts
it('merges overlapping and unsorted busy blocks correctly', async () => {
  // Two overlapping blocks around 10:00–11:00 PT.
  currentCalendarsFixture = {
    'a@corp.com': {
      busy: [
        { start: '2025-07-22T17:15:00Z', end: '2025-07-22T18:00:00Z' }, // 10:15–11:00 PT
        { start: '2025-07-22T17:00:00Z', end: '2025-07-22T17:30:00Z' }, // 10:00–10:30 PT
      ],
    },
  };

  const windowStartUTC = wallClockToUTC('2025-07-22T08:00:00', timezone);
  const windowEndUTC = wallClockToUTC('2025-07-22T17:00:00', timezone);
  const workingHours = workingHoursUTCForDate(windowStartUTC, timezone, 8, 17);

  const slots = await findOptimalMeetingTimeV2({
    calendar,
    attendees: Object.keys(currentCalendarsFixture),
    timezone,
    windowStartUTC,
    windowEndUTC,
    durationMinutes,
    workingHours,
    slotStepMinutes,
    skipFriday: false,
  });

  expect(slots.length).toBeGreaterThan(0);
  assertNoOverlap(slots, flattenBusy(currentCalendarsFixture));
});
```

- **scores earlier slots higher (non-increasing sequence)** — _packages/services/google/src/lib/delegates/findOptimalMeetingTimeV2.test.ts_

```ts
it('scores earlier slots higher (non-increasing sequence)', async () => {
  currentCalendarsFixture = { 'a@corp.com': { busy: [] } };

  const windowStartUTC = wallClockToUTC('2025-07-22T08:00:00', timezone);
  const windowEndUTC = wallClockToUTC('2025-07-22T17:00:00', timezone);
  const workingHours = workingHoursUTCForDate(windowStartUTC, timezone, 8, 17);

  const slots = await findOptimalMeetingTimeV2({
    calendar,
    attendees: Object.keys(currentCalendarsFixture),
    timezone,
    windowStartUTC,
    windowEndUTC,
    durationMinutes,
    workingHours,
    slotStepMinutes,
    skipFriday: false,
  });

  expect(slots.length).toBeGreaterThan(5);
  for (let i = 1; i < slots.length; i++) {
    expect((slots[i - 1].score ?? 0) >= (slots[i].score ?? 0)).toBe(true);
  }
});
```

- **DST spring-forward (Mar 7–10, 2025): shows -08:00 before and -07:00 after** — _packages/services/google/src/lib/delegates/findOptimalMeetingTimeV2.test.ts_

```ts
it('DST spring-forward (Mar 7–10, 2025): shows -08:00 before and -07:00 after', async () => {
  // No busy; verify offsets across DST change (Sun Mar 9, 2025).
  // Windows skip weekend; this range yields Fri (PST, -08:00) and Mon (PDT, -07:00).
  currentCalendarsFixture = { 'a@corp.com': { busy: [] } };

  const windowStartUTC = wallClockToUTC('2025-03-07T08:00:00', timezone); // Fri (PST)
  const windowEndUTC = wallClockToUTC('2025-03-10T17:00:00', timezone); // Mon (PDT)
  const workingHours = workingHoursUTCForDate(windowStartUTC, timezone, 8, 17);

  const slots = await findOptimalMeetingTimeV2({
    calendar,
    attendees: Object.keys(currentCalendarsFixture),
    timezone: 'America/Los_Angeles',
    windowStartUTC,
    windowEndUTC,
    durationMinutes: 30,
    workingHours,
    slotStepMinutes: 30,
    skipFriday: false,
  });

  expect(slots.length).toBeGreaterThan(0);
  const hasMinus08 = slots.some(
    (s) => /-08:00$/.test(s.start) || /-08:00$/.test(s.end),
  ); // Fri
  const hasMinus07 = slots.some(
    (s) => /-07:00$/.test(s.start) || /-07:00$/.test(s.end),
  ); // Mon
  expect(hasMinus08 && hasMinus07).toBe(true);
});
```

- **should build query with keywords only** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should build query with keywords only', async () => {
  const params: DriveSearchParams = {
    keywords: ['transcripts', 'meeting'],
  };

  await searchDriveFiles(mockDriveClient, params);

  expect(mockDriveClient.files.list).toHaveBeenCalledWith(
    expect.objectContaining({
      q: "(name contains 'transcripts' or name contains 'meeting') and trashed = false",
    }),
  );
});
```

- **should build query with date range** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should build query with date range', async () => {
  const params: DriveSearchParams = {
    dateRange: {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      field: DriveDateField.CREATED_TIME,
    },
  };

  await searchDriveFiles(mockDriveClient, params);

  expect(mockDriveClient.files.list).toHaveBeenCalledWith(
    expect.objectContaining({
      q: "createdTime >= '2024-01-01T00:00:00.000Z' and createdTime <= '2024-12-31T00:00:00.000Z' and trashed = false",
    }),
  );
});
```

- **should build query with MIME type** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should build query with MIME type', async () => {
  const params: DriveSearchParams = {
    mimeType: 'application/pdf',
  };

  await searchDriveFiles(mockDriveClient, params);

  expect(mockDriveClient.files.list).toHaveBeenCalledWith(
    expect.objectContaining({
      q: "mimeType = 'application/pdf' and trashed = false",
    }),
  );
});
```

- **should build query with owner** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should build query with owner', async () => {
  const params: DriveSearchParams = {
    owner: 'user@example.com',
  };

  await searchDriveFiles(mockDriveClient, params);

  expect(mockDriveClient.files.list).toHaveBeenCalledWith(
    expect.objectContaining({
      q: "'user@example.com' in owners and trashed = false",
    }),
  );
});
```

- **should build query with shared with me** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should build query with shared with me', async () => {
  const params: DriveSearchParams = {
    sharedWithMe: true,
  };

  await searchDriveFiles(mockDriveClient, params);

  expect(mockDriveClient.files.list).toHaveBeenCalledWith(
    expect.objectContaining({
      q: 'sharedWithMe and trashed = false',
    }),
  );
});
```

- **should build query with trashed files** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should build query with trashed files', async () => {
  const params: DriveSearchParams = {
    trashed: true,
  };

  await searchDriveFiles(mockDriveClient, params);

  expect(mockDriveClient.files.list).toHaveBeenCalledWith(
    expect.objectContaining({
      q: 'trashed = true',
    }),
  );
});
```

- **should build complex query with multiple parameters** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should build complex query with multiple parameters', async () => {
  const params: DriveSearchParams = {
    keywords: ['project', 'report'],
    dateRange: {
      startDate: new Date('2024-01-01'),
      field: DriveDateField.MODIFIED_TIME,
    },
    mimeType: 'application/pdf',
    owner: 'user@example.com',
    pageSize: 50,
  };

  await searchDriveFiles(mockDriveClient, params);

  expect(mockDriveClient.files.list).toHaveBeenCalledWith(
    expect.objectContaining({
      q: "(name contains 'project' or name contains 'report') and modifiedTime >= '2024-01-01T00:00:00.000Z' and mimeType = 'application/pdf' and 'user@example.com' in owners and trashed = false",
      pageSize: 50,
    }),
  );
});
```

- **should escape special characters in keywords** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should escape special characters in keywords', async () => {
  const params: DriveSearchParams = {
    keywords: ['test (draft)', 'file[final]', 'report v2.0'],
  };

  await searchDriveFiles(mockDriveClient, params);

  expect(mockDriveClient.files.list).toHaveBeenCalledWith(
    expect.objectContaining({
      q: "(name contains 'test \\(draft\\)' or name contains 'file\\[final\\]' or name contains 'report v2\\.0') and trashed = false",
    }),
  );
});
```

- **should handle keywords with quotes** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should handle keywords with quotes', async () => {
  const params: DriveSearchParams = {
    keywords: ['file "important"', "doc 'final'"],
  };

  await searchDriveFiles(mockDriveClient, params);

  expect(mockDriveClient.files.list).toHaveBeenCalledWith(
    expect.objectContaining({
      q: "(name contains 'file \\\"important\\\"' or name contains 'doc \\'final\\'') and trashed = false",
    }),
  );
});
```

- **should handle keywords with backslashes** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should handle keywords with backslashes', async () => {
  const params: DriveSearchParams = {
    keywords: ['backup\\copy', 'path\\to\\file'],
  };

  await searchDriveFiles(mockDriveClient, params);

  expect(mockDriveClient.files.list).toHaveBeenCalledWith(
    expect.objectContaining({
      q: "(name contains 'backup\\\\copy' or name contains 'path\\\\to\\\\file') and trashed = false",
    }),
  );
});
```

- **should return converted files successfully** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should return converted files successfully', async () => {
      const mockApiResponse = {
        data: {
          files: [
            {
              id: 'file1',
              name: 'test.pdf',
              mimeType: 'application/pdf',
              size: '1024',
              createdTime: '2024-01-01T00:00:00.000Z',
              modifiedTime: '2024-01-02T00:00:00.000Z',
              webViewLink: 'https://drive.google.com/file/d/file1/view',
              webContentLink: 'https://drive.google.com/uc?id=file1',
              owners: [
                {
                  displayName: 'John Doe',
                  emailAddress: 'john@example.com',
                },
              ],
              lastModifyingUser: {
                displayName: 'Jane Doe',
                emailAddress: 'jane@example.com',
              },
              parents: ['parent1'],
              description: 'Test file',
              starred: true,
              trashed: false,
            },
          ],
          nextPageToken: 'next-token',
          incompleteSearch: true,
        },
      };

      (mockDriveClient.files.list as jest.Mock).mockResolvedValue(mockApiResponse);

      const pa
/* …snip… */
 '2024-01-02T00:00:00.000Z',
            webViewLink: 'https://drive.google.com/file/d/file1/view',
            webContentLink: 'https://drive.google.com/uc?id=file1',
            owners: [
              {
                displayName: 'John Doe',
                emailAddress: 'john@example.com',
              },
            ],
            lastModifyingUser: {
              displayName: 'Jane Doe',
              emailAddress: 'jane@example.com',
            },
            parents: ['parent1'],
            description: 'Test file',
            starred: true,
            trashed: false,
          },
        ],
        nextPageToken: 'next-token',
        incompleteSearch: true,
      });
    })
```

- **should handle empty response** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should handle empty response', async () => {
  const mockApiResponse = {
    data: {
      files: [],
      nextPageToken: undefined,
      incompleteSearch: undefined,
    },
  };

  (mockDriveClient.files.list as jest.Mock).mockResolvedValue(mockApiResponse);

  const params: DriveSearchParams = {
    keywords: ['nonexistent'],
  };

  const result = await searchDriveFiles(mockDriveClient, params);

  expect(result).toEqual({
    files: [],
    nextPageToken: undefined,
    incompleteSearch: undefined,
  });
});
```

- **should handle null files in response** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should handle null files in response', async () => {
  const mockApiResponse = {
    data: {
      files: null,
      nextPageToken: undefined,
      incompleteSearch: undefined,
    },
  };

  (mockDriveClient.files.list as jest.Mock).mockResolvedValue(mockApiResponse);

  const params: DriveSearchParams = {
    keywords: ['test'],
  };

  const result = await searchDriveFiles(mockDriveClient, params);

  expect(result).toEqual({
    files: [],
    nextPageToken: undefined,
    incompleteSearch: undefined,
  });
});
```

- **should bubble authentication errors** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should bubble authentication errors', async () => {
  const authError = new Error('invalid_grant: Invalid credentials');
  (mockDriveClient.files.list as jest.Mock).mockRejectedValue(authError);

  const params: DriveSearchParams = { keywords: ['test'] };

  await expect(searchDriveFiles(mockDriveClient, params)).rejects.toThrow(
    'invalid_grant: Invalid credentials',
  );
});
```

- **should bubble quota exceeded errors** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should bubble quota exceeded errors', async () => {
  const quotaError = new Error('quota exceeded');
  (mockDriveClient.files.list as jest.Mock).mockRejectedValue(quotaError);

  const params: DriveSearchParams = { keywords: ['test'] };

  await expect(searchDriveFiles(mockDriveClient, params)).rejects.toThrow(
    'quota exceeded',
  );
});
```

- **should bubble not found errors** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should bubble not found errors', async () => {
  const notFoundError = new Error('notFound: Drive not found');
  (mockDriveClient.files.list as jest.Mock).mockRejectedValue(notFoundError);

  const params: DriveSearchParams = { keywords: ['test'] };

  await expect(searchDriveFiles(mockDriveClient, params)).rejects.toThrow(
    'notFound: Drive not found',
  );
});
```

- **should bubble generic errors** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should bubble generic errors', async () => {
  const genericError = new Error('Something went wrong');
  (mockDriveClient.files.list as jest.Mock).mockRejectedValue(genericError);

  const params: DriveSearchParams = { keywords: ['test'] };

  await expect(searchDriveFiles(mockDriveClient, params)).rejects.toThrow(
    'Something went wrong',
  );
});
```

- **should bubble non-Error rejections as-is** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should bubble non-Error rejections as-is', async () => {
  (mockDriveClient.files.list as jest.Mock).mockRejectedValue('String error');

  const params: DriveSearchParams = { keywords: ['test'] };

  await expect(searchDriveFiles(mockDriveClient, params)).rejects.toEqual(
    'String error',
  );
});
```

- **should handle empty keywords array** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should handle empty keywords array', async () => {
  const params: DriveSearchParams = {
    keywords: [],
  };

  await searchDriveFiles(mockDriveClient, params);

  expect(mockDriveClient.files.list).toHaveBeenCalledWith(
    expect.objectContaining({
      q: 'trashed = false',
    }),
  );
});
```

- **should filter out empty keywords** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should filter out empty keywords', async () => {
  const params: DriveSearchParams = {
    keywords: ['valid', 'another-valid'], // Remove empty keywords since validation now prevents them
  };

  await searchDriveFiles(mockDriveClient, params);

  expect(mockDriveClient.files.list).toHaveBeenCalledWith(
    expect.objectContaining({
      q: "(name contains 'valid' or name contains 'another-valid') and trashed = false",
    }),
  );
});
```

- **should handle whitespace in keywords** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should handle whitespace in keywords', async () => {
  const params: DriveSearchParams = {
    keywords: ['  project plan  ', '  meeting notes  '],
  };

  await searchDriveFiles(mockDriveClient, params);

  expect(mockDriveClient.files.list).toHaveBeenCalledWith(
    expect.objectContaining({
      q: "(name contains 'project plan' or name contains 'meeting notes') and trashed = false",
    }),
  );
});
```

- **should handle whitespace in MIME type and owner** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should handle whitespace in MIME type and owner', async () => {
  const params: DriveSearchParams = {
    mimeType: '  application/pdf  ',
    owner: 'user@example.com', // Remove whitespace since validation now prevents invalid emails
  };

  await searchDriveFiles(mockDriveClient, params);

  expect(mockDriveClient.files.list).toHaveBeenCalledWith(
    expect.objectContaining({
      q: "mimeType = 'application/pdf' and 'user@example.com' in owners and trashed = false",
    }),
  );
});
```

- **should use default values for optional parameters** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should use default values for optional parameters', async () => {
  const params: DriveSearchParams = {};

  await searchDriveFiles(mockDriveClient, params);

  expect(mockDriveClient.files.list).toHaveBeenCalledWith(
    expect.objectContaining({
      pageSize: 100,
      orderBy: 'modifiedTime desc',
      fields:
        'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,owners,lastModifyingUser,parents,description,starred,trashed)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    }),
  );
});
```

- **should handle files with missing optional fields** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should handle files with missing optional fields', async () => {
  const mockApiResponse = {
    data: {
      files: [
        {
          id: 'file1',
          name: 'test.pdf',
          mimeType: 'application/pdf',
          // Missing optional fields
        },
      ],
      nextPageToken: undefined,
      incompleteSearch: undefined,
    },
  };

  (mockDriveClient.files.list as jest.Mock).mockResolvedValue(mockApiResponse);

  const params: DriveSearchParams = {
    keywords: ['test'],
  };

  const result = await searchDriveFiles(mockDriveClient, params);

  expect(result.files[0]).toEqual({
    id: 'file1',
    name: 'test.pdf',
    mimeType: 'application/pdf',
    size: undefined,
    createdTime: undefined,
    modifiedTime: undefined,
    webViewLink: undefined,
    webContentLink: undefined,
    owners: undefined,
    lastModifyingUser: undefined,
    parents: undefined,
    description: undefined,
    starred: undefined,
    trashed: undefined,
  });
});
```

- **should handle files with null owners** — _packages/services/google/src/lib/delegates/searchDriveFiles.test.ts_

```ts
it('should handle files with null owners', async () => {
  const mockApiResponse = {
    data: {
      files: [
        {
          id: 'file1',
          name: 'test.pdf',
          mimeType: 'application/pdf',
          owners: null,
        },
      ],
      nextPageToken: undefined,
      incompleteSearch: undefined,
    },
  };

  (mockDriveClient.files.list as jest.Mock).mockResolvedValue(mockApiResponse);

  const params: DriveSearchParams = {
    keywords: ['test'],
  };

  const result = await searchDriveFiles(mockDriveClient, params);

  expect(result.files[0].owners).toBeUndefined();
});
```

- **should call searchDriveFiles delegate with correct parameters** — _packages/services/google/src/lib/gsuiteClient.v2.test.ts_

```ts
it('should call searchDriveFiles delegate with correct parameters', async () => {
  const mockSearchResult = {
    files: [
      {
        id: 'file1',
        name: 'test.pdf',
        mimeType: 'application/pdf',
      },
    ],
    nextPageToken: 'next-token',
    incompleteSearch: false,
  };

  mockSearchDriveFiles.mockResolvedValue(mockSearchResult);

  const client = await makeGSuiteClientV2(mockUser);
  const searchParams: DriveSearchParams = {
    keywords: ['test'],
    mimeType: 'application/pdf',
  };

  const result = await client.searchDriveFiles(searchParams);

  expect(mockSearchDriveFiles).toHaveBeenCalledWith(
    expect.any(Object),
    searchParams,
  );
  expect(result).toEqual({
    message: 'Found 1 files matching your search criteria',
    files: mockSearchResult.files,
    totalResults: 1,
    nextPageToken: 'next-token',
    incompleteSearch: false,
  });
});
```

- **should handle empty search results** — _packages/services/google/src/lib/gsuiteClient.v2.test.ts_

```ts
it('should handle empty search results', async () => {
  const mockSearchResult = {
    files: [],
    nextPageToken: undefined,
    incompleteSearch: false,
  };

  mockSearchDriveFiles.mockResolvedValue(mockSearchResult);

  const client = await makeGSuiteClientV2(mockUser);
  const searchParams: DriveSearchParams = {
    keywords: ['nonexistent'],
  };

  const result = await client.searchDriveFiles(searchParams);

  expect(result).toEqual({
    message: 'Found 0 files matching your search criteria',
    files: [],
    totalResults: 0,
    nextPageToken: undefined,
    incompleteSearch: false,
  });
});
```

- **should handle multiple files in search results** — _packages/services/google/src/lib/gsuiteClient.v2.test.ts_

```ts
it('should handle multiple files in search results', async () => {
  const mockSearchResult = {
    files: [
      {
        id: 'file1',
        name: 'test1.pdf',
        mimeType: 'application/pdf',
      },
      {
        id: 'file2',
        name: 'test2.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      {
        id: 'file3',
        name: 'test3.xlsx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ],
    nextPageToken: 'next-token',
    incompleteSearch: true,
  };

  mockSearchDriveFiles.mockResolvedValue(mockSearchResult);

  const client = await makeGSuiteClientV2(mockUser);
  const searchParams: DriveSearchParams = {
    keywords: ['test'],
  };

  const result = await client.searchDriveFiles(searchParams);

  expect(result).toEqual({
    message: 'Found 3 files matching your search criteria',
    files: mockSearchResult.files,
    totalResults: 3,
    nextPageToken: 'next-token',
    incompleteSearch: true,
  });
});
```

- **should propagate errors from searchDriveFiles delegate** — _packages/services/google/src/lib/gsuiteClient.v2.test.ts_

```ts
it('should propagate errors from searchDriveFiles delegate', async () => {
  const error = new Error('Search failed');
  mockSearchDriveFiles.mockRejectedValue(error);

  const client = await makeGSuiteClientV2(mockUser);
  const searchParams: DriveSearchParams = {
    keywords: ['test'],
  };

  await expect(client.searchDriveFiles(searchParams)).rejects.toThrow(
    'Search failed',
  );
});
```

- **should handle complex search parameters** — _packages/services/google/src/lib/gsuiteClient.v2.test.ts_

```ts
it('should handle complex search parameters', async () => {
  const mockSearchResult = {
    files: [
      {
        id: 'file1',
        name: 'project-report.pdf',
        mimeType: 'application/pdf',
      },
    ],
    nextPageToken: undefined,
    incompleteSearch: false,
  };

  mockSearchDriveFiles.mockResolvedValue(mockSearchResult);

  const client = await makeGSuiteClientV2(mockUser);
  const searchParams: DriveSearchParams = {
    keywords: ['project', 'report'],
    dateRange: {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      field: DriveDateField.CREATED_TIME,
    },
    mimeType: 'application/pdf',
    owner: 'user@example.com',
    sharedWithMe: true,
    pageSize: 50,
    orderBy: 'createdTime desc',
  };

  const result = await client.searchDriveFiles(searchParams);

  expect(mockSearchDriveFiles).toHaveBeenCalledWith(
    expect.any(Object),
    searchParams,
  );
  expect(result.message).toBe('Found 1 files matching your search criteria');
  expect(result.totalResults).toBe(1);
});
```

- **should call makeGSuiteClient with correct user** — _packages/services/google/src/lib/gsuiteClient.v2.test.ts_

```ts
it('should call makeGSuiteClient with correct user', async () => {
  await makeGSuiteClientV2(mockUser);

  expect(mockMakeGSuiteClient).toHaveBeenCalledWith(mockUser);
});
```

- **should return all v1 client methods plus searchDriveFiles** — _packages/services/google/src/lib/gsuiteClient.v2.test.ts_

```ts
it('should return all v1 client methods plus searchDriveFiles', async () => {
  const client = await makeGSuiteClientV2(mockUser);

  // Check that v2 specific methods are available
  expect(client.searchDriveFiles).toBeDefined();
  expect(client.summarizeCalendars).toBeDefined();
  expect(client.getAvailableMeetingTimes).toBeDefined();
});
```

- **should preserve v1 client functionality** — _packages/services/google/src/lib/gsuiteClient.v2.test.ts_

```ts
it('should preserve v1 client functionality', async () => {
  const client = await makeGSuiteClientV2(mockUser);

  // Test that v1 methods are available on the client
  expect(typeof client.getCalendarClient).toBe('function');
  expect(typeof client.getEmailClient).toBe('function');
  expect(typeof client.getDriveClient).toBe('function');
});
```

- **should propagate errors from makeGSuiteClient** — _packages/services/google/src/lib/gsuiteClient.v2.test.ts_

```ts
it('should propagate errors from makeGSuiteClient', async () => {
  const error = new Error('Failed to create v1 client');
  mockMakeGSuiteClient.mockRejectedValue(error);

  await expect(makeGSuiteClientV2(mockUser)).rejects.toThrow(
    'Failed to create v1 client',
  );
});
```

## Jest Mocks Used <!-- anchor: jest_mocks -->

## Test Mock Setup (extracted from Jest) <!-- anchor: test_mocks -->

- **module:** `googleapis`
  - from: `packages/services/google/src/lib/delegates/findOptimalMeetingTimeV2.test.ts`
  - factory:

```ts
() => ({
  ...jest.requireActual('googleapis'),
  google: {
    calendar: jest.fn(() => {
      return {
        events: {
          list: jest.fn(() => Promise.resolve({ data: { items: [] } })), // not used but kept
        },
        freebusy: {
          query: jest.fn((params: any) => {
            const { timeMin, timeMax } = params.requestBody;
            return Promise.resolve({
              data: {
                kind: 'calendar#freeBusy',
                timeMin,
                timeMax,
                calendars: currentCalendarsFixture,
              },
            });
          }),
        },
      };
    }),
    auth: {
      GoogleAuth: jest.fn().mockImplementation(() => {
        return {
          getClient: jest.fn().mockResolvedValue({
            getRequestHeaders: jest.fn().mockResolvedValue({}),
          }),
        };
      }),
    },
  },
});
```

## Project Configuration <!-- anchor: project_configuration -->

**package.json**: `packages/services/google/package.json`

- name: `@codestrap/developer-foundations-services-google`
- version: `0.0.1`
- private: `false`
- scripts: _none_
- deps: 6
  **contents**

```json
{
  "name": "@codestrap/developer-foundations-services-google",
  "version": "0.0.1",
  "type": "commonjs",
  "main": "./src/index.js",
  "types": "./src/index.d.ts",
  "publishConfig": {
    "access": "public"
  },
  "dependencies": {
    "@codestrap/developer-foundations-types": "*",
    "@codestrap/developer-foundations-utils": "*",
    "@google/generative-ai": "^0.24.1",
    "googleapis": "^149.0.0",
    "tslib": "^2.3.0"
  },
  "devDependencies": {
    "@types/node": "^22.15.3"
  }
}
```

### TypeScript Configs

- `packages/services/google/tsconfig.json` (extends: `../../../tsconfig.base.json`) — baseUrl: `-`, target: `-`, module: `commonjs`, paths: 0

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "importHelpers": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true
  },
  "files": [],
  "include": [],
  "references": [
    {
      "path": "./tsconfig.lib.json"
    },
    {
      "path": "./tsconfig.spec.json"
    }
  ]
}
```

- `packages/services/google/tsconfig.lib.json` (extends: `./tsconfig.json`) — baseUrl: `-`, target: `-`, module: `-`, paths: 0

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc",
    "declaration": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["jest.config.ts", "src/**/*.spec.ts", "src/**/*.test.ts"]
}
```

- `packages/services/google/tsconfig.spec.json` (extends: `./tsconfig.json`) — baseUrl: `-`, target: `-`, module: `commonjs`, paths: 0

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc",
    "module": "commonjs",
    "moduleResolution": "node10",
    "types": ["jest", "node"]
  },
  "include": [
    "jest.config.ts",
    "src/**/*.test.ts",
    "src/**/*.spec.ts",
    "src/**/*.d.ts"
  ]
}
```

### Nx Project

**project.json**: `packages/services/google/project.json`

- name: `google-service`, sourceRoot: `packages/services/google/src`, tags: `type:service`
- targets: `build`, `nx-release-publish`, `test`
  **contents**

```json
{
  "name": "google-service",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "packages/services/google/src",
  "projectType": "library",
  "release": {
    "version": {
      "manifestRootsToUpdate": ["dist/{projectRoot}"],
      "currentVersionResolver": "git-tag",
      "fallbackCurrentVersionResolver": "disk"
    }
  },
  "tags": ["type:service"],
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/packages/services/google",
        "main": "packages/services/google/src/index.ts",
        "tsConfig": "packages/services/google/tsconfig.lib.json",
        "assets": ["packages/services/google/*.md"]
      }
    },
    "nx-release-publish": {
      "options": {
        "packageRoot": "dist/{projectRoot}"
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": {
        "jestConfig": "packages/services/google/jest.config.ts"
      }
    }
  }
}
```

### Jest

- `packages/services/google/jest.config.ts`

```ts
import * as dotenv from 'dotenv';

dotenv.config();

export default {
  displayName: 'google',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/packages/services/google',
};
```

### ESLint

- `packages/services/google/eslint.config.mjs`

```js
import baseConfig from '../../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
```

### Environment Files <!-- anchor: configuration_env -->

| name                           | required | default | files                                           | notes                                                                             |
| ------------------------------ | -------- | ------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `BROWSERFY_BROWSER_URL`        | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `BROWSERFY_KEY`                | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `CA_SERIES_ID`                 | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `E2E`                          | yes      |         | `packages/services/google/src/process-env.d.ts` | string — controls running of e2e tests, defaults to false                         |
| `EIA_API_KEY`                  | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `EIA_BASE_URL`                 | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `FOUNDRY_CLIENT_TYPE`          | yes      |         | `packages/services/google/src/process-env.d.ts` | SupportedFoundryClients                                                           |
| `FOUNDRY_STACK_URL`            | yes      |         | `packages/services/google/src/process-env.d.ts` | string — the bae url of our Foundry stack                                         |
| `FOUNDRY_TEST_USER`            | yes      |         | `packages/services/google/src/process-env.d.ts` | string — the hard coded uid of the user to use for testing, defaults to CodeStrap |
| `FOUNDRY_TOKEN`                | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `GEMINI_API_KEY`               | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `GOOGLE_SEARCH_API_KEY`        | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `GOOGLE_SEARCH_ENGINE_ID`      | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `GOOGLE_SEARCH_ENGINE_MARKETS` | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `LOG_PREFIX`                   | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `OFFICE_SERVICE_ACCOUNT`       | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `ONTOLOGY_ID`                  | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `ONTOLOGY_RID`                 | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `OPEN_AI_KEY`                  | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `OPEN_WEATHER_API_KEY`         | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `OSDK_CLIENT_ID`               | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `OSDK_CLIENT_SECRET`           | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `RANGR_FOUNDRY_STACK_URL`      | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `RANGR_ONTOLOGY_RID`           | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `RANGR_OSDK_CLIENT_ID`         | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `RANGR_OSDK_CLIENT_SECRET`     | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `REDIRECT_URL`                 | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `SLACK_APP_TOKEN`              | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `SLACK_BASE_URL`               | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `SLACK_BOT_TOKEN`              | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `SLACK_CLIENT_ID`              | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `SLACK_CLIENT_SECRET`          | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |
| `SLACK_SIGNING_SECRET`         | yes      |         | `packages/services/google/src/process-env.d.ts` | string                                                                            |

## Dependency Topology (Nx) <!-- anchor: deps_topology -->

**Project:** `google-service`

- Depends on: `types`, `utils`
- Dependents: `agents-vickie-bennie`, `di`

## Import Graph (File-level) <!-- anchor: import_graph -->

_Text-only representation intentionally omitted in this version; agents can walk files from API surface._

## Practice Tasks (for Agents/RL) <!-- anchor: practice_tasks -->

**Q:** create sending email function to send an custom templated email
**A:**

- **Design spec**
  - **Overview**: Implement `sendEmail` delegate using `googleapis@149.0.0` to send a single-template email. Expose it only via `gsuiteClient.ts` and scaffold tests per package conventions.
  - **Constraints**
    - **Language**: TypeScript
    - **Library**: `googleapis@149.0.0` preferred; REST fallback allowed
    - **Exposure**: Only through `gsuiteClient.ts`
    - **Package conventions**:
      - Delegates under `src/lib/delegates/`
      - Tests under `src/lib/tests/`
      - Public API exposed via `gsuiteClient.ts`
  - **Auth scopes required** (must be added in `gsuiteClient.ts` mail scopes):
    - `https://mail.google.com/`
    - `https://www.googleapis.com/auth/gmail.modify`
    - `https://www.googleapis.com/auth/gmail.compose`
    - `https://www.googleapis.com/auth/gmail.send`
  - **External API reference**: `users.messages.send` — `https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send`
  - **Inputs and outputs**
    - **Input type**: `EmailContext`
      - `from: string` (required)
      - `recipients: string | string[]` (required)
      - `subject: string` (required)
      - `message: string` (required; HTML allowed; plain-text auto-derived)
    - **Output type**: `SendEmailOutput`
      - `id: string`, `threadId: string`, `labelIds?: string[]`
  - **Functional behavior**
    - Validate `from`, `recipients`, `subject`, `message`
    - Build `multipart/alternative` MIME with `text/plain` (derived) and `text/html` (provided + footer)
    - Base64url encode MIME and call `gmail.users.messages.send({ userId: 'me', requestBody: { raw } })`
    - Return `{ id, threadId, labelIds }`
  - **Error handling**
    - Throw on invalid input; validate Gmail response contains `id` and `threadId`
    - Log minimal context; include `.response.data` when present; rethrow errors
  - **Security and privacy**
    - Never log credentials; avoid logging full message content
  - **Acceptance criteria**
    - Returns `{ id, threadId }` on success; MIME is well-formed and properly encoded; exposed only through `gsuiteClient.ts`
  - **Usage (via client)**

```typescript
import { makeGSuiteClient } from './lib/gsuiteClient';

const client = await makeGSuiteClient('user@company.com');

await client.sendEmail({
  from: 'user@company.com',
  recipients: ['team@company.com'],
  subject: 'Weekly Update',
  message: '<p>Here is this week’s summary…</p>',
});
```

**Q:** Implement function to fetch unread emails since a given time (publishTime - 15m), optionally filtered by labels.
**A:**

- **Design spec**
  - **Overview**: Implement `readEmailHistory` delegate using `googleapis@149.0.0` to retrieve recent unread emails since a given timestamp, with optional label filtering. Expose it only via `gsuiteClient.ts`.
  - **Constraints**
    - **Language**: TypeScript
    - **Library**: `googleapis@149.0.0`
    - **Exposure**: Only through `gsuiteClient.ts`
    - **Package conventions**:
      - Delegates under `src/lib/delegates/`
      - Tests under `src/lib/tests/`
      - Public API exposed via `gsuiteClient.ts`
  - **Auth scopes required** (must be added in `gsuiteClient.ts` mail scopes):
    - `https://www.googleapis.com/auth/gmail.readonly`
    - `https://www.googleapis.com/auth/gmail.metadata`
  - **External API references**:
    - `users.messages.list` — `https://developers.google.com/gmail/api/reference/rest/v1/users.messages/list`
    - `users.messages.get` — `https://developers.google.com/gmail/api/reference/rest/v1/users.messages/get`
    - `users.threads.get` — `https://developers.google.com/gmail/api/reference/rest/v1/users.threads/get`
  - **Inputs and outputs**
    - **Input type**: `ReadEmailHistoryContext`
      - `email: string` (required)
      - `publishTime: string` (required; ISO timestamp)
      - `labels?: string[]` (optional)
    - **Output type**: `{ messages: EmailMessage[] }`
      - Each `EmailMessage`: `subject`, `from`, `body`, `id`, `threadId`
  - **Functional behavior**
    - Compute `after` epoch as `(publishTime - 15 minutes)` to handle notification jitter
    - Build query: `is:unread after:<epoch_seconds>` plus optional label OR group
    - List candidate messages, fetch message details (`format: 'full'`), collect unique thread IDs
    - Fetch threads (`format: 'full'`), flatten messages, extract headers and plain-text body
    - Return `{ messages }`
  - **Error handling**
    - Use `Promise.allSettled` for message fetches; skip failures
    - Safe base64 decoding with try/catch; missing headers allowed
    - Propagate thread-level errors; do not fail on individual message decode issues
  - **Security and privacy**
    - Use least-privilege scopes; do not log message content
  - **Acceptance criteria**
    - Filters unread messages since `publishTime - 15 minutes`
    - Applies optional label filters
    - Returns flattened messages with expected fields
    - Implemented and exposed only via `gsuiteClient.ts`; required scopes present there
  - **Usage (via client)**

```typescript
import { makeGSuiteClient } from './lib/gsuiteClient';

const client = await makeGSuiteClient('system@company.com');

const history = await client.readEmailHistory({
  email: 'user@company.com',
  publishTime: '2024-01-15T10:30:00Z',
  labels: ['INBOX', 'IMPORTANT'],
});

// history.messages -> EmailMessage[]
```

**Q:** Implement a bulk Gmail watch setup: for each user, configure users.watch with label filters and return a summary of successes/errors
**A:**

- **Design spec**
  - **Overview**: Implement `watchEmails` delegate to configure Gmail push notifications across multiple users using `googleapis@149.0.0` `users.watch`. Delegate accepts a client factory to impersonate each user. Expose it only via `gsuiteClient.ts`.
  - **Constraints**
    - **Language**: TypeScript
    - **Library**: `googleapis@149.0.0`
    - **Exposure**: Only through `gsuiteClient.ts`
    - **Package conventions**:
      - Delegates under `src/lib/delegates/`
      - Tests under `src/lib/tests/`
      - Public API exposed via `gsuiteClient.ts`
  - **Auth scopes required** (must be added in `gsuiteClient.ts` mail scopes):
    - `https://www.googleapis.com/auth/gmail.readonly`
    - `https://www.googleapis.com/auth/gmail.metadata` (optional)
  - **External API reference**: `users.watch` — `https://developers.google.com/gmail/api/reference/rest/v1/users/watch`
  - **Inputs and outputs**
    - **Input type**: `WatchEmailsInput`
      - `config: { topicName: string; users: string[]; labelIds?: string[]; labelFilterBehavior?: 'include' | 'exclude'; }[]`
    - **Output type**: `WatchEmailsOutput`
      - `{ status: number; errors: string[]; responses: string[] }`
  - **Functional behavior**
    - For each config entry and user, impersonate via provided `makeClient(userId)` and call `gmail.users.watch`
    - Throttle auth bursts with small delay to avoid rate limits
    - Aggregate non-200 responses and rejections in `errors`; collect successful responses as strings
    - Return `{ status: 200 }` if no errors; otherwise `{ status: 400 }`
  - **Error handling**
    - Use `Promise.allSettled` to collect per-user results; include error messages or response payloads in `errors`
  - **Security and privacy**
    - Use least-privilege scopes; do not log sensitive config details
    - Pub/Sub topic must exist and Gmail service account must have publish permission
  - **Acceptance criteria**
    - Creates watches for all specified users and labels
    - Returns aggregated `responses` and `errors` with appropriate `status`
    - Implemented and exposed only via `gsuiteClient.ts`; required scopes present there
  - **Usage (via client)**

```typescript
import { makeGSuiteClient } from './lib/gsuiteClient';

const client = await makeGSuiteClient('system@company.com');

const result = await client.watchEmails({
  config: [
    {
      topicName: 'projects/my-project/topics/gmail-push',
      users: ['user1@company.com', 'user2@company.com'],
      labelIds: ['INBOX', 'IMPORTANT'],
      labelFilterBehavior: 'include',
    },
  ],
});
```

**Q:** Create a meeting scheduler that invites attendees and guarantees a Meet link; send calendar updates to all participants.
**A:**

- **Design spec**
  - **Overview**: Implement `scheduleMeeting` delegate using `googleapis@149.0.0` Calendar API to create an event with Meet conferencing and send invites. Expose it only via `gsuiteClient.ts`.
  - **Constraints**
    - **Language**: TypeScript
    - **Library**: `googleapis@149.0.0`
    - **Exposure**: Only through `gsuiteClient.ts`
    - **Package conventions**:
      - Delegates under `src/lib/delegates/`
      - Tests under `src/lib/tests/`
      - Public API exposed via `gsuiteClient.ts`
  - **Auth scopes required** (must be added in `gsuiteClient.ts` calendar scopes):
    - `https://www.googleapis.com/auth/calendar`
    - `https://www.googleapis.com/auth/calendar.events`
  - **External API reference**: `calendar.events.insert` — `https://developers.google.com/calendar/api/v3/reference/events/insert`
  - **Inputs and outputs**
    - **Input type**: `CalendarContext`
      - `summary: string` (required)
      - `description?: string`
      - `start: string` (ISO)
      - `end: string` (ISO)
      - `attendees: string[]` (required)
    - **Output type**: `ScheduleMeetingOutput`
      - `id: string`, `htmlLink: string`, `status: string`
  - **Functional behavior**
    - Validate required fields; construct event body with attendees and `conferenceData` request for Google Meet
    - Call `calendar.events.insert` with `sendUpdates: 'all'` and `conferenceDataVersion: 1`
    - Ensure Meet link present via `hangoutLink` or `conferenceData.entryPoints`
    - Return `{ id, htmlLink, status }`
  - **Error handling**
    - Throw if event creation succeeds without a Meet link
    - Surface underlying API errors
  - **Security and privacy**
    - Do not log sensitive event content
  - **Acceptance criteria**
    - Event is created with Meet link and invitations sent
    - Implemented and exposed only via `gsuiteClient.ts`; required scopes present there
  - **Usage (via client)**

```typescript
import { makeGSuiteClient } from './lib/gsuiteClient';

const client = await makeGSuiteClient('user@company.com');

const meeting = await client.scheduleMeeting({
  summary: 'Product Planning Session',
  description: 'Quarterly product roadmap review and planning',
  start: '2024-02-15T14:00:00-08:00',
  end: '2024-02-15T15:30:00-08:00',
  attendees: ['john@company.com', 'sarah@company.com', 'mike@company.com'],
});
```

**Q:** Add a basic availability finder that proposes 30-minute slots within business hours
**A:**

```typescript
deriveWindowFromTimeframe({} as MeetingRequest);
```

> _Creating a minimal stub for the MeetingRequest type since no specific request details are known._

**Q:** Make a GSuite client V2 for the user 'test@example.com'.
**A:**

- **Design spec**
  - **Overview**: Implement v1 `findOptimalMeetingTime` delegate using `googleapis@149.0.0` Calendar API (`events.list` and `freebusy.query`) to compute available time slots. Expose via `gsuiteClient.ts`.
  - **Constraints**
    - **Language**: TypeScript
    - **Library**: `googleapis@149.0.0`
    - **Exposure**: Only through `gsuiteClient.ts`
    - **Package conventions**:
      - Delegates under `src/lib/delegates/`
      - Tests under `src/lib/tests/`
      - Public API exposed via `gsuiteClient.ts`
  - **Auth scopes required** (must be added in `gsuiteClient.ts` calendar scopes):
    - `https://www.googleapis.com/auth/calendar`
    - `https://www.googleapis.com/auth/calendar.readonly`
    - `https://www.googleapis.com/auth/calendar.freebusy`
  - **External API references**:
    - `calendar.events.list` — `https://developers.google.com/calendar/api/v3/reference/events/list`
    - `calendar.freebusy.query` — `https://developers.google.com/calendar/api/v3/reference/freebusy/query`
  - **Inputs and outputs**
    - **Input type**: `OptimalTimeContext`
      - `participants: string[]`
      - `timeframe_context: string`
      - `duration_minutes: number`
      - `working_hours: { start_hour: number; end_hour: number }`
      - `timezone?: string`
    - **Output type**: `FindOptimalMeetingTimeOutput`
      - `{ suggested_times: { start: string; end: string; score: number }[]; message: string }`
  - **Functional behavior**
    - Derive search window from `timeframe_context` and working hours
    - Collect events via `events.list` and busy periods via `freebusy.query`; de-duplicate and merge
    - Generate candidate slots at fixed step, score them, and return top N
  - **Error handling**
    - Validate inputs; propagate API errors; guard against invalid dates
  - **Security and privacy**
    - Use least-privilege scopes; avoid logging event contents
  - **Acceptance criteria**
    - Returns a ranked list of time slots and a summary message
    - Implemented and exposed via `gsuiteClient.ts`; required scopes present there
  - **Usage (via client)**

```typescript
import { makeGSuiteClient } from './lib/gsuiteClient';

const client = await makeGSuiteClient('user@company.com');

const times = await client.getAvailableMeetingTimes({
  participants: ['alice@company.com', 'bob@company.com'],
  subject: 'Design Review Meeting',
  timeframe_context: 'this week',
  duration_minutes: 60,
  working_hours: { start_hour: 9, end_hour: 17 },
});
```

**Q:** enhance v1 get available meeting times to support multi-day, timezone-accurate scheduling and deterministic slotting; deliver as v2.
**A:**

- **Design spec**
  - **Overview**: Deliver an enhanced scheduler (`findOptimalMeetingTimeV2`) that addresses v1 limitations by adding multi-day windows, robust timezone handling, deterministic slot slicing, and improved busy-interval merging. Expose via `gsuiteClient.v2.ts` while preserving v1 API in `gsuiteClient.ts`.
  - **Enhancements over v1**
    - **Time windowing**: v1 derives a near-term/day window from `timeframe_context`; v2 supports explicit multi-day local windows (`windowStartLocal`, `windowEndLocal`).
    - **Timezone accuracy**: v1 approximates offsets; v2 uses IANA-aware conversions (`toUTCFromWallClock`, `toZonedISOString`) to handle DST shifts correctly.
    - **Busy merging**: v1 mixes `events.list` and day `freebusy` heuristics; v2 merges all busy intervals deterministically and subtracts them from working windows.
    - **Slot slicing**: v1 iterates 30-min steps within a day; v2 slices across the full window with configurable `slotStepMinutes` and merges adjacent intervals.
    - **Configuration**: v2 supports optional `skipFriday` and flexible working-hour windows across multiple days.
    - **Scoring**: v2 applies a consistent heuristic and sorts globally across the window.
  - **Constraints**
    - **Language**: TypeScript
    - **Library**: `googleapis@149.0.0`
    - **Exposure**: Only through `gsuiteClient.v2.ts` (extends v1 client)
    - **Package conventions**:
      - Delegates under `src/lib/delegates/`
      - Tests under `src/lib/tests/`
      - Public API exposed via `gsuiteClient.v2.ts`
  - **Auth scopes required** (configured in `gsuiteClient.ts` calendar scopes already used by v2):
    - `https://www.googleapis.com/auth/calendar`
    - `https://www.googleapis.com/auth/calendar.freebusy`
    - `https://www.googleapis.com/auth/calendar.readonly`
  - **External API references**:
    - `calendar.freebusy.query` — `https://developers.google.com/calendar/api/v3/reference/freebusy/query`
  - **Inputs and outputs**
    - Provided via `MeetingRequest` and v2 adapter logic, ultimately mapped to:
      - `attendees: string[]`, `timezone: string`, `windowStartLocal: Date`, `windowEndLocal: Date`, `durationMinutes: number`, `workingHours: { start_hour: number; end_hour: number }`, optional `slotStepMinutes`, optional `skipFriday`
    - **Output type**: `{ message: string; suggested_times: { start: string; end: string; score: number }[] }`
  - **Functional behavior**
    - Convert local windows to UTC; query `freebusy` for all attendees; merge busy intervals and subtract from daily working windows across the range
    - Slice into step-aligned slots across the full window, score, sort, and map to zoned ISO strings
  - **Error handling**
    - Validate windows, timezone conversions, and inputs; propagate API errors
  - **Security and privacy**
    - Use least-privilege scopes; avoid logging event contents
  - **Acceptance criteria**
    - Supports multi-day windows and DST-safe timezone conversions; returns globally ranked slots
    - Implemented and exposed only via `gsuiteClient.v2.ts`; required scopes configured
  - **Usage (via v2 client)**

```typescript
import { makeGSuiteClientV2 } from './lib/gsuiteClient.v2';

const client = await makeGSuiteClientV2('user@company.com');

const result = await client.getAvailableMeetingTimes({
  participants: ['alice@company.com', 'bob@company.com'],
  subject: 'Design Review Meeting',
  timeframe_context: 'next week',
  duration_minutes: 60,
  working_hours: { start_hour: 9, end_hour: 17 },
});
```

## Synthetic Variations <!-- anchor: synthetic_variations -->

_No generators proposed._

## Guardrails & Quality <!-- anchor: guardrails_quality -->

_Include test coverage & invariants if available (future enhancement)._

## Open Questions / Needs from Engineer <!-- anchor: questions_for_engineer -->

_None_

## Appendix <!-- anchor: appendix -->

- Stable section anchors provided for agent navigation.
- IDs: Prefer path-based IDs for files and export names for API items.
