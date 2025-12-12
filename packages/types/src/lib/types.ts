import type { ComputeModule } from '@palantir/compute-module';
import type { Client } from '@osdk/client';
import type { Static } from '@sinclair/typebox';
import { Type } from '@sinclair/typebox';
import type { StateValue } from 'xstate';
import type { calendar_v3, gmail_v1, drive_v3 } from 'googleapis';
import type { User as FoundryUser } from '@osdk/foundry.admin';

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
  ConflictResolutionRulesDao: Symbol.for('ConflictResolutionRulesDao'),
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
  OfficeServiceV3: Symbol.for('OfficeServiceV3'),
  VersionControlService: Symbol.for('VersionControlService'),
  MessageService: Symbol.for('MessageService'),
  EmbeddingsService: Symbol.for('EmbeddingsService'),
  TrainingDataDao: Symbol.for('TrainingDataDao'),
  LoggingService: Symbol.for('LoggingService'),
  LarryCodingAgentFactory: Symbol.for('LarryCodingAgentFactory'),
  LarryStream: Symbol.for('LarryStream'),
};

export type ResearchAssistant = (
  userInput: string,
  num?: number,
  dateRestrict?: string,
  siteSearch?: string,
  siteSearchFilter?: string,
  searchEngineId?: string,
) => Promise<string>;

export type CodingResearchAssistant = (
  userInput: string,
  num?: number,
  dateRestrict?: string,
  siteSearch?: string,
  siteSearchFilter?: string,
  searchEngineId?: string,
) => Promise<string>;

export type CodingArchitect = (
  userInput: string,
  num?: number,
  dateRestrict?: string,
  siteSearch?: string,
  siteSearchFilter?: string,
  searchEngineId?: string,
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
        }),
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
        }),
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
        }),
      ),
      timezone: Type.String(),
    }),
    output: Type.Object({
      suggested_times: Type.Array(
        Type.Object({
          start: Type.String(),
          end: Type.String(),
          score: Type.Number(),
        }),
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
    caShareUsGdp?: number,
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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  on(event: string, handler: Function): TestModule;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
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
  id?: string;
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
    content: string | Buffer; // raw content, will be base64-encoded
    branch?: string;
    sha?: string; // required for updates
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
    meetingRequest: MeetingRequest,
  ) => Promise<FindOptimalMeetingTimeOutput>;
  scheduleMeeting: (meeting: CalendarContext) => Promise<ScheduleMeetingOutput>;
  sendEmail: (email: EmailContext) => Promise<SendEmailOutput>;
  readEmailHistory: (
    context: ReadEmailHistoryContext,
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

export type OfficeServiceV3 = {
  proposeMeetingConflictResolutions: (
    input: ProposeMeetingConflictResolutionsInput,
  ) => Promise<ProposeMeetingConflictResolutionsOutput>;
  createGoogleSlides: (
    input: CreateGoogleSlidesInput,
  ) => Promise<CreateGoogleSlidesOutput>;
} & OfficeServiceV2;

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
    assignees?: string,
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
    lockUntil?: number,
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
    id?: string,
  ) => Promise<Communications>;
  delete: (id: string) => Promise<void>;
  read: (id: string) => Promise<Communications>;
};

export type ConflictResolutionRulesDao = {
  upsert: (userEmail: string, rules: string[]) => Promise<string[]>;
  delete: (userEmail: string) => Promise<void>;
  read: (userEmail: string) => Promise<string[]>;
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
    rfpResponseStatus?: number,
  ) => Promise<RfpRequests>;
  delete: (id: string) => Promise<void>;
  read: (id: string) => Promise<RfpRequests>;
  search: (
    machineExecutionId: string,
    vendorId: string,
  ) => Promise<RfpRequests>;
};

export type RangrRequestsDao = {
  submit: (
    rfp: string,
    machineExecutionId: string,
  ) => Promise<RfpRequestResponse>;
};

export type MemoryRecallDao = {
  upsert: (
    id: string,
    originalText: string,
    source: string,
    userId?: string,
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
    humanReview?: string,
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
    talksTo?: string,
  ) => Promise<Contacts>;
  delete: (id: string) => Promise<void>;
  read: (id: string) => Promise<Contacts>;
  search: (
    fullName: string,
    company: string,
    pageSize?: number,
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

export interface ProposeMeetingConflictResolutionsInput {
  userEmails: string[];
  timeFrameFrom: Date;
  timeFrameTo: Date;
  timezone: string;
}

export type GoogleSlideContentTargetType = 'OBJECT_ID' | 'PLACEHOLDER';
export interface GoogleSlideContentItem {
  targetType: GoogleSlideContentTargetType; // Required
  objectId?: string; // (Currently unsupported for duplication mode)
  placeholder?: string; // Required if targetType is "PLACEHOLDER"
  text: string; // Required
}

/**
 * A single logical slide in the generated deck.
 * All content items in this slide are applied to the same pageObjectId.
 */
export interface GoogleSlide {
  /**
   * Optional ordering hint ─ used to sort slides before creating them.
   * If omitted, the implementation may treat it as 0 or use array order.
   */
  slideNumber?: number;
  content: GoogleSlideContentItem[]; // All placeholder fills for this slide
}

/**
 * One output presentation to create from a template.
 */
export interface GoogleSlideCreationInput {
  templateId: string; // URL or fileId of the Google Slide deck
  name?: string; // Optional custom name for the new slide deck
  content: GoogleSlide[]; // Logical slides, each mapped to one duplicated page
}

export type CreateGoogleSlidesInput = GoogleSlideCreationInput[];

export interface GoogleSlideCreationSuccess {
  inputIndex: number;
  templateId: string; // Normalized fileId
  presentationId: string; // Same as fileId of the copied deck
  fileId: string; // Alias of presentationId for Drive semantics
  name: string; // Final name in Drive
  webViewLink: string; // Link to view in browser
  webContentLink?: string; // Link for download (if available)
  createdAt: string; // ISO timestamp
  warnings?: string[]; // e.g., missing objectIds, skipped content items
}
export interface GoogleSlideCreationFailure {
  inputIndex: number;
  templateId?: string;
  errorCode: string;
  errorMessage: string;
  details?: unknown;
}
export interface CreateGoogleSlidesOutput {
  successes: GoogleSlideCreationSuccess[];
  failures: GoogleSlideCreationFailure[];
}

export type ProposeMeetingConflictResolutionsOutput = Array<
  EventSummary & {
    email: string;
    resolutionBlocks: { start: string; end: string; score?: number }[];
  }
>;

export type StreamCallback<T = unknown> = (data: T) => void;

export type LarryNotification = {
  type: 'info' | 'error';
  message: string;
  metadata: Record<string, any>;
};

export interface StreamEntry {
  value: unknown;
  subscribers: Set<StreamCallback<unknown>>;
}

export interface Subscription<T = unknown> {
  unsubscribe: () => void;
  getValue: () => T | null;
}

export interface LarryStream {
  subscribe: (
    id: string,
    callback: StreamCallback<LarryNotification>,
  ) => Subscription<LarryNotification>;
  publish: (opts: { id: string; payload: LarryNotification }) => void;
}
