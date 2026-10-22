import { capturedProductSchema } from "@artiforce-software/extension-suppliers/registry";
import { z } from "zod";

import { defineCommand, SenderKind } from "../platform/messaging/command";

/** Cart error codes (beyond the messaging ones). */
export const CartErrorCode = {
  CART_FULL: "CART_FULL",
  UNKNOWN_SUPPLIER: "UNKNOWN_SUPPLIER",
  REVISION_MISMATCH: "REVISION_MISMATCH",
} as const;

/**
 * From the supplier button. The supplier is derived from the sender's URL by
 * the background, never taken from the message.
 */
export const cartAdd = defineCommand({
  name: "cart/add",
  request: z.object({
    product: capturedProductSchema,
    adapterVersion: z.number().int().nonnegative().nullable(),
  }),
  response: z.object({
    status: z.enum(["added", "updated"]),
    itemId: z.uuid(),
    count: z.number().int().nonnegative(),
  }),
  senders: [SenderKind.SUPPLIER_CONTENT],
});

export const cartRemove = defineCommand({
  name: "cart/remove",
  request: z.object({ ids: z.array(z.uuid()).min(1).max(100) }),
  response: z.object({ count: z.number().int().nonnegative() }),
  senders: [SenderKind.EXTENSION_PAGE],
});

export const cartClear = defineCommand({
  name: "cart/clear",
  request: z.object({}),
  response: z.object({ count: z.literal(0) }),
  senders: [SenderKind.EXTENSION_PAGE],
});
