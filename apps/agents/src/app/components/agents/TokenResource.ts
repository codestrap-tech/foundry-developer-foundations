// userResource.ts
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

export function createTokenResource(getToken: () => Promise<string>) {
  return createResource<string>(getToken());
}
