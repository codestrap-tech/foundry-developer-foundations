import type {
  Context,
  MachineEvent,
} from '@codestrap/developer-foundations-types';
import {
  extractJsonFromBackticks,
  uuidv4,
} from '@codestrap/developer-foundations-utils';
import { container } from '@codestrap/developer-foundations-di';
import type {
  GeminiService,
  TicketsDao,
} from '@codestrap/developer-foundations-types';
import { TYPES } from '@codestrap/developer-foundations-types';

enum Users {
  Connor_Deeks = '147c63f3-69c1-4576-88a2-49e2cb6421c7',
  Dorian_Smiley = 'cadf16c6-76c8-4ff2-8716-889f8797d547',
}

// TODO finish this type
export type TaskDetails = {
  id: string;
  description: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  assignee: Users;
  taskType: 'Task' | 'Bug' | 'Chore';
  severity: 'Critical' | 'High' | 'Low';
  title: string;
  points: 1 | 2 | 3 | 5;
};

export async function createTask(
  context: Context,
  event?: MachineEvent,
  task?: string,
): Promise<TaskDetails> {
  const system = `You are a helpful virtual project manager in charge of task creation and assignments.
    You are professional in your tone, personable, and always start your messages with the phrase, "Hi, I'm Viki, Code's AI EA" or similar. 
    You can get creative on your greeting, taking into account the day of the week. Today is ${new Date().toLocaleDateString(
      'en-US',
      { weekday: 'long' },
    )}. 
    You can also take into account the time of year such as American holidays like Halloween, Thanksgiving, Christmas, etc. 
    The current month is ${new Date().toLocaleDateString('en-US', {
      month: 'long',
    })}. 
    When creating a task you always create a task title, description, and point estimation.
    You also careful decide on the severity based on the ask from the end user.`;

  const user = `
    Using the ask from the end user below create a ticket. You must:
    1. Create a title
    2. Create descirption
    3. Determine the points which can be 1,2,3 or 5 based on the time and complexity which you must estimate
    4. The ticket type which cab be either Task, Bug, or Chore
    5. Determine who to assign the ticket to. To determine who to assign the ticket to use this following information:

    Connor_Deeks - Connor Deeks in the CEO and board memeber in charge of platform leads, business strategy, and investor relations.
    Dorian_Smiley - Dorian is the CTO who manages the software engineers and is responsible for technology strategy, execution, and the lead applied AI engineer.

    If the task explicitly contains a name pick the most likely person from the list above based on the supplied name and role. 
    Otherwise just pick the most likely person based on role.

    The ask from the end user:
    ${task}

    You can only respond in JSON in the following format:
    {
        description: string,
        assignee: string,
        taskType: "Task" | "Bug" | "Chore",
        // Critical is reserved for system outages, customer service issues, legal, or tax problems
        // High is reserved for achieving a business outcome
        // low is for everything else
        severity: "Critical" | "High" | "Low",
        title: string,
        points: 1 | 2 | 3 | 5,
    }

    For example if the ask from the user is:
    "Dorian needs to figure out how we are going to apply DSpy to help automate prompt and model alignment"
    
    An accetable response is:
    {
        "description": "Hello Dorian, Viki here. Can you please explore how we can apply DSpy to help automate prompt and model alignment.",
        "assignee": "Dorian_Smiley",
        "taskType": "Task",
        "severity": "Low",
        "title": "Research DSpy",
        "points": 3,
    }

    If you know additional information that might be helpful context for the task based on your training data you can include it.
    Some additional context that might be helpful:
    Our tech stack is built on Palantir Foundry
    Our primary programming languages are TypeSrript, React, Javascript, Node, and Python. 
    We use Python for data science and data engineering. We use TypeScript, React, and Node for applications
    We are an AI services startup that specializes in delivers consulting services as software products.
    Sometimes we like to joke around so if someone takes vacation and leaves us doing a bunch of work will
    might ask you to "mess with so and so" by assinging them a mountain of work. Something really hard like engineer a new transformer architecture
    with a bunch of research work. You can have when the ask is prefixed with "mess with", "fuck with", etc. It is innosent fun. Just be sure to say just kidding at the end.
    `;

  const geminiService = container.get<GeminiService>(TYPES.GeminiService);

  const response = await geminiService(user, system);

  const clean = extractJsonFromBackticks(response);

  const parsedResult = JSON.parse(clean);
  // TODO handle retried if we fail to parse the result

  const description = parsedResult.description;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const assignee = Users[parsedResult.assignee];
  const taskType = parsedResult.taskType;
  const severity = parsedResult.severity;
  const title = parsedResult.title;
  const points = parsedResult.points;

  const ticketDoa = container.get<TicketsDao>(TYPES.TicketDao);
  const upsertResult = await ticketDoa.upsert(
    uuidv4(),
    title,
    taskType,
    description,
    severity,
    'Open',
    points,
    assignee,
  );

  const parameters: TaskDetails = {
    id: upsertResult.alertId,
    status: upsertResult.status as 'Open' | 'In Progress' | 'Resolved',
    title,
    description,
    assignee,
    taskType,
    severity,
    points,
  };

  return parameters;
}
