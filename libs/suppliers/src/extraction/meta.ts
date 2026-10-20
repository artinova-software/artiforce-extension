import { parseDecimal } from "../parsing/price";
import { cleanText } from "../parsing/text";
import { canonicalProductUrl, toHttpsUrl } from "../parsing/url";
import type { StructuredResult } from "./json-ld";

function meta(document: Document, key: string): string | null {
  const element = document.querySelector(`meta[property="${key}"], meta[name="${key}"]`);
  return element?.getAttribute("content") ?? null;
}

/** Strips the « | Site name » suffix sites append to og:title. */
function stripSiteSuffix(title: string | null, siteName: string | null): string | null {
  if (title === null) {
    return null;
  }
  const parts = title.split(/\s+[|–-]\s+/);
  if (parts.length > 1) {
    const last = parts[parts.length - 1]?.toLowerCase() ?? "";
    if (siteName === null || siteName.toLowerCase().includes(last) || last.length < 30) {
      return parts.slice(0, -1).join(" - ");
    }
  }
  return title;
}

/** Open Graph and `product:*` tags plus the canonical link. Always returns something. */
export function extractFromMeta(document: Document, pageUrl: string): StructuredResult {
  const siteName = meta(document, "og:site_name");
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
  return {
    designation:
      cleanText(stripSiteSuffix(meta(document, "og:title"), siteName)) ??
      cleanText(document.querySelector("h1")?.textContent) ??
      undefined,
    imageUrl: toHttpsUrl(
      meta(document, "og:image:secure_url") ?? meta(document, "og:image"),
      pageUrl,
    ),
    productUrl:
      canonicalProductUrl(canonical ?? meta(document, "og:url") ?? pageUrl, pageUrl) ?? undefined,
    priceCents: parseDecimal(
      meta(document, "product:price:amount") ?? meta(document, "og:price:amount"),
    ),
    currency: cleanText(
      meta(document, "product:price:currency") ?? meta(document, "og:price:currency"),
    ),
    brand: cleanText(meta(document, "product:brand"), 200),
    supplierCode: cleanText(meta(document, "product:retailer_item_id"), 100),
    gtin: null,
  };
}
