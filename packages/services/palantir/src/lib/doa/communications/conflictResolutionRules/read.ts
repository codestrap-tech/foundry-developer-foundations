/**
 * Low-level function to read conflict resolution rules for a user from Foundry.
 */
export async function readConflictResolutionRules(
  userEmail: string,
  token: string,
  url: string
): Promise<string[]> {
  const fullUrl = `${url}/api/v1/users/${encodeURIComponent(
    userEmail
  )}/conflict-rules`;

  const res = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Foundry read failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as { rules?: string[] } | string[];
  return Array.isArray(body) ? body : body.rules ?? [];
}
