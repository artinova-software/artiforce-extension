import { readFileSync } from "node:fs";
import { join } from "node:path";

// In-memory `chrome` for unit tests: storage (with onChanged), runtime
// messaging, alarms, action badge, i18n (reads the real messages.json) and tabs.

type Listener<A extends unknown[]> = (...args: A) => unknown;

class FakeEvent<A extends unknown[]> {
  readonly listeners = new Set<Listener<A>>();
  addListener(listener: Listener<A>): void {
    this.listeners.add(listener);
  }
  removeListener(listener: Listener<A>): void {
    this.listeners.delete(listener);
  }
  hasListener(listener: Listener<A>): boolean {
    return this.listeners.has(listener);
  }
  emit(...args: A): unknown[] {
    return [...this.listeners].map((listener) => listener(...args));
  }
}

type FakeAlarm = { name: string; scheduledTime: number; periodInMinutes?: number };

type Changes = Record<string, { oldValue?: unknown; newValue?: unknown }>;

function clone<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}

class FakeStorageArea {
  readonly data = new Map<string, unknown>();
  constructor(
    private readonly name: string,
    private readonly onChanged: FakeEvent<[Changes, string]>,
  ) {}

  async get(keys: string | string[] | null): Promise<Record<string, unknown>> {
    const list = keys === null ? [...this.data.keys()] : Array.isArray(keys) ? keys : [keys];
    const result: Record<string, unknown> = {};
    for (const key of list) {
      if (this.data.has(key)) {
        result[key] = clone(this.data.get(key));
      }
    }
    return result;
  }

  async set(items: Record<string, unknown>): Promise<void> {
    const changes: Changes = {};
    for (const [key, value] of Object.entries(items)) {
      changes[key] = { oldValue: clone(this.data.get(key)), newValue: clone(value) };
      this.data.set(key, clone(value));
    }
    this.onChanged.emit(changes, this.name);
  }

  async remove(keys: string | string[]): Promise<void> {
    const changes: Changes = {};
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      if (this.data.has(key)) {
        changes[key] = { oldValue: clone(this.data.get(key)) };
        this.data.delete(key);
      }
    }
    if (Object.keys(changes).length > 0) {
      this.onChanged.emit(changes, this.name);
    }
  }

  async getKeys(): Promise<string[]> {
    return [...this.data.keys()];
  }

  async clear(): Promise<void> {
    await this.remove([...this.data.keys()]);
  }
}

type Messages = Record<
  string,
  { message: string; placeholders?: Record<string, { content: string }> }
>;

const MESSAGES = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "src", "_locales", "fr", "messages.json"), "utf8"),
) as Messages;

/** chrome.i18n.getMessage semantics: named placeholders map to $1…$9. */
export function formatMessage(key: string, substitutions: string[] = []): string {
  const entry = MESSAGES[key];
  if (entry === undefined) {
    return "";
  }
  return entry.message.replace(/\$([A-Za-z0-9_@]+)\$/g, (match, name: string) => {
    const content = entry.placeholders?.[name.toLowerCase()]?.content;
    if (content === undefined) {
      return match;
    }
    return content.replace(
      /\$(\d)/g,
      (_m, index: string) => substitutions[Number(index) - 1] ?? "",
    );
  });
}

export type FakeSender = chrome.runtime.MessageSender;

export function createChromeFake(options: { id?: string } = {}) {
  const id = options.id ?? "abcdefghijklmnopabcdefghijklmnop";
  const storageChanged = new FakeEvent<[Changes, string]>();
  const onMessage = new FakeEvent<[unknown, FakeSender, (response: unknown) => void]>();
  const onAlarm = new FakeEvent<[FakeAlarm]>();
  const alarms = new Map<string, FakeAlarm>();
  const badge = { text: "", color: "" };
  const createdTabs: string[] = [];
  let runtimeValid = true;
  /** Sender used by runtime.sendMessage (popup by default). */
  let currentSender: FakeSender = { id, url: `chrome-extension://${id}/popup/index.html` };

  const fake = {
    runtime: {
      get id() {
        return runtimeValid ? id : undefined;
      },
      getURL: (path: string) => `chrome-extension://${id}/${path.replace(/^\//, "")}`,
      getManifest: () => ({ version: "0.1.0", manifest_version: 3 }),
      onMessage,
      onInstalled: new FakeEvent<[unknown]>(),
      onStartup: new FakeEvent<[]>(),
      async sendMessage(message: unknown): Promise<unknown> {
        if (!runtimeValid) {
          throw new Error("Extension context invalidated.");
        }
        return new Promise((resolve) => {
          let answered = false;
          const results = onMessage.emit(structuredClone(message), currentSender, (response) => {
            answered = true;
            resolve(structuredClone(response));
          });
          if (!answered && !results.includes(true)) {
            resolve(undefined);
          }
        });
      },
    },
    storage: {
      local: new FakeStorageArea("local", storageChanged),
      session: new FakeStorageArea("session", storageChanged),
      onChanged: storageChanged,
    },
    alarms: {
      async create(name: string, info: { periodInMinutes?: number; delayInMinutes?: number }) {
        alarms.set(name, {
          name,
          scheduledTime: Date.now() + (info.delayInMinutes ?? 0) * 60_000,
          ...(info.periodInMinutes === undefined ? {} : { periodInMinutes: info.periodInMinutes }),
        });
      },
      async get(name: string) {
        return alarms.get(name);
      },
      async clear(name: string) {
        return alarms.delete(name);
      },
      onAlarm,
    },
    action: {
      async setBadgeText(details: { text: string }) {
        badge.text = details.text;
      },
      async setBadgeBackgroundColor(details: { color: string }) {
        badge.color = details.color;
      },
    },
    i18n: {
      getMessage: (key: string, substitutions?: string | string[]) =>
        formatMessage(key, typeof substitutions === "string" ? [substitutions] : substitutions),
    },
    tabs: {
      async create(details: { url: string }) {
        createdTabs.push(details.url);
        return { id: createdTabs.length };
      },
    },
  };

  const controls = {
    id,
    badge,
    alarms,
    createdTabs,
    setSender(sender: Partial<FakeSender>) {
      currentSender = { id, ...sender };
    },
    invalidate() {
      runtimeValid = false;
    },
    fireAlarm(name: string) {
      const alarm = alarms.get(name) ?? { name, scheduledTime: Date.now() };
      onAlarm.emit(alarm);
    },
  };

  return { chrome: fake, controls };
}

export type ChromeFake = ReturnType<typeof createChromeFake>;
