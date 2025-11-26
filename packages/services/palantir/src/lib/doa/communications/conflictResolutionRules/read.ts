/**
 * Low-level function to read conflict resolution rules for a user from Foundry.
 */
export async function readConflictResolutionRules(
  userEmail: string,
  token: string,
  url: string
): Promise<string[]> {
  // mock response for testing with promise
  return new Promise((resolve, reject) => {
    // reject(new Error('Mock error for testing'));
    setTimeout(() => {
      resolve([
        'Prioritize meetings with dsmiley@codestrap.me over other internal meetings',
        'Prioritize external meetings over internal meetings',
      ]);
    }, 1000);
  });

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
