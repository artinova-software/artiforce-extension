import { BrowserApi, type StorageArea } from "../browser/browser-api";
import { Mutex } from "../concurrency/mutex";
import type { LogService } from "../logging/log.service";
import type { KeyDefinition } from "./state-definition";

export type GlobalState<T> = {
  get(): Promise<T>;
  /** Read-modify-write under the key's mutex. Background only. */
  update(change: (current: T) => T | Promise<T>): Promise<T>;
  remove(): Promise<void>;
  /** Called with each new validated value; returns the unsubscribe function. */
  subscribe(listener: (value: T) => void): () => void;
};

export type GlobalStateProviderOptions = {
  log: LogService;
  /** Only the background writes; the popup and content scripts read. */
  canWrite: boolean;
};

/** Hands out GlobalState objects backed by `chrome.storage`, one mutex per storage key. */
export class GlobalStateProvider {
  private readonly mutexes = new Map<string, Mutex>();

  constructor(private readonly options: GlobalStateProviderOptions) {}

  get<T>(definition: KeyDefinition<T>): GlobalState<T> {
    const area: StorageArea = BrowserApi.storageArea(
      definition.state.location === "disk" ? "local" : "session",
    );
    const key = definition.storageKey;
    const { schema, defaultValue } = definition.options;
    const { log, canWrite } = this.options;

    const parse = (raw: unknown): T => {
      if (raw === undefined) {
        return defaultValue;
      }
      const result = schema.safeParse(raw);
      if (!result.success) {
        log.warn(`Invalid stored value for ${key}, using the default`, result.error.issues[0]);
        return defaultValue;
      }
      return result.data;
    };
    const read = async (): Promise<T> => parse((await area.get(key))[key]);
    const mutex = this.mutexes.get(key) ?? new Mutex();
    this.mutexes.set(key, mutex);
    const assertWritable = () => {
      if (!canWrite) {
        throw new Error(`State ${key} is read-only in this context`);
      }
    };

    return {
      get: read,
      update(change) {
        assertWritable();
        return mutex.run(async () => {
          const next = schema.parse(await change(await read()));
          await area.set({ [key]: next });
          return next;
        });
      },
      remove() {
        assertWritable();
        return mutex.run(() => area.remove(key));
      },
      subscribe(listener) {
        return area.onChanged((changes) => {
          const change = changes[key];
          if (change !== undefined) {
            listener(parse(change.newValue));
          }
        });
      },
    };
  }
}
