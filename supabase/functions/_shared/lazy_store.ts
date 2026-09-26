import type { Store } from './store.ts';

/**
 * A Store that builds the real one the first time it is used.
 *
 * Why: loading the Supabase client is the slowest part of a cold start (about 2 seconds), and
 * LINE gives up on a webhook that does not answer quickly. The webhook answers LINE first and
 * does its work in the background, so the client can load then instead of holding up the answer.
 */
export function lazyStore(load: () => Promise<Store>): Store {
  let loading: Promise<Store> | undefined;
  const get = () => (loading ??= load());

  return new Proxy({} as Store, {
    get(_target, prop) {
      // `then` must stay undefined, or awaiting this object would try to treat it as a promise
      if (typeof prop !== 'string' || prop === 'then') return undefined;
      return async (...args: unknown[]) => {
        const store = await get().catch(error => {
          loading = undefined; // a failed load (say, a missing secret) is retried on the next call
          throw error;
        });
        return (store as unknown as Record<string, (...a: unknown[]) => unknown>)[prop](...args);
      };
    },
  });
}
