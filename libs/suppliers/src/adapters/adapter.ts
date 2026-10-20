import type { Anchor } from "../extraction/anchor";
import type { ProductPage } from "../extraction/product-page";
import type { PartialProduct } from "../model/captured-product";
import type { PriceBasisDetection } from "../model/price-basis";

/**
 * Supplier-specific knowledge, as pure functions over the page. Every member is
 * optional: the generic chain (JSON-LD, microdata, meta) does the rest.
 */
export type SupplierAdapter = {
  supplierId: string;
  /** Bumped when the adapter's output changes; stored with each captured item. */
  version: number;
  isProductPage?(page: ProductPage): boolean;
  findAnchor?(page: ProductPage): Anchor | null;
  /** Has the last word: defined fields override the generic result. */
  refine?(page: ProductPage, generic: PartialProduct): PartialProduct;
  detectPriceBasis?(page: ProductPage): PriceBasisDetection | null;
};

/** Text of the first element matching `selector`, single-spaced, or null. */
export function textOf(root: ParentNode, selector: string): string | null {
  const text = root.querySelector(selector)?.textContent?.replace(/\s+/g, " ").trim();
  return text === undefined || text.length === 0 ? null : text;
}
