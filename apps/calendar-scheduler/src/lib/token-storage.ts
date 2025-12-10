import fs from 'fs/promises';
import path from 'path';
import { TokenStore, UserTokens } from '../types/tokens';

const TOKENS_FILE = path.join(process.cwd(), 'apps/calendar-scheduler/tokens.json');

/**
 * Promise-wrapped read from JSON file.
 * This abstraction allows future replacement with database storage.
 */
export async function getTokenStore(): Promise<TokenStore> {
  try {
    const data = await fs.readFile(TOKENS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { users: {} };
  }
}

/**
 * Promise-wrapped write to JSON file.
 * This abstraction allows future replacement with database storage.
 */
export async function saveTokenStore(store: TokenStore): Promise<void> {
  await fs.writeFile(TOKENS_FILE, JSON.stringify(store, null, 2));
}

/**
 * Get tokens for a specific user by userId.
 */
export async function getUserTokens(userId: string): Promise<UserTokens | null> {
  const store = await getTokenStore();
  return store.users[userId] || null;
}

/**
 * Save tokens for a user.
 */
export async function saveUserTokens(tokens: UserTokens): Promise<void> {
  const store = await getTokenStore();
  store.users[tokens.userId] = tokens;
  await saveTokenStore(store);
}

/**
 * Get all users with stored tokens.
 */
export async function getAllUsers(): Promise<UserTokens[]> {
  const store = await getTokenStore();
  return Object.values(store.users);
}

/**
 * Delete a user's tokens.
 */
export async function deleteUserTokens(userId: string): Promise<void> {
  const store = await getTokenStore();
  delete store.users[userId];
  await saveTokenStore(store);
}

