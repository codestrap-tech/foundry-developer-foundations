import type {
  Context,
  MachineEvent,
  ContactsDao,
  GeminiService,
  MemoryRecallDao,
  UserDao,
  UserProfile} from '@codestrap/developer-foundations-types';
import {
  TYPES
} from '@codestrap/developer-foundations-types';
import { extractJsonFromBackticks } from '@codestrap/developer-foundations-utils';
import { container } from '@codestrap/developer-foundations-di';

export type ModelMemory = {
  contacts: {
    name: string;
    email: string;
  }[];
  currentUser: {
    name: string;
    email: string;
    id: string;
    timezone: string;
  };
  messages: string[];
  reasoning: string;
};

export async function recall(
  context: Context,
  event?: MachineEvent,
  task?: string
): Promise<ModelMemory> {
  const memoryRecallDao = container.get<MemoryRecallDao>(TYPES.MemoryRecallDao);
  const contactsDao = container.get<ContactsDao>(TYPES.ContactsDao);
  const userDao = container.get<UserDao>(TYPES.UserDao);

  // find the user profile state
  const lastStackKey = context?.stack?.find(
    (stackItem) => stackItem.indexOf('userProfile') >= 0
  );
  const userDetails: UserProfile = {
    name: undefined,
    id: undefined,
    email: undefined,
    timezone: undefined,
  };

  // prefer the user profile loaded as a result of the previous state being executed
  if (lastStackKey) {
    const retrievedUser = context[lastStackKey] as UserProfile;
    userDetails.name = retrievedUser.name;
    userDetails.id = retrievedUser.id;
    userDetails.email = retrievedUser.email;
    userDetails.timezone = retrievedUser.timezone;
  } else if (context.userId) {
    // use the context as a fallback
    const user = await userDao(context.userId);
    userDetails.name = `${user.givenName} ${user.familyName}`;
    userDetails.id = user.id;
    userDetails.email = user.email;
    userDetails.timezone = 'America/Los_Angeles'; // hard code for now, will need some way to look this up in the future
  }

  // find any daily briefs that are relevant here
  const matchedMessages = await memoryRecallDao.search(task!, 1);

  // match any relevant contacts based on name and the task
  const matchedContacts = await contactsDao.search(task!, task!);

  const messagesString = JSON.stringify(
    matchedMessages.map((message) => ({
      messageText: JSON.stringify(message.originalText),
      taskOwnerIfAny: message.userId,
      source: message.source,
    }))
  );

  const contactsString = JSON.stringify(
    matchedContacts.map((contact) => ({
      name: contact.fullName,
      email: contact.email,
      talksTo: contact.talksTo,
      contextOfTheRelatioship: contact.notes,
      account: contact.keyAccounts,
      company: contact.company,
      notes: contact.notes,
    }))
  );

  const user = `
    Extract the exact contact and messages that are relvant to the task below using the provided recalled conversations and contact information.
    Include your reasoning.

    # Task
    ${task}

    # User Executing This Request
    ${JSON.stringify(userDetails)}

    # Contacts retrieved using fuzzy matching based on the task. 
    Pick the best possible contact(s) to return based on task, if any
    If the user has not specified a name but instead a role description or company name determine which persons(s) are the best possible match
    If no contacts are are relevant to the task return an empty array
    ${contactsString}

    # Messages retrieved using vector search:
    Only return messages relevant to the task at hand, if any
    If not messages are relevant to the task return an empty array
    ${messagesString}

    You can only respond in JSON in the following format:
    {
        contacts: {
            name: string,
            email: string,
        }[],
        currentUser: {
            name: string,
            email: string,
            id: string,
            timezone: string,
        },
        messages: string [];
        reasoning: string;
    }

    For example if you are provided:
    # Task
    Schedule a meeting with Bob for Monday to discuss Ford as a possible customer in 2026

    # User Executing This Request
    {
        name: 'Dorian Smiley',
        id: '1234',
        email: 'dsmiley@codestrap.me',
        timezone: 'America/Los_Angeles',
    }

    # Contacts retrieved using fuzzy matching based on the task. 
    Only return contacts where you are 90% sure or more they are the ones refered to in the task, if any. 
    Use the provided message, if any, to give you more context on which contact is the most relevant
    If not contacts are are relevant to the task return an empty array
    ${JSON.stringify([
    {
      name: 'Bob Seager',
      email: 'bob.seager@ford.com',
      talksTo: 'DORIAN',
      contextOfTheRelatioship: [
        'Met a few times at AIP/DevCon, See each other at every event, Worked with him on several bootcamps, small sessions, and AIPcon prep',
      ],
      account: 'Ford',
    },
    {
      name: 'Bob Baymon',
      email: 'bob.baymon@gmail.com',
      talksTo: 'CONNOR',
      contextOfTheRelatioship: ['Friend of mine that works at IBM'],
      account: 'Personal',
    },
  ])}

    # Messages retrieved using vector search:
    Only return messages where you are 90% sure or more they are relevant to the task at hand, if any
    If not messages are relevant to the task return an empty array
    ${JSON.stringify([])}
    
    
    Your response is:
    {
        "contacts": [
            {
                "name": "Bob Seager",
                "email": "bob.seager@ford.com"
            }
        ],
        "currentUser": {
            "name": "Dorian Smiley",
            "id": "1234",
            "email": "dsmiley@codestrap.me",
            "timezone": "America/Los_Angeles"
        },
        "messages": [],
        "reasoning": "Bob Seager works at Ford as is likely the Bob being reffered to."
    }
    `;

  const system = `You are a helpful AI assistant tasked with extracting relevant context details for user tasks. 
    You always obey the user instructions and pay close attention to detail. You are not chatty and always respond in the requested JSON structure, nothing else.`;

  const geminiService = container.get<GeminiService>(TYPES.GeminiService);

  let parsedResult;
  let response;
  let result

  try {
    response = await geminiService(user, system);

    result = extractJsonFromBackticks(response);

    parsedResult = JSON.parse(result) as ModelMemory;
  } catch (e) {
    console.log(e);
    console.log(`the model returned the following invalid JSON: ${response}`);
    // god I hate my life
    response = await geminiService(`
      ${user} 
      
      Your response of:
      ${response}
      
      Is not fucking valid JSON!!! It produce the following error:
      ${(e as Error).message}
      Stop sending me dog shit responses and send me valid fucking JSON!!!!!!!
      `, system);

    result = extractJsonFromBackticks(response);

    parsedResult = {
      contacts: [],
      currentUser: userDetails,
      messages: [],
      reasoning: 'this model returned an empty response for the grounding context',
    } as ModelMemory;
  }

  return parsedResult;
}
