import {
  SupportedFoundryClients,
  type UserDao,
} from '@codestrap/developer-foundations-types';
import { Users } from '@osdk/foundry.admin';
import { foundryClientFactory } from '../../factory/foundryClientFactory';

export function makeUserDao(): UserDao {
  const { getUser } = foundryClientFactory(
    process.env.FOUNDRY_CLIENT_TYPE || SupportedFoundryClients.PRIVATE,
    undefined,
  );

  return async (userId?: string) => {
    const user = await getUser();
    console.log('OSDK makeUserDao returned:', user);

    return user;
  };
}
