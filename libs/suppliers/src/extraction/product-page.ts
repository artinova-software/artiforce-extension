import type { SupplierRecord } from "../registry/supplier-record.schema";

/** The page being read: a document, its URL and the supplier it belongs to. */
export type ProductPage = {
  document: Document;
  url: URL;
  supplier: SupplierRecord;
};

export function createProductPage(document: Document, supplier: SupplierRecord): ProductPage {
  return { document, url: new URL(document.location?.href ?? document.URL), supplier };
}

/** Structured data that marks a product page, whatever the supplier. */
export function hasProductStructuredData(document: Document): boolean {
  if (document.querySelector('[itemtype*="schema.org/Product" i]') !== null) {
    return true;
  }
  const ogType = document.querySelector('meta[property="og:type"]')?.getAttribute("content");
  if (ogType !== null && ogType !== undefined && /product/i.test(ogType)) {
    return true;
  }
  return [...document.querySelectorAll('script[type="application/ld+json"]')].some((script) =>
    /"@type"\s*:\s*(?:\[[^\]]*)?"(?:https?:\/\/schema\.org\/)?(?:Product|ProductGroup)"/.test(
      script.textContent ?? "",
    ),
  );
}

/**
 * Generic product-page test: the path matches the supplier's `productPath` when
 * one is declared, and the page carries product structured data.
 */
export function isGenericProductPage(page: ProductPage): boolean {
  const { productPath } = page.supplier;
  if (productPath !== undefined && !new RegExp(productPath).test(page.url.pathname)) {
    return false;
  }
  return hasProductStructuredData(page.document);
}
