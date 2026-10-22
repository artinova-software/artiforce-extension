import {
  BRIDGE_CHANNEL,
  BRIDGE_COMMANDS,
  BRIDGE_RATE_LIMIT_PER_SECOND,
  BridgeErrorCode,
  type BridgeCommandName,
  bridgeRequestSchema,
  SUPPORTED_PROTOCOLS,
} from "@artiforce-software/extension-bridge/wire";

export type GuardedRequest = {
  id: string;
  protocol: number;
  command: BridgeCommandName;
  /** Rebuilt from the command's schema: nothing else reaches the extension. */
  params: Record<string, unknown>;
};

export type GuardVerdict =
  | { kind: "ignore" }
  | { kind: "reject"; id: string; protocol: number; code: BridgeErrorCode }
  | { kind: "accept"; request: GuardedRequest };

export type MessageGuardOptions = {
  window: Window;
  allowedOrigins: readonly string[];
  now?: () => number;
};

/**
 * Every check a page message passes before the bridge relays it: main frame,
 * trusted event from this very window, same origin and an allowed one, the
 * bridge channel, a request, a strict schema, a known command, the rate limit.
 * Silent (`ignore`) when the sender cannot be answered safely.
 */
export function createMessageGuard(options: MessageGuardOptions) {
  const { window } = options;
  const now = options.now ?? Date.now;
  let windowStart = 0;
  let count = 0;

  const isTopFrame = (() => {
    try {
      return window.top === window;
    } catch {
      return false;
    }
  })();
  const originAllowed = options.allowedOrigins.includes(window.location.origin);

  return {
    /** Whether the bridge should run in this document at all. */
    active: isTopFrame && originAllowed,

    check(event: MessageEvent): GuardVerdict {
      if (!isTopFrame || !originAllowed) {
        return { kind: "ignore" };
      }
      if (!event.isTrusted || event.source !== window || event.origin !== window.location.origin) {
        return { kind: "ignore" };
      }
      const data: unknown = event.data;
      if (
        typeof data !== "object" ||
        data === null ||
        (data as { channel?: unknown }).channel !== BRIDGE_CHANNEL ||
        (data as { direction?: unknown }).direction !== "request"
      ) {
        return { kind: "ignore" };
      }
      const envelope = bridgeRequestSchema.safeParse(data);
      const raw = data as { id?: unknown; protocol?: unknown };
      const id = typeof raw.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(raw.id) ? raw.id : null;
      const protocol = typeof raw.protocol === "number" ? raw.protocol : 1;
      if (id === null) {
        return { kind: "ignore" };
      }
      const current = now();
      if (current - windowStart >= 1000) {
        windowStart = current;
        count = 0;
      }
      count += 1;
      if (count > BRIDGE_RATE_LIMIT_PER_SECOND) {
        return { kind: "ignore" };
      }
      if (!envelope.success) {
        const unknownCommand = envelope.error.issues.some((issue) => issue.path[0] === "command");
        return {
          kind: "reject",
          id,
          protocol,
          code: unknownCommand ? BridgeErrorCode.UNKNOWN_COMMAND : BridgeErrorCode.INVALID_REQUEST,
        };
      }
      if (!SUPPORTED_PROTOCOLS.includes(envelope.data.protocol)) {
        return { kind: "reject", id, protocol, code: BridgeErrorCode.UNSUPPORTED_PROTOCOL };
      }
      const command = envelope.data.command as BridgeCommandName;
      const params = BRIDGE_COMMANDS[command].params.safeParse(envelope.data.params);
      if (!params.success) {
        return { kind: "reject", id, protocol, code: BridgeErrorCode.INVALID_REQUEST };
      }
      return {
        kind: "accept",
        request: {
          id,
          protocol: envelope.data.protocol,
          command,
          params: params.data as Record<string, unknown>,
        },
      };
    },
  };
}
