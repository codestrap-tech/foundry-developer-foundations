import type { User } from "@osdk/foundry.admin";

export async function callAskVickie({
  action,
  token,
  user,
  text,
  query,
  threadId,
  plan,
  forward,
  executionId,
  inputs,
}: {
  action: string;
  token: string,
  user: User;
  text?: string;
  query?: string;
  threadId?: string;
  plan?: string;
  forward?: string;
  executionId?: string;
  inputs?: string;
}) {
  const body = new URLSearchParams({
    action,
    ...(query ? { query } : {}),
    ...(user ? { user: JSON.stringify(user) } : {}),
    ...(text ? { text } : {}),
    ...(threadId ? { threadId } : {}),
    ...(plan ? { plan } : {}),
    ...(forward ? { forward } : {}),
    ...(executionId ? { executionId } : {}),
    ...(inputs ? { inputs } : {}),
  });

  // fire and forget as there is a timeout we have to deal with
  const result = await fetch('/api/vickie', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-foundry-access-token': token,
    },
    body: body.toString(),
  });

  return result;
}
