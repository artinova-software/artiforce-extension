import type { ProductPage } from "../extraction/product-page";
import type { PartialProduct } from "../model/captured-product";
import { PriceBasisSource, type PriceBasisDetection } from "../model/price-basis";
import { normalizeGtin } from "../parsing/gtin";
import { detectBasisInText, parsePriceText } from "../parsing/price";
import { normalizeSpaces } from "../parsing/text";
import { detectUnit } from "../parsing/unit";
import type { Anchor } from "../extraction/anchor";
import { textOf } from "./adapter";

// Cedeo and Point.P run the same storefront (Saint-Gobain Distribution
// Bâtiment): `/p/<category>/<slug>-A<id>` pages with data-testid hooks. The
// public price is « TTC »; a logged-in pro sees « HT » negotiated prices.

const PRICE = "[data-testid='article-buy-box/article-price']";
const CTA = "[data-testid='pdp/article-buy-box/shopping-button']";

export function isDsbProductPage(page: ProductPage): boolean {
  return (
    /\/p\/.+-A\d+$/.test(page.url.pathname) &&
    page.document.querySelector("h1[data-testid='article-header/article-name']") !== null
  );
}

export function findDsbAnchor(page: ProductPage): Anchor | null {
  const form = page.document.querySelector(CTA)?.closest("form") ?? null;
  return form === null ? null : { element: form, position: "afterend" };
}

/** « Réf. CEDEO : 4988574 » → « 4988574 ». */
function afterColon(text: string | null): string | null {
  const value = text?.split(":").slice(1).join(":").trim();
  return value === undefined || value.length === 0 ? null : value;
}

/** « / Cent » is a price per hundred pieces. */
function packOf(unitText: string): {
  unit: PartialProduct["unit"];
  packagingQuantity: number | null;
} {
  const folded = normalizeSpaces(unitText.toLowerCase());
  if (/\bcent\b/.test(folded)) {
    return { unit: "u", packagingQuantity: 100 };
  }
  if (/\bmille\b/.test(folded)) {
    return { unit: "u", packagingQuantity: 1000 };
  }
  if (/pi[eè]ce|unit/.test(folded)) {
    return { unit: "u", packagingQuantity: null };
  }
  return { unit: detectUnit(folded.replace(/^\s*\//, "/ ")), packagingQuantity: null };
}

export function refineDsb(page: ProductPage): PartialProduct {
  const document = page.document;
  // The title ends with « Réf. <manufacturer code> », already captured on its own.
  const designation =
    textOf(document, "h1[data-testid='article-header/article-name']")
      ?.replace(/\.?\s*R[ée]f\.\s*\S+$/i, "")
      .trim() || null;
  const priceElement = document.querySelector(PRICE);
  const price = priceElement === null ? null : parsePriceText(priceElement.textContent ?? "");
  const unitText = normalizeSpaces(priceElement?.nextElementSibling?.textContent ?? "");
  const pack = packOf(unitText);
  const box = priceElement?.closest("form")?.parentElement?.parentElement ?? document;
  const ecoText = [
    ...(
      priceElement?.parentElement?.parentElement?.parentElement?.parentElement ?? box
    ).querySelectorAll("span"),
  ]
    .map((span) => span.textContent ?? "")
    .find((text) => /^\s*dont\b.*[ée]co-?participation/i.test(text));
  const eco = ecoText === undefined ? null : parsePriceText(ecoText);
  const brandName = textOf(document, "[data-testid='article-header/article-brand-name']");
  const gtin = normalizeGtin(
    afterColon(textOf(document, "[data-testid='article-header/copy-ean-code']")),
  );
  return {
    ...(designation === null ? {} : { designation }),
    supplierCode: afterColon(textOf(document, "[data-testid='article-header/copy-brand-code']")),
    manufacturerCode: afterColon(
      textOf(document, "[data-testid='article-header/copy-supplier-code']"),
    ),
    ...(brandName === null ? {} : { brand: brandName }),
    ...(gtin === null ? {} : { gtin }),
    ...(price === null ? {} : { priceCents: price.cents, priceIsLowerBound: price.lowerBound }),
    ...(unitText === "" ? {} : pack),
    ecoContributionCents: eco?.cents ?? null,
  };
}

export function detectDsbBasis(page: ProductPage): PriceBasisDetection | null {
  const basis = detectBasisInText(textOf(page.document, PRICE) ?? "");
  return basis === null ? null : { basis, source: PriceBasisSource.ADAPTER };
}
