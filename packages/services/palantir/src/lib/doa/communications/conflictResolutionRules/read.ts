/**
 * Low-level function to read conflict resolution rules for a user from Foundry.
 */
export async function readConflictResolutionRules(
  userEmail: string,
  token: string,
  url: string,
): Promise<string[]> {
  const commonRules = [
    'Prioritize external meetings over internal meetings',
    'Prioritize meetings with participants over personal meetings (personal meetings usually have 1 participant)',
    'Prefer meetings within working hours (e.g., 9am–5pm local time)',
    'Minimize meetings late on Fridays or before holidays',
    'Prioritize meetings with higher-level stakeholders',
    'Respect time zones of all participants',
    'Allow adequate breaks between meetings if possible (e.g., 5-15 minutes between meetings)',
    'Limit back-to-back meetings to two in a row if possible',
    'Prefer meetings involving fewer conflicts among invitees',
    'Prefer not to schedule on national or religious holidays',
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
