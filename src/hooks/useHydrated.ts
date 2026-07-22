import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * Returns false on the server and for the very first client render (so the
 * markup matches the prerendered HTML during hydration), then true afterwards.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
