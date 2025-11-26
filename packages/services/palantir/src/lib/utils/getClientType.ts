import { SupportedFoundryClients } from '@codestrap/developer-foundations-types';
import { getRequestContext } from '@codestrap/developer-foundations-utils/src/lib/asyncLocalStorage';

/**
 * Determines which Foundry client type to use based on environment variables and request context.
 *
 * Priority:
 * 1. If FOUNDRY_CLIENT_TYPE is explicitly set, use it
 * 2. If a token exists in the request context, use PUBLIC (client-side auth)
 * 3. Otherwise, default to PRIVATE (server-side auth)
 */
export function getClientType(): SupportedFoundryClients {
  // If FOUNDRY_CLIENT_TYPE is explicitly set, use it
  if (process.env.FOUNDRY_CLIENT_TYPE) {
    return process.env.FOUNDRY_CLIENT_TYPE as SupportedFoundryClients;
  }

  // Check if we have a token in the request context (indicates PUBLIC client should be used)
  const context = getRequestContext();
  if (context?.token) {
    return SupportedFoundryClients.PUBLIC;
  }

  // Default to PRIVATE for server-side operations
  return SupportedFoundryClients.PRIVATE;
}
