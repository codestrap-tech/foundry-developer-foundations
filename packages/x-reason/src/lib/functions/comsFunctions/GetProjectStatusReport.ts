import type {
  Context,
  MachineEvent,
} from '@codestrap/developer-foundations-types';

// TODO finish this type
export type ProjectStatusReport = {
  id: string;
  estimatedCompletionDate: Date;
  sprintsRemaining: number;
};

// This function will eventually work with our Foundry Native project management system
// For now it's just stubbed out
export async function getProjectStatusReport(
  context: Context,
  event?: MachineEvent,
  task?: string,
): Promise<ProjectStatusReport> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id: '1234sdf',
        estimatedCompletionDate: new Date(),
        sprintsRemaining: 5,
      });
    }, 500);
  });
}
