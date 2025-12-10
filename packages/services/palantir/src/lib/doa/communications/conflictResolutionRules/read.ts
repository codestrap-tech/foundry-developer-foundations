/**
 * Low-level function to read conflict resolution rules for a user from Foundry.
 */
export async function readConflictResolutionRules(
  userEmail: string,
  token: string,
  url: string
): Promise<string[]> {
  // Those are the rules for LLM to prioritize meetings
  // Rules should be as if LLM had only meeting info in context, no other information
  const commonRules = [
    'Prioritize external meetings over internal meetings',
    'Prioritize meetings with participants over personal meetings (personal meetings usually have 1 participant)',
    'Prefer meetings within working hours (e.g., 9am–5pm local time)',
    'Prioritize meetings with higher-level stakeholders',
    'Prefer meetings involving fewer conflicts among invitees',
    'Prioritize meetings with mandatory attendees over optional ones',
    'Prioritize meetings with more participants over less participants',
  ];
  return commonRules;

  // const fullUrl = `${url}/api/v1/users/${encodeURIComponent(
  //   userEmail
  // )}/conflict-rules`;

  // const res = await fetch(fullUrl, {
  //   method: 'GET',
  //   headers: {
  //     Authorization: `Bearer ${token}`,
  //     'Content-Type': 'application/json',
  //   },
  // });

  // if (!res.ok) {
  //   throw new Error(`Foundry read failed: ${res.status} ${res.statusText}`);
  // }

  // const body = (await res.json()) as { rules?: string[] } | string[];
  // return Array.isArray(body) ? body : body.rules ?? [];
}
