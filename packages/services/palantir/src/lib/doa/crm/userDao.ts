import {
  type UserDao,
} from '@codestrap/developer-foundations-types';
import { Users } from '@osdk/foundry.admin';
import { foundryClientFactory } from '../../factory/foundryClientFactory';
import { getClientType } from '../../utils/getClientType';

function getFoundryClient() {
  return foundryClientFactory(getClientType(), undefined);
}

export function makeUserDao(): UserDao {
  return async (userId?: string) => {
    const { getUser } = getFoundryClient();
    const user = await getUser();
    console.log('OSDK makeUserDao returned:', user);

    return user;
  };
}
