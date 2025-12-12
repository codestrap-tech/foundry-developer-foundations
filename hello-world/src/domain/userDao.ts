import type { FoundryClient, UserDao } from '@hello/types';
import { TYPES } from '@hello/types';
import { container } from '@hello/inversify.config';

export function makeUserDao(): UserDao {
  const client = container.get<FoundryClient>(TYPES.FoundryClient);

  return async () => {
    const user = await client.getUser();
    console.log('OSDK makeUserDao returned:', user);

    return user;
  };
}
