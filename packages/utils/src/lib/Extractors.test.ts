import { extractJsonFromBackticks } from './Extractors';
describe('Testing JSON extraction and clearning', () => {
  test('extracts JSON from a normal ```json fenced block (baseline)', () => {
    const input = '```json\n{\n  "a": 1\n}\n```';
    const result = extractJsonFromBackticks(input);
    const parsed = JSON.parse(result);
    expect(parsed.a).toBe(1);
  });

  test('works when language tag is absent', () => {
    const input = '```\n{\n  "ok": true\n}\n```';
    const result = extractJsonFromBackticks(input);
    const parsed = JSON.parse(result);
    expect(parsed.ok).toBe(true);
  });

  test('handles nested backticks inside JSON string (escaped), does not terminate early', () => {
    const input =
      '```json\n{\n  "msg": "Here are backticks: \\`\\`\\` inside a string"\n}\n```';
    const result = extractJsonFromBackticks(input);
    const parsed = JSON.parse(result);
    expect(parsed.msg).toContain('`');
    expect(parsed.msg).toContain('```');
  });

  test('handles nested backticks inside JSON string (escaped, multiline)', () => {
    const input =
      '```json\r\n' +
      '{\r\n' +
      '  "body": "Start line\\n\\`\\`\\`\\nEnd line"\r\n' +
      '}\r\n' +
      '```';
    const result = extractJsonFromBackticks(input);
    const parsed = JSON.parse(result);
    expect(parsed.body).toMatch(/Start line/);
    expect(parsed.body).toMatch(/```/);
  });

  test('extracts from the FIRST fenced block even if more blocks follow', () => {
    const input =
      '```json\n{"first": true}\n```\n' +
      'Some text...\n' +
      '```json\n{"second": true}\n```';
    const result = extractJsonFromBackticks(input);
    const parsed = JSON.parse(result);
    expect(parsed.first).toBe(true);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  test('ignores earlier non-JSON fences before the JSON one (extracts from the first fenced block overall)', () => {
    const input =
      '```txt\nthis is just text\n```\n' + '```json\n{"ok": 1}\n```';
    // NOTE: By design, extractor grabs the FIRST fenced block overall,
    // so this should parse the *txt* block which is NOT JSON and should throw.
    // This test documents current behavior.
    expect(() => extractJsonFromBackticks(input)).toThrow();
  });

  test('array root is supported ([ ... ])', () => {
    const input = '```json\n[1,2,3]\n```';
    const result = extractJsonFromBackticks(input);
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toEqual([1, 2, 3]);
  });

  test('CRLF line endings are handled', () => {
    const input = '```json\r\n{\r\n  "x": 42\r\n}\r\n```';
    const result = extractJsonFromBackticks(input);
    const parsed = JSON.parse(result);
    expect(parsed.x).toBe(42);
  });

  test('leading/trailing noise outside fences is ignored', () => {
    const input = 'noise before\n```json\n{"n": 9}\n```\nnoise after';
    const result = extractJsonFromBackticks(input);
    const parsed = JSON.parse(result);
    expect(parsed.n).toBe(9);
  });

  test('parses when no fences exist', () => {
    const input = '{ "x": 1 }';
    const result = extractJsonFromBackticks(input);
    const parsed = JSON.parse(result);
    expect(parsed.x).toBe(1);
  });

  test('throws when opening fence exists but no closing fence', () => {
    const input = '```json\n{"x":1}';
    expect(() => extractJsonFromBackticks(input)).toThrow(
      /No valid closing fence/i,
    );
  });

  test('throws when JSON start is not found between fences', () => {
    const input = '```json\nnot json\n```';
    expect(() => extractJsonFromBackticks(input)).toThrow(
      /JSON must start with either \{ or \[/i,
    );
  });

  test('Fixes malformed JSON between fences', () => {
    const input = '```json\n{ "x": 1, }\n```'; // trailing comma
    const result = extractJsonFromBackticks(input);
    const parsed = JSON.parse(result);
    expect(parsed.x).toBe(1);
  });

  test('Should extract and clean JSON from a FUBAR string', () => {
    const inputJSON = `\`\`\`json
{
  "contacts": [],
  "currentUser": {
    "name": null,
    "email": "dsmiley@codestrap.me",
    "id": "cadf16c6-76c8-4ff2-8716-889f8797d547",
    "timezone": null
  },
  "messages": [
    "\\"# ** Daily Brief: Thursday, August 21, 2025 **\\\\n\\\\n## ** TL; DR **\\\\n1. ** Business-Related (CodeStrap) **: \\\\n   - ** Harshit Soni (CreativeGlu):** Proposed a meeting today (10:00–10:30 AM PT) to discuss \\\\\\"X Reason\\\\\\" and Foundry. Confirm availability or reschedule if needed.\\\\n   - ** Kerry Sporkin:** Meeting scheduled for tomorrow (Friday, August 22, 2025, 10:00–10:30 AM PT) to discuss Palantir implementations, Series A funding, and a strategic partnership with PWC. Confirm details today to avoid conflicts.\\\\n\\\\n2. ** Spam/Marketing Emails **: None detected.\\\\n\\\\n---\\\\n\\\\n## ** Business-Related Emails **\\\\n\\\\n### ** 1. Harshit Soni (CreativeGlu) – Meeting Proposal **\\\\n- ** Details **: \\\\n  - ** Topic **: CodeStrap inquiries regarding \\\\\\"X Reason\\\\\\" and Foundry.\\\\n  - ** Proposed Time **: Today, ** Thursday, August 21, 2025 **, from ** 10:00 AM to 10:30 AM PT **.\\\\n  - ** Attendees **:  \\\\n    - Dorian Smiley (<dsmiley@codestrap.me>)  \\\\n    - Harshit Soni (<harshit@creativeglu.ai>)\\\\n- ** Action Items **: \\\\n  1. Confirm availability of both attendees for the proposed time.\\\\n  2. If unavailable, propose alternative time slots and resolve scheduling conflicts.\\\\n  3. Send a follow-up email to Harshit to confirm the meeting or suggest rescheduling.  \\\\n     ** Email Draft **:  \\\\n     \\\`\\\`\\\`\\\\n     Hi Harshit,\\\\n\\\\n     I hope this message finds you well. I\\'ve checked for available times for our meeting on Thursday, August 21, 2025, from 10:00 AM to 10:30 AM (Pacific Time). Please let me know if this time works for you or if you\\'d like to reschedule.\\\\n\\\\n     Looking forward to your response.\\\\n\\\\n     Best regards,  \\\\n     Dorian Smiley\\\\n     \\\`\\\`\\\`\\\\n  4. Schedule the meeting in Google Calendar once confirmed: [Google Calendar Appointment Link](https://calendar.google.com/calendar/appointments/booking/AcZssZ0aYEsu_AL6fRFFwnjYP0cXwsbe36xOLKZWxqskikN22A3QXMRSyTW-HM-uiHtLSswtGz45Ga9x).\\\\n\\\\n---\\\\n\\\\n### **2. Kerry Sporkin – Meeting Scheduled for Tomorrow**\\\\n- **Details**: \\\\n  - **Topic**: Palantir implementations, Series A funding, and strategic partnership with PWC.\\\\n  - **Date/Time**: **Friday, August 22, 2025**, from **10:00 AM to 10:30 AM PT**.\\\\n  - **Attendees**: \\\\n    - Dorian Smiley (<dsmiley@codestrap.me>)  \\\\n    - Kerry Sporkin (<khsporkin@gmail.com>)\\\\n- **Key Discussion Points**: \\\\n  - Growing \\\\\\"cottage industry\\\\\\" around Palantir implementations.\\\\n  - CodeStrap LLC structure: exclusive partnerships, financial model, and investment strategy.\\\\n  - Transition to an ARR model and Series A funding plans.\\\\n  - Partnership with PWC to build AI-driven CFO solutions.\\\\n- **Action Items**: \\\\n  1. Confirm availability of all attendees today to avoid last-minute conflicts.\\\\n  2. Send a follow-up email to Kerry to confirm the meeting:  \\\\n     ** Email Draft **:  \\\\n     \\\`\\\`\\\`\\\\n     Hi Kerry,\\\\n\\\\n     I hope you\\'re doing well. Just confirming our meeting scheduled for Friday, August 22, 2025, from 10:00 AM to 10:30 AM (Pacific Time). Please let me know if this time still works or if there are any adjustments needed.\\\\n\\\\n     Looking forward to our discussion!\\\\n\\\\n     Best regards,  \\\\n     Dorian Smiley\\\\n     \\\`\\\`\\\`\\\\n  3. If conflicts arise, propose alternative times and reschedule promptly.\\\\n  4. Include a brief agenda in the calendar invite:  \\\\n     - Finalizing Series A strategy.  \\\\n     - Next steps for Palantir implementation opportunities.  \\\\n     - Operational details of the PWC partnership.\\\\n\\\\n**Additional Notes**: Full meeting notes from your previous discussion with Kerry are available [here](https://docs.google.com/document/d/1NwYRnCrQH3hAmdB5R_3mwhUF9wynzfPuLZbIb5AsRuo/edit?usp=meet_tnfm_email). Review them to prepare for tomorrow’s meeting.\\\\n\\\\n---\\\\n\\\\n## **Spam/Marketing Emails**\\\\nNo spam or marketing emails detected today. 🎉\\\\n\\\\n---\\\\n\\\\nThat’s it for today’s brief! Let me know if you need help with any of the tasks above. Have a productive Thursday, and enjoy your coffee!\\\\n\\\\nWarm regards,  \\\\n**Vicki** ☕  \\\\n*Your AI EA at CodeStrap*\\""
  ],
  "reasoning": "The message contains information about a meeting scheduled for tomorrow (August 22, 2025) with Kerry Sporkin. No contacts were found."
}
\`\`\``;

    const result = extractJsonFromBackticks(inputJSON);
    const parsed = JSON.parse(result);

    expect(parsed).toBeDefined();
    expect(parsed.contacts.length).toBe(0);
    expect(parsed.currentUser.email).toBe('dsmiley@codestrap.me');
  });

  test('Should extract and clean JSON from a FUBAR string with nested backticks', () => {
    const inputJSON =
      '```json' +
      '{' +
      '"contacts": [],' +
      '"currentUser": {' +
      '"name": null,' +
      '"email": "dsmiley@codestrap.me",' +
      '"id": "cadf16c6-76c8-4ff2-8716-889f8797d547",' +
      '"timezone": null' +
      '},' +
      '"messages": [' +
      '"\\"---\\\\n\\\\n### **Daily Brief: Wednesday, August 27, 2025**\\\\n\\\\n#### **TL;DR**  \\\\n- **Business-Related:** Prepare for and follow up on a scheduled meeting with Kerry Sporkin regarding CodeStrap inquiries.  \\\\n- **No spam or irrelevant marketing emails detected.**\\\\n\\\\n---\\\\n\\\\n#### **Business-Related Emails**\\\\n\\\\n1. **Meeting Confirmation: CodeStrap Inquiries with Kerry Sporkin**  \\\\n   - **Details:**  \\\\n     - **Date & Time:** Today, 12:30 PM - 1:00 PM (Pacific Time)  \\\\n     - **Attendees:** Dorian Smiley (you) and Kerry Sporkin  \\\\n     - **Platform:** Google Meet ([Join Link](https://meet.google.com/omd-ugvf-shm?hs=224))  \\\\n     - **Background:** Kerry learned about CodeStrap via Medium and has confirmed attendance.  \\\\n\\\\n   - **Action Items:**  \\\\n     - Prepare meeting materials, including agenda and discussion points.  \\\\n     - Test Google Meet link for technical readiness.\\\\n\\\\n---\\\\n\\\\n2. **Follow-Up Email to Kerry Sporkin**  \\\\n   - **Details:**  \\\\n     - Send a follow-up email to reconfirm meeting details and encourage Kerry to test the Google Meet setup.  \\\\n     - Use the provided draft email:  \\\\n       ```\\\\n       Hi Kerry, \\\\n       Thank you for accepting the invitation to discuss CodeStrap inquiries.As a reminder, the meeting is scheduled for Wednesday, August 27, 2025, from 12: 30 PM to 1:00 PM(Pacific Time).Please feel free to test the Google Meet setup beforehand using the provided link.Looking forward to our discussion.\\\\n\\\\n       Best regards, \\\\n       Dorian Smiley\\\\n       ```\\\\n\\\\n   - **Action Items:**  \\\\n     - Send this email by the end of the day.\\\\n\\\\n---\\\\n\\\\n#### **Task List to Tackle Today**\\\\n\\\\n1. **Prepare for the Meeting:**  \\\\n   - Review any background information or inquiries from Kerry.  \\\\n   - Draft an agenda or key talking points.  \\\\n   - Test the Google Meet link to ensure smooth connectivity.\\\\n\\\\n2. **Send Follow-Up Email:**  \\\\n   - Use the draft provided above to confirm details and assist Kerry with the meeting setup.\\\\n\\\\n3. **Post-Meeting Follow-Up Plan:**  \\\\n   - After the meeting, summarize key points and outline next steps for Kerry.  \\\\n\\\\n---\\\\n\\\\nEnjoy your coffee and let’s make this Wednesday productive!  \\\\n\\\\nWarm regards,  \\\\nVicki\\""' +
      '],' +
      '"reasoning": "The message contains the details of a meeting scheduled for today with Kerry Sporkin."' +
      '}' +
      '```';

    const result = extractJsonFromBackticks(inputJSON);
    const parsed = JSON.parse(result);

    expect(parsed).toBeDefined();
    expect(parsed.contacts.length).toBe(0);
    expect(parsed.currentUser.email).toBe('dsmiley@codestrap.me');
  });
});
