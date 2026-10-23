import { z } from "zod";

import { bridgeCartItemSchema } from "./cart-item";

export const BRIDGE_COMMANDS = {
  hello: {
    params: z.strictObject({}),
    result: z.object({
      extensionVersion: z.string().max(32),
      browser: z.enum(["chrome", "edge", "firefox", "safari"]),
      protocols: z.array(z.number().int().positive()).min(1),
      capabilities: z.array(z.string().max(32)),
    }),
  },
  getCart: {
    params: z.strictObject({}),
    result: z.object({
      revision: z.number().int().nonnegative(),
      items: z.array(bridgeCartItemSchema).max(100),
    }),
  },
  getImages: {
    params: z.strictObject({ itemIds: z.array(z.uuid()).min(1).max(10) }),
    result: z.object({
      images: z.array(
        z.object({
          itemId: z.uuid(),
          /** JPEG, ≤ 1024 px; null when the item has no stored image. */
          dataUrl: z.string().startsWith("data:image/jpeg;base64,").max(4_000_000).nullable(),
          width: z.number().int().positive().nullable(),
          height: z.number().int().positive().nullable(),
        }),
      ),
    }),
  },
  removeItems: {
    params: z.strictObject({
      items: z
        .array(z.strictObject({ id: z.uuid(), observedAt: z.iso.datetime({ offset: true }) }))
        .min(1)
        .max(100),
    }),
    result: z.object({
      removed: z.array(z.uuid()),
      /** Re-observed since `observedAt`, or already gone: left untouched. */
      kept: z.array(z.uuid()),
      revision: z.number().int().nonnegative(),
    }),
  },
  clearCart: {
    params: z.strictObject({ expectedRevision: z.number().int().nonnegative() }),
    result: z.object({ revision: z.number().int().nonnegative() }),
  },
} as const;

export type BridgeCommandName = keyof typeof BRIDGE_COMMANDS;
export const BRIDGE_COMMAND_NAMES = Object.keys(BRIDGE_COMMANDS) as BridgeCommandName[];
export type BridgeParams<C extends BridgeCommandName> = z.infer<
  (typeof BRIDGE_COMMANDS)[C]["params"]
>;
export type BridgeResult<C extends BridgeCommandName> = z.infer<
  (typeof BRIDGE_COMMANDS)[C]["result"]
>;

export const BRIDGE_EVENTS = {
  /** Posted once the bridge listens (the page may load before or after it). */
  ready: z.object({
    extensionVersion: z.string().max(32),
    protocols: z.array(z.number().int().positive()),
  }),
  /** Counts only, no content: enough to show or hide « Importer la sélection ». */
  "cart.changed": z.object({
    revision: z.number().int().nonnegative(),
    count: z.number().int().nonnegative(),
  }),
} as const;

export type BridgeEventName = keyof typeof BRIDGE_EVENTS;
export type BridgeEventData<E extends BridgeEventName> = z.infer<(typeof BRIDGE_EVENTS)[E]>;
