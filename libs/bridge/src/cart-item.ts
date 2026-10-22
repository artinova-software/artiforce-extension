import { z } from "zod";

/**
 * A selection item as the web app receives it. Field names follow Artiforce's
 * CatalogItem; money is integer cents. The web app treats every field as
 * untrusted input (ADR-006) and asks the user to confirm HT/TTC.
 */
export const bridgeCartItemSchema = z.object({
  id: z.uuid(),
  /** Echo it in removeItems: an item re-observed since is not removed. */
  observedAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }),
  supplier: z.object({ id: z.string().max(64), name: z.string().max(40) }),
  designation: z.string().min(1).max(500),
  supplierCode: z.string().max(100).nullable(),
  manufacturerCode: z.string().max(100).nullable(),
  gtin: z.string().max(14).nullable(),
  brand: z.string().max(200).nullable(),
  unit: z.string().max(20).nullable(),
  packagingQuantity: z.number().int().positive().nullable(),
  productUrl: z.url({ protocol: /^https$/ }).max(2048),
  price: z.object({
    /** The price as displayed on the supplier page, null when none was found. */
    cents: z.number().int().nonnegative().nullable(),
    currency: z.literal("EUR"),
    basis: z.enum(["HT", "TTC", "UNKNOWN"]),
    basisSource: z.enum(["adapter", "page-text", "structured-data", "registry-default", "none"]),
  }),
  ecoContributionCents: z.number().int().nonnegative().nullable(),
  image: z.object({
    status: z.enum(["none", "pending", "ready", "failed"]),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
  }),
});
export type BridgeCartItem = z.infer<typeof bridgeCartItemSchema>;
