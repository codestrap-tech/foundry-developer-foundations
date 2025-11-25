import type { Context, MachineEvent } from '@codestrap/developer-foundations-types';

export type File = {
  kind: string;
  id: string;
  name: string;
  mimeType: string;
  modifiedDate: Date;
};

// This function will eventually retrieves the most recent versions of files from Google Drive using the input prompt and sends back as a list
// This is useful for sending emails and status reports where files need to be referenced
// For now it's just stubbed out
export async function getProjectFiles(
  context: Context,
  event?: MachineEvent,
  task?: string
): Promise<File[]> {
  return new Promise((resolve) => {
    // TODO use LLM to extract the input parameters from the context.solution parameter
    // IE "construct the query parameter for Google Drive API find files ${context.solution}"
    setTimeout(() => {
      resolve([
        {
          kind: 'drive#file',
          id: '1234567890abcdef',
          name: 'important_document.pdf',
          mimeType: 'application/pdf',
          modifiedDate: new Date('2023-12-20T15:30:00Z'),
        },
      ]);
    }, 500);
  });
}
