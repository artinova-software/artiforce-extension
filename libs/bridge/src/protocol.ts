import { z } from "zod";

import { BRIDGE_COMMAND_NAMES } from "./commands";
import { BridgeErrorCode } from "./errors";

export const BRIDGE_CHANNEL = "artiforce-bridge";
/** The protocol this copy speaks. Optional additions stay in v1; breaking changes are v2. */
export const BRIDGE_PROTOCOL = 1;
/** Versions the extension answers (both during a transition release). */
export const SUPPORTED_PROTOCOLS: readonly number[] = [1];
/** Requests per second the bridge accepts from a page. */
export const BRIDGE_RATE_LIMIT_PER_SECOND = 20;

const base = {
  channel: z.literal(BRIDGE_CHANNEL),
  protocol: z.number().int().positive(),
};

const requestId = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

/** Only the shape: the command's own params schema is checked afterwards. */
export const bridgeRequestSchema = z.strictObject({
  ...base,
  direction: z.literal("request"),
  id: requestId,
  command: z.enum(BRIDGE_COMMAND_NAMES as [string, ...string[]]),
  params: z.record(z.string(), z.unknown()).default({}),
});
export type BridgeRequest = z.infer<typeof bridgeRequestSchema>;

export const bridgeErrorSchema = z.object({
  code: z.enum(Object.values(BridgeErrorCode) as [string, ...string[]]),
  message: z.string().max(500),
});

export const bridgeResponseSchema = z.discriminatedUnion("ok", [
  z.strictObject({
    ...base,
    direction: z.literal("response"),
    id: requestId,
    ok: z.literal(true),
    result: z.unknown(),
  }),
  z.strictObject({
    ...base,
    direction: z.literal("response"),
    id: requestId,
    ok: z.literal(false),
    error: bridgeErrorSchema,
  }),
]);
export type BridgeResponse = z.infer<typeof bridgeResponseSchema>;

export const bridgeEventSchema = z.strictObject({
  ...base,
  direction: z.literal("event"),
  event: z.string().max(64),
  data: z.unknown(),
});
export type BridgeEventMessage = z.infer<typeof bridgeEventSchema>;
