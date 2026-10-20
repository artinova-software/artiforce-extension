import type { PriceBasisDetection } from "../model/price-basis";
import { PriceBasis, PriceBasisSource } from "../model/price-basis";
import { detectBasisInText } from "../parsing/price";
import type { SupplierRecord } from "../registry/supplier-record.schema";

export type BasisInputs = {
  adapter: PriceBasisDetection | null;
  /** Text around the displayed price, when an adapter or microdata found it. */
  priceText: string | null;
  structured: PriceBasis | null;
  supplier: SupplierRecord;
  /** « À partir de »: the price is a lower bound, its basis is not trusted. */
  lowerBound: boolean;
  hasPrice: boolean;
};

/**
 * Basis priority: adapter, page text, structured data, registry default. Any
 * doubt (no price, lower bound, conflicting signals) gives UNKNOWN.
 */
export function resolvePriceBasis(inputs: BasisInputs): PriceBasisDetection {
  if (!inputs.hasPrice) {
    return { basis: PriceBasis.UNKNOWN, source: PriceBasisSource.NONE };
  }
  if (inputs.lowerBound) {
    return { basis: PriceBasis.UNKNOWN, source: PriceBasisSource.PAGE_TEXT };
  }
  if (inputs.adapter !== null) {
    return inputs.adapter;
  }
  const fromText = inputs.priceText === null ? null : detectBasisInText(inputs.priceText);
  if (fromText !== null) {
    return { basis: fromText, source: PriceBasisSource.PAGE_TEXT };
  }
  if (inputs.structured !== null) {
    return { basis: inputs.structured, source: PriceBasisSource.STRUCTURED_DATA };
  }
  if (inputs.supplier.defaultPriceBasis !== PriceBasis.UNKNOWN) {
    return { basis: inputs.supplier.defaultPriceBasis, source: PriceBasisSource.REGISTRY_DEFAULT };
  }
  return { basis: PriceBasis.UNKNOWN, source: PriceBasisSource.NONE };
}
