import { useEffect, useMemo, useSyncExternalStore } from "react";

import { ConsoleLogService } from "../../platform/logging/console-log.service";
import { GlobalStateProvider } from "../../platform/state/global-state";
import type { KeyDefinition } from "../../platform/state/state-definition";

const provider = new GlobalStateProvider({ log: new ConsoleLogService(__DEV__), canWrite: false });

type Store<T> = { value: T; loaded: boolean; listeners: Set<() => void> };
const stores = new Map<string, Store<unknown>>();

/**
 * Reads a GlobalState in React through `useSyncExternalStore`, live-updated by
 * `storage.onChanged`. Read-only: changes go through commands to the background.
 */
export function useGlobalState<T>(definition: KeyDefinition<T>): { value: T; loaded: boolean } {
  const key = definition.storageKey;
  const store = useMemo(() => {
    const existing = stores.get(key) as Store<T> | undefined;
    if (existing !== undefined) {
      return existing;
    }
    const created: Store<T> = {
      value: definition.options.defaultValue,
      loaded: false,
      listeners: new Set(),
    };
    stores.set(key, created as Store<unknown>);
    return created;
  }, [key, definition]);

  useEffect(() => {
    const state = provider.get(definition);
    const publish = (value: T) => {
      store.value = value;
      store.loaded = true;
      store.listeners.forEach((listener) => listener());
    };
    const unsubscribe = state.subscribe(publish);
    void state.get().then(publish);
    return unsubscribe;
  }, [definition, store]);

  const value = useSyncExternalStore(
    (listener) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    () => store.value,
  );
  const loaded = useSyncExternalStore(
    (listener) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    () => store.loaded,
  );
  return { value, loaded };
}
