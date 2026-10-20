import { z } from "zod";

/** Whether an observed price includes VAT. `UNKNOWN` when nothing on the page says so. */
export const PriceBasis = {
  HT: "HT",
  TTC: "TTC",
  UNKNOWN: "UNKNOWN",
} as const;
export type PriceBasis = (typeof PriceBasis)[keyof typeof PriceBasis];
export const priceBasisSchema = z.enum([PriceBasis.HT, PriceBasis.TTC, PriceBasis.UNKNOWN]);

/** Where the basis came from, highest priority first. */
export const PriceBasisSource = {
  ADAPTER: "adapter",
  PAGE_TEXT: "page-text",
  STRUCTURED_DATA: "structured-data",
  REGISTRY_DEFAULT: "registry-default",
  NONE: "none",
} as const;
export type PriceBasisSource = (typeof PriceBasisSource)[keyof typeof PriceBasisSource];
export const priceBasisSourceSchema = z.enum([
  PriceBasisSource.ADAPTER,
  PriceBasisSource.PAGE_TEXT,
  PriceBasisSource.STRUCTURED_DATA,
  PriceBasisSource.REGISTRY_DEFAULT,
  PriceBasisSource.NONE,
]);

export type PriceBasisDetection = {
  basis: PriceBasis;
  source: PriceBasisSource;
};
