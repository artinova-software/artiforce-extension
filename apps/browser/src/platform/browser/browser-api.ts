/**
 * The only place that touches `chrome.*` (Firefox exposes the same promise-based
 * `chrome` namespace in MV3). Business code calls these static methods so it
 * can run against the fake in tests and stays portable.
 */

export type StorageAreaName = "local" | "session";

export type StorageChange = { oldValue?: unknown; newValue?: unknown };

export type StorageArea = {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  /** Stored keys, without loading the values when the browser allows it. */
  keys(): Promise<string[]>;
  onChanged(listener: (changes: Record<string, StorageChange>) => void): () => void;
};

export type RuntimeSender = chrome.runtime.MessageSender;

export type RawMessageListener = (
  message: unknown,
  sender: RuntimeSender,
  sendResponse: (response: unknown) => void,
) => boolean | undefined;

/** Brand blue, also the popup's primary color. */
export const BADGE_COLOR = "#2457D6";

export class BrowserApi {
  /**
   * False once the extension was reloaded or updated under a content script:
   * the orphaned script must stop and remove its UI.
   */
  static contextValid(): boolean {
    try {
      return typeof chrome !== "undefined" && chrome.runtime?.id !== undefined;
    } catch {
      return false;
    }
  }

  static getExtensionId(): string {
    return chrome.runtime.id;
  }

  static getUrl(path: string): string {
    return chrome.runtime.getURL(path);
  }

  static getVersion(): string {
    return chrome.runtime.getManifest().version;
  }

  static async sendMessage(message: unknown): Promise<unknown> {
    return chrome.runtime.sendMessage(message);
  }

  /** Register synchronously, at the top level of the service worker (MV3). */
  static addMessageListener(listener: RawMessageListener): () => void {
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }

  static addInstalledListener(listener: () => void): void {
    chrome.runtime.onInstalled.addListener(() => listener());
  }

  static addStartupListener(listener: () => void): void {
    chrome.runtime.onStartup.addListener(listener);
  }

  static storageArea(name: StorageAreaName): StorageArea {
    const area = name === "local" ? chrome.storage.local : chrome.storage.session;
    return {
      get: (keys) => area.get(keys),
      set: (items) => area.set(items),
      remove: (keys) => area.remove(keys),
      async keys() {
        const withKeys = area as typeof area & { getKeys?: () => Promise<string[]> };
        return typeof withKeys.getKeys === "function"
          ? withKeys.getKeys()
          : Object.keys(await area.get(null));
      },
      onChanged(listener) {
        const handler = (changes: Record<string, StorageChange>, areaName: string) => {
          if (areaName === name) {
            listener(changes);
          }
        };
        chrome.storage.onChanged.addListener(handler);
        return () => chrome.storage.onChanged.removeListener(handler);
      },
    };
  }

  static readonly alarms = {
    async ensure(name: string, periodInMinutes: number): Promise<void> {
      const existing = await chrome.alarms.get(name);
      if (existing?.periodInMinutes !== periodInMinutes) {
        await chrome.alarms.create(name, { periodInMinutes, delayInMinutes: periodInMinutes });
      }
    },
    addListener(listener: (name: string) => void): void {
      chrome.alarms.onAlarm.addListener((alarm) => listener(alarm.name));
    },
  };

  static async setBadge(count: number): Promise<void> {
    const text = count === 0 ? "" : count > 99 ? "99+" : String(count);
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
    await chrome.action.setBadgeText({ text });
  }

  static async createTab(url: string): Promise<void> {
    await chrome.tabs.create({ url });
  }

  /** `chrome.i18n.getMessage`, with substitutions. Empty string for an unknown key. */
  static getMessage(key: string, substitutions?: string[]): string {
    return chrome.i18n.getMessage(key, substitutions);
  }
}
