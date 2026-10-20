import {
  priceBasisSchema,
  priceBasisSourceSchema,
  unitSchema,
} from "@artinova-software/extension-suppliers/registry";
import { z } from "zod";

export const CART_MAX_ITEMS = 100;
export const CART_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Image pipeline state. The full JPEG lives apart, under `global_image_<id>`. */
export const cartImageSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("none") }),
  z.object({ status: z.literal("pending"), attempts: z.number().int().nonnegative() }),
  z.object({
    status: z.literal("ready"),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    bytes: z.number().int().positive(),
    /** 128 px JPEG for the popup list. */
    thumbnailDataUrl: z.string().startsWith("data:image/jpeg;base64,").max(60_000),
  }),
  z.object({ status: z.literal("failed"), reason: z.string().max(100) }),
]);
export type CartImage = z.infer<typeof cartImageSchema>;

const isoDate = z.iso.datetime({ offset: true });
const https = z.url({ protocol: /^https$/ }).max(2048);

export const cartItemSchema = z.object({
  id: z.uuid(),
  dedupeKey: z.string().min(1).max(2200),
  supplierId: z.string().min(1).max(64),
  supplierName: z.string().min(1).max(40),
  designation: z.string().min(1).max(500),
  supplierCode: z.string().max(100).nullable(),
  manufacturerCode: z.string().max(100).nullable(),
  gtin: z.string().nullable(),
  brand: z.string().max(200).nullable(),
  unit: unitSchema.nullable(),
  packagingQuantity: z.number().int().positive().nullable(),
  productUrl: https,
  sourceImageUrl: https.nullable(),
  priceCents: z.number().int().nonnegative().nullable(),
  currency: z.literal("EUR"),
  priceBasis: priceBasisSchema,
  priceBasisSource: priceBasisSourceSchema,
  ecoContributionCents: z.number().int().nonnegative().nullable(),
  adapterVersion: z.number().int().nonnegative().nullable(),
  image: cartImageSchema,
  observedAt: isoDate,
  expiresAt: isoDate,
});
export type CartItem = z.infer<typeof cartItemSchema>;

export const cartStateSchema = z.object({
  schemaVersion: z.literal(1),
  /** Bumped on every change; the bridge uses it for optimistic clears. */
  revision: z.number().int().nonnegative(),
  items: z.array(cartItemSchema).max(CART_MAX_ITEMS),
});
export type CartState = z.infer<typeof cartStateSchema>;

export const EMPTY_CART: CartState = { schemaVersion: 1, revision: 0, items: [] };
