import { z } from "zod";

import { priceBasisSchema } from "../model/price-basis";

/** A bare hostname: lowercase, no scheme, no port, no wildcard. */
const hostSchema = z
  .string()
  .regex(/^(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/, "Expected a bare lowercase hostname");

export const SupplierSegment = {
  /** Retail sites show prices with VAT. */
  RETAIL: "retail",
  /** Trade counters show prices without VAT. */
  PRO: "pro",
} as const;
export type SupplierSegment = (typeof SupplierSegment)[keyof typeof SupplierSegment];

export const SupplierSupport = {
  /** A dedicated adapter and a fixture back the extraction. */
  VERIFIED: "verified",
  /** Structured data only (JSON-LD, microdata, meta), checked by hand on one page. */
  GENERIC: "generic",
  /** Not injected, but its hosts stay in host_permissions so the list never grows (ADR-005). */
  DISABLED: "disabled",
} as const;
export type SupplierSupport = (typeof SupplierSupport)[keyof typeof SupplierSupport];

export const supplierSiteSchema = z.strictObject({
  host: hostSchema,
  /** Restricts injection to a path prefix, e.g. `/fr` on a multi-country host. */
  pathPrefix: z
    .string()
    .regex(/^\/[A-Za-z0-9\-_/]*$/)
    .optional(),
});

export const supplierRecordSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a kebab-case id"),
  name: z.string().min(1).max(40),
  country: z.enum(["FR", "BE", "CH", "LU", "EU"]),
  segment: z.enum([SupplierSegment.RETAIL, SupplierSegment.PRO]),
  sites: z.array(supplierSiteSchema).min(1),
  /** Hosts the service worker may download product images from. */
  imageHosts: z.array(hostSchema),
  defaultPriceBasis: priceBasisSchema,
  support: z.enum([SupplierSupport.VERIFIED, SupplierSupport.GENERIC, SupplierSupport.DISABLED]),
  /** A regular expression (source) a product page path must match. */
  productPath: z.string().min(1).optional(),
  /** Only built into the e2e target. */
  testOnly: z.boolean().optional(),
  /** Last manual check on a product page (YYYY-MM-DD). */
  checkedAt: z.iso.date().optional(),
  /** What that check found (structured data, login wall, bot protection…). */
  notes: z.string().max(240).optional(),
});
export type SupplierRecord = z.infer<typeof supplierRecordSchema>;
export type SupplierSite = z.infer<typeof supplierSiteSchema>;

export const supplierRegistrySchema = z.array(supplierRecordSchema);
