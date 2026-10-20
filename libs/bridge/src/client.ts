import {
  BRIDGE_COMMANDS,
  BRIDGE_EVENTS,
  type BridgeCommandName,
  type BridgeEventData,
  type BridgeEventName,
  type BridgeParams,
  type BridgeResult,
} from "./commands";
import { BRIDGE_TIMEOUT, BridgeError, type BridgeErrorCode } from "./errors";
import {
  BRIDGE_CHANNEL,
  BRIDGE_PROTOCOL,
  bridgeEventSchema,
  bridgeResponseSchema,
} from "./protocol";

export type BridgeClientOptions = {
  /** Per request; also how long `hello` waits before concluding there is no extension. */
  timeoutMs?: number;
};

type Pending = {
  resolve(value: unknown): void;
  reject(error: BridgeError): void;
  timer: ReturnType<typeof setTimeout>;
};

/**
 * Web app side of the bridge. Talks to the extension's content script through
 * `window.postMessage` on this page's own origin, never `"*"`. Every answer
 * and event is validated: the web app treats them as untrusted input.
 */
export class BridgeClient {
  private readonly pending = new Map<string, Pending>();
  private readonly listeners = new Map<BridgeEventName, Set<(data: never) => void>>();
  private counter = 0;
  private readonly timeoutMs: number;

  constructor(
    private readonly window: Window,
    options: BridgeClientOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? 2000;
    this.window.addEventListener("message", this.onMessage);
  }

  dispose(): void {
    this.window.removeEventListener("message", this.onMessage);
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new BridgeError(BRIDGE_TIMEOUT, "Client disposed"));
    }
    this.pending.clear();
  }

  request<C extends BridgeCommandName>(
    command: C,
    params: BridgeParams<C>,
  ): Promise<BridgeResult<C>> {
    const id = `${Date.now().toString(36)}-${(this.counter += 1).toString(36)}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new BridgeError(BRIDGE_TIMEOUT, `No answer to ${command}`));
      }, this.timeoutMs);
      this.pending.set(id, {
        timer,
        reject,
        resolve: (value) => {
          const result = BRIDGE_COMMANDS[command].result.safeParse(value);
          if (result.success) {
            resolve(result.data as BridgeResult<C>);
          } else {
            reject(new BridgeError("INTERNAL", `Invalid ${command} result`));
          }
        },
      });
      this.window.postMessage(
        {
          channel: BRIDGE_CHANNEL,
          direction: "request",
          protocol: BRIDGE_PROTOCOL,
          id,
          command,
          params,
        },
        this.window.location.origin,
      );
    });
  }

  /** True when an extension answers `hello` with a protocol this client speaks. */
  async detect(): Promise<BridgeResult<"hello"> | null> {
    try {
      const hello = await this.request("hello", {});
      return hello.protocols.includes(BRIDGE_PROTOCOL) ? hello : null;
    } catch {
      return null;
    }
  }

  on<E extends BridgeEventName>(
    event: E,
    listener: (data: BridgeEventData<E>) => void,
  ): () => void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener as (data: never) => void);
    this.listeners.set(event, set);
    return () => set.delete(listener as (data: never) => void);
  }

  private readonly onMessage = (event: MessageEvent): void => {
    if (event.source !== this.window || event.origin !== this.window.location.origin) {
      return;
    }
    const data: unknown = event.data;
    if (
      typeof data !== "object" ||
      data === null ||
      (data as { channel?: unknown }).channel !== BRIDGE_CHANNEL
    ) {
      return;
    }
    const response = bridgeResponseSchema.safeParse(data);
    if (response.success) {
      const pending = this.pending.get(response.data.id);
      if (pending === undefined) {
        return;
      }
      this.pending.delete(response.data.id);
      clearTimeout(pending.timer);
      if (response.data.ok) {
        pending.resolve(response.data.result);
      } else {
        pending.reject(
          new BridgeError(response.data.error.code as BridgeErrorCode, response.data.error.message),
        );
      }
      return;
    }
    const message = bridgeEventSchema.safeParse(data);
    if (message.success && message.data.event in BRIDGE_EVENTS) {
      const name = message.data.event as BridgeEventName;
      const parsed = BRIDGE_EVENTS[name].safeParse(message.data.data);
      if (parsed.success) {
        this.listeners.get(name)?.forEach((listener) => listener(parsed.data as never));
      }
    }
  };
}
