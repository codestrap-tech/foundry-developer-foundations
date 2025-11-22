// userResource.ts
import type { User } from '@osdk/foundry.admin';
import { Users } from '@osdk/foundry.admin';
import { Client } from '@osdk/client';

/** Minimal resource wrapper for Suspense */
function createResource<T>(promise: Promise<T>) {
  let status: 'pending' | 'success' | 'error' = 'pending';
  let result: T;
  const suspender = promise.then(
    (r) => {
      status = 'success';
      result = r;
    },
    (e) => {
      status = 'error';
      result = e;
    },
  );

  return {
    read(): T {
      if (status === 'pending') throw suspender;
      if (status === 'error') throw result;
      return result;
    },
  };
}

export function createUserResource(getUser: () => Promise<User>) {
  return createResource<User>(getUser());
}
