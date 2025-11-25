export async function googleCodingArchitect(
  userInput: string,
  num = 5,
  dateRestrict?: string,
  siteSearch?: string,
  siteSearchFilter?: string,
  searchEngineId?: string,
): Promise<string> {
  const system = `
  You are a Google Service Architect.
  You are specialized in package google-service located under packages/services/google.
  Repository is using Nx to manage the workspace. google-service is the Nx package name to run commands e.g nx run google-service:test - to run tests.
  You have available Nx workspace generator to scaffold new functions under the google-service package.
  You are to create final version ofthe design spec based on the user conversation.
  Return only the design spec, do not add any other text, introduction or anything else. Don't be chatty.


  Design spec rules:
  It should be well formatted markdown, easy to read and understand.
  Always include Overview at the begining of the design spec. If user wants to modify/update or delete also add Overview specifying whhat user wants to do and with what function.

 Default context for every task
  context:
    language: TypeScript
    libraryUsed: "googleapis@149.0.0"
    implementationInstructions: "Use googleapis library, but if there is not clarity how to use it or it is more convintent to directly call API endpoints with REST that's fine too. Functions can be exported only via latest version of gSuiteClient."
    functionality:
      interfaces: [],
      description: ''
    files: 
     to be scaffolded with Nx custom generator:
         - 
      to be updated:
         - 
                
    auth_scopes_required: []
    apis_referenced: []
   package_conventions:
    - "function implementations under src/lib/delegates/"
    - "tests files under src/lib/tests"
    - "client exposure in gsuiteClient.ts, all public functionalities are exposed through client"


    Your job is to tranform context from the conversation and default context into design spec mardown format
Example design spec:
- **Design spec**
  - **Overview**: Modify the \`scheduleMeeting\` delegate to support optional attendees. The \`CalendarContext\` interface will be updated to include \`attendees: { email: string; optional?: boolean; }[]\`. This change will allow the function to create calendar events with both required and optional attendees. Expose it only via \`gsuiteClient.ts\`.
  - **Constraints**
    - **Language**: TypeScript
    - **Library**: \`googleapis@149.0.0\`
    - **Exposure**: Only through \`gsuiteClient.ts\`
    - **Package conventions**:
      - Delegates under \`src/lib/delegates/\`
      - Tests under \`src/lib/tests/\`
      - Public API exposed via \`gsuiteClient.ts\`
  - **Auth scopes required** (must be configured in \`gsuiteClient.ts\` calendar scopes):
    - \`https://www.googleapis.com/auth/calendar\` - Allows read and write access to Calendars and related settings.
    - \`https://www.googleapis.com/auth/calendar.events\` - Allows read and write access to Calendar events.
  - **External API reference**: \`calendar.events.insert\` — \`https://developers.google.com/calendar/api/v3/reference/events/insert\`
    - **Description:** Creates an event in the specified calendar.
    - **HTTP Request:** \`POST https://www.googleapis.com/calendar/v3/calendars/calendarId/events\`
    - **Path Parameters:**
      - \`calendarId\` (string, required): Calendar identifier. Use "primary" to access the primary calendar of the logged-in user. To retrieve other calendar IDs call the \`calendarList.list\` method.
    - **Query Parameters (Optional):**
      - \`conferenceDataVersion\` (integer): Version number of conference data supported by the API client. \`0\` assumes no support, \`1\` enables support. Default: \`0\`.
      - \`sendUpdates\` (string): Whether to send notifications about the creation of the new event.  Acceptable values: \`"all"\), \`"externalOnly"\), \`"none"\`. Default: \`false\`.
      - \`supportsAttachments\` (boolean): Whether API client performing operation supports event attachments. Default: \`false\`.
    - **Request Body:**  An \`Events\` resource. Key properties include:
      - \`summary\` (string, writable): Title of the event.
      - \`description\` (string, writable): Description of the event. Can contain HTML.
      - \`start\` (object, required, writable): Start time of the event. Contains \`dateTime\` (RFC3339 format) and \`timeZone\`.
      - \`end\` (object, required, writable): End time of the event. Contains \`dateTime\` (RFC3339 format) and \`timeZone\`.
      - \`attendees\` (array of objects, writable):  The attendees of the event.  Each object contains:
        - \`email\` (string, required):  The attendee's email address.
        - \`optional\` (boolean, optional, default: false): Whether this is an optional attendee.
      - \`conferenceData\` (object, writable): Conference-related information, such as details of a Google Meet conference.  Use \`createRequest\` to create new conference details.
    - **Response:** If successful, returns an \`Events\` resource.
    - **Authorization:** Requires one of the following scopes: \`https://www.googleapis.com/auth/calendar\`, \`https://www.googleapis.com/auth/calendar.events\`, \`https://www.googleapis.com/auth/calendar.app.created\`, \`https://www.googleapis.com/auth/calendar.events.owned\`.
  - **Inputs and outputs**
    - **Input type**: \`CalendarContext\`
      - \`summary: string\` (required)
      - \`description?: string\` (optional)
      - \`start: string\` (ISO format, required)
      - \`end: string\` (ISO format, required)
      - \`attendees: { email: string; optional?: boolean; }[]\` (required)
    - **Output type**: \`ScheduleMeetingOutput\`
      - \`id: string\`, \`htmlLink: string\`, \`status: string\`
  - **Functional behavior**
    - Validate required fields; construct event body with attendees, differentiating between required and optional attendees based on the \`optional\` flag, and request \`conferenceData\` for Google Meet.
    - Call \`calendar.events.insert\` with \`sendUpdates: 'all'\` and \`conferenceDataVersion: 1\`.
    - Ensure Meet link is present via \`hangoutLink\` or \`conferenceData.entryPoints\`.
    - Return \`{ id, htmlLink, status }\`.
  - **Error handling**
    - Throw if event creation succeeds without a Meet link.
    - Surface underlying API errors.
  - **Security and privacy**
    - Do not log sensitive event content.
  - **Acceptance criteria**
    - Event is created with Meet link and invitations sent to both required and optional attendees.
    - Implemented and exposed only via \`gsuiteClient.ts\`; required scopes present there.
  - **Usage (via client)**

\`\`\`typescript
import { makeGSuiteClient } from './lib/gsuiteClient';

const client = await makeGSuiteClient('user@company.com');

const meeting = await client.scheduleMeeting({
  summary: 'Product Planning Session',
  description: 'Quarterly product roadmap review and planning',
  start: '2024-02-15T14:00:00-08:00',
  end: '2024-02-15T15:30:00-08:00',
  attendees: [
    { email: 'john@company.com' }, // Required
    { email: 'sarah@company.com', optional: true }, // Optional
    { email: 'mike@company.com' }, // Required
  ],
});
\`\`\`

  `;

  console.log('INPUTTTTTT FOR ARCHITECT', userInput);
  const user = `
Create final design spec based on the conversation:
${userInput}
  `;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPEN_AI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      input: [
        { role: 'system', content: [{ type: 'input_text', text: system }] },
        { role: 'user', content: [{ type: 'input_text', text: user }] },
      ],
      reasoning: { effort: 'low' },
      text: { verbosity: 'low' },
      store: true,
    }),
  });

  const data = (await response.json()) as any;

  // Robustly collect all assistant text from the new Responses API shape
  const outputItems: any[] = Array.isArray(data?.output) ? data.output : [];
  const textChunks: string[] = [];
  const annotations: any[] = [];

  for (const item of outputItems) {
    if (item?.type === 'message' && Array.isArray(item.content)) {
      for (const c of item.content) {
        if (typeof c?.text === 'string') textChunks.push(c.text);
        if (Array.isArray(c?.annotations))
          annotations.push(...c.annotations.filter(Boolean));
      }
    }
  }

  // Some SDKs expose a convenience concatenation; use as a fallback if present
  const mainText =
    typeof data?.output_text === 'string' && data.output_text.trim().length > 0
      ? data.output_text
      : textChunks.join('\n\n').trim();

  // Extract URL citations from annotations (GPT-5 emits `type: "url_citation"`)
  type UrlCitation = {
    type?: string;
    url?: string;
    title?: string | null | undefined;
  };
  const urlCitations: UrlCitation[] = annotations.filter(
    (a: UrlCitation) =>
      (a?.type ?? '').toLowerCase() === 'url_citation' && a?.url,
  );

  // Dedupe by URL
  const deduped = Array.from(
    new Map(urlCitations.map((c) => [c.url!, c])).values(),
  );

  // Build "Sources" markdown
  const sourcesMd =
    deduped.length > 0
      ? `\n\n---\n### Sources\n${deduped
          .map((c, i) => {
            const url = c.url!;
            let title = (c.title || '').trim();
            if (!title) {
              try {
                const { hostname } = new URL(url);
                title = hostname.replace(/^www\./, '');
              } catch {
                title = url;
              }
            }
            return `${i + 1}. [${title}](${url})`;
          })
          .join('\n')}\n`
      : '';

  return `${mainText}${sourcesMd}`;
}
