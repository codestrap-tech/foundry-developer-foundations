import type {
  Context,
  MachineEvent,
  UserProfile,
  UserDao} from '@codestrap/developer-foundations-types';
import {
  TYPES
} from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';

// This function enriches the context with the most likely user profiles relevant to the user's request
// This is usefule for sending emails and status reports where files need to be referenced
export async function userProfile(
  context: Context,
  event?: MachineEvent,
  task?: string
): Promise<UserProfile> {
  const userProfile: UserProfile = {
    name: undefined,
    id: undefined,
    email: undefined,
    timezone: undefined,
  };

  if (context.userId) {
    const currentUser = await container.get<UserDao>(TYPES.UserDao)(
      context.userId
    );
    userProfile.name = `${currentUser?.givenName} ${currentUser?.familyName}`;
    userProfile.email = currentUser?.email;
    userProfile.id = currentUser?.id;
    userProfile.timezone = 'America/Los_Angeles'; // hard code for now, will need some way to look this up in the future
  }

  return userProfile;
}
