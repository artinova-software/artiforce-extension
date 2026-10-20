import { getAdapter } from "../adapters";
import {
  type CapturedProduct,
  capturedProductSchema,
  type PartialProduct,
} from "../model/captured-product";
import { cleanText } from "../parsing/text";
import { canonicalProductUrl } from "../parsing/url";
import { detectPackagingQuantity } from "../parsing/unit";
import { type Anchor, findGenericAnchor } from "./anchor";
import { extractFromJsonLd, type StructuredResult } from "./json-ld";
import { extractFromMeta } from "./meta";
import { extractFromMicrodata } from "./microdata";
import { resolvePriceBasis } from "./price-basis";
import { isGenericProductPage, type ProductPage } from "./product-page";

export type ExtractionResult =
  | { ok: true; product: CapturedProduct; adapterVersion: number | null }
  | { ok: false; reason: "INVALID_PRODUCT"; issues: string[] };

export function isProductPage(page: ProductPage): boolean {
  const adapter = getAdapter(page.supplier.id);
  return adapter?.isProductPage?.(page) ?? isGenericProductPage(page);
}

export function findAnchor(page: ProductPage): Anchor | null {
  const adapter = getAdapter(page.supplier.id);
  if (adapter?.findAnchor !== undefined) {
    return adapter.findAnchor(page) ?? findGenericAnchor(page.document);
  }
  return findGenericAnchor(page.document);
}

/** The first defined, non-null value. */
function pick<T>(...values: (T | null | undefined)[]): T | null {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return null;
}

/** Text around the microdata price, for « HT » / « TTC » labels next to it. */
function genericPriceText(document: Document): string | null {
  const price = document.querySelector('[itemprop="price"]');
  return cleanText(price?.parentElement?.textContent ?? null, 300);
}

/**
 * Reads the product on `page`: JSON-LD, then microdata, then meta tags fill the
 * fields in that order, the adapter's `refine` has the last word, and the result
 * is validated as a CapturedProduct. Runs on click, never on page load.
 */
export function extractProduct(page: ProductPage): ExtractionResult {
  const pageUrl = page.url.href;
  const adapter = getAdapter(page.supplier.id);
  const sources: StructuredResult[] = [
    extractFromJsonLd(page.document, pageUrl),
    extractFromMicrodata(page.document, pageUrl),
    extractFromMeta(page.document, pageUrl),
  ].filter((source): source is StructuredResult => source !== null);
  const meta = sources[sources.length - 1];

  const generic: PartialProduct = {
    designation: pick(...sources.map((source) => source.designation)) ?? undefined,
    productUrl:
      pick(meta?.productUrl, canonicalProductUrl(pageUrl), ...sources.map((s) => s.productUrl)) ??
      undefined,
    supplierCode: pick(...sources.map((source) => source.supplierCode)),
    manufacturerCode: pick(...sources.map((source) => source.manufacturerCode)),
    gtin: pick(...sources.map((source) => source.gtin)),
    brand: pick(...sources.map((source) => source.brand)),
    imageUrl: pick(...sources.map((source) => source.imageUrl)),
    priceCents: pick(...sources.map((source) => source.priceCents)),
    currency: pick(...sources.map((source) => source.currency)),
    unit: null,
    packagingQuantity: null,
    ecoContributionCents: null,
    priceIsLowerBound: sources.some((source) => source.priceIsLowerBound === true),
  };
  const refined = adapter?.refine?.(page, generic) ?? {};
  const merged: PartialProduct = { ...generic };
  for (const [key, value] of Object.entries(refined)) {
    if (value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  const currency = (merged.currency ?? "EUR").toUpperCase();
  const priceCents = currency === "EUR" ? (merged.priceCents ?? null) : null;
  const basis = resolvePriceBasis({
    adapter: adapter?.detectPriceBasis?.(page) ?? null,
    priceText: genericPriceText(page.document),
    structured: pick(...sources.map((source) => source.structuredBasis)),
    supplier: page.supplier,
    lowerBound: merged.priceIsLowerBound === true,
    hasPrice: priceCents !== null,
  });

  const candidate = {
    designation: merged.designation,
    productUrl: merged.productUrl,
    supplierCode: merged.supplierCode ?? null,
    manufacturerCode: merged.manufacturerCode ?? null,
    gtin: merged.gtin ?? null,
    brand: merged.brand ?? null,
    unit: merged.unit ?? null,
    packagingQuantity:
      merged.packagingQuantity ?? detectPackagingQuantity(merged.designation ?? "") ?? null,
    priceCents,
    currency: "EUR" as const,
    priceBasis: basis.basis,
    priceBasisSource: basis.source,
    ecoContributionCents: merged.ecoContributionCents ?? null,
    imageUrl: merged.imageUrl ?? null,
  };
  const parsed = capturedProductSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "INVALID_PRODUCT",
      issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    };
  }
  return { ok: true, product: parsed.data, adapterVersion: adapter?.version ?? null };
}
