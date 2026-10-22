import { z } from "zod";

import { priceBasisSchema, priceBasisSourceSchema } from "./price-basis";

/** Units, spelled the way Artiforce's catalog normalizes them (`catalog-import.ts`). */
export const UNITS = ["u", "m", "ml", "m²", "m³", "kg", "l"] as const;
export const unitSchema = z.enum(UNITS);
export type Unit = z.infer<typeof unitSchema>;

const httpsUrl = z.url({ protocol: /^https$/ }).max(2048);

/**
 * One product read from a supplier page. Field names follow Artiforce's
 * CatalogItem (`designation`, `supplierCode`, `manufacturerCode`,
 * `ecoContributionCents`); money is integer cents.
 */
export const capturedProductSchema = z.object({
  designation: z.string().trim().min(1).max(500),
  productUrl: httpsUrl,
  supplierCode: z.string().trim().min(1).max(100).nullable(),
  manufacturerCode: z.string().trim().min(1).max(100).nullable(),
  gtin: z
    .string()
    .regex(/^\d{8}$|^\d{12,14}$/)
    .nullable(),
  brand: z.string().trim().min(1).max(200).nullable(),
  unit: unitSchema.nullable(),
  packagingQuantity: z.number().int().positive().max(100_000).nullable(),
  priceCents: z.number().int().nonnegative().max(100_000_000).nullable(),
  currency: z.literal("EUR"),
  priceBasis: priceBasisSchema,
  priceBasisSource: priceBasisSourceSchema,
  ecoContributionCents: z.number().int().nonnegative().max(10_000_000).nullable(),
  imageUrl: httpsUrl.nullable(),
});
export type CapturedProduct = z.infer<typeof capturedProductSchema>;

/** What a single extraction step can contribute. Later steps fill the gaps. */
export type PartialProduct = Partial<Omit<CapturedProduct, "currency">> & {
  currency?: string | null;
  /** True when the page price is a « À partir de » lower bound. */
  priceIsLowerBound?: boolean;
};
