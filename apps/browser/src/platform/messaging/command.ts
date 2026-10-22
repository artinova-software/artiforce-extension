import { z } from "zod";

/** Who may send a message, as classified from the browser-provided sender. */
export const SenderKind = {
  /** The popup or another page of this extension. */
  EXTENSION_PAGE: "extension-page",
  /** The button content script, top frame of a registered supplier page. */
  SUPPLIER_CONTENT: "supplier-content",
  /** The bridge content script, top frame of an Artiforce origin. */
  BRIDGE_CONTENT: "bridge-content",
  UNKNOWN: "unknown",
} as const;
export type SenderKind = (typeof SenderKind)[keyof typeof SenderKind];

export type CommandDefinition<Name extends string, Request, Response> = {
  name: Name;
  request: z.ZodType<Request>;
  response: z.ZodType<Response>;
  /** Sender kinds allowed to call it. Message content never grants access. */
  senders: readonly SenderKind[];
};

export type AnyCommand = CommandDefinition<string, unknown, unknown>;
export type RequestOf<C> = C extends CommandDefinition<string, infer R, unknown> ? R : never;
export type ResponseOf<C> = C extends CommandDefinition<string, unknown, infer R> ? R : never;

export function defineCommand<Name extends string, Request, Response>(
  definition: CommandDefinition<Name, Request, Response>,
): CommandDefinition<Name, Request, Response> {
  return definition;
}

/** Errors a handler or the router can return. Domain codes (CART_FULL…) are added freely. */
export const MessagingErrorCode = {
  INVALID_REQUEST: "INVALID_REQUEST",
  UNKNOWN_COMMAND: "UNKNOWN_COMMAND",
  FORBIDDEN: "FORBIDDEN",
  INTERNAL: "INTERNAL",
  EXTENSION_RELOADED: "EXTENSION_RELOADED",
} as const;

export const CHANNEL = "artiforce-extension";

export const requestEnvelopeSchema = z.strictObject({
  channel: z.literal(CHANNEL),
  command: z.string().min(1).max(64),
  payload: z.unknown(),
});
export type RequestEnvelope = z.infer<typeof requestEnvelopeSchema>;

export const errorSchema = z.object({
  code: z.string().min(1).max(64),
  message: z.string().max(500),
});

export const responseEnvelopeSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), result: z.unknown() }),
  z.object({ ok: z.literal(false), error: errorSchema }),
]);
export type ResponseEnvelope = z.infer<typeof responseEnvelopeSchema>;

/** Thrown by handlers (and rethrown by `sendCommand`) with a stable code. */
export class CommandError extends Error {
  constructor(
    readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = "CommandError";
  }
}
