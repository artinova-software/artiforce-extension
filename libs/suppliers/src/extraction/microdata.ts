import { PriceBasis } from "../model/price-basis";
import { normalizeGtin } from "../parsing/gtin";
import { parseDecimal, parsePriceText } from "../parsing/price";
import { cleanText } from "../parsing/text";
import { toHttpsUrl } from "../parsing/url";
import type { StructuredResult } from "./json-ld";

/** The value of an itemprop element, per the microdata rules. */
function propValue(element: Element | null): string | null {
  if (element === null) {
    return null;
  }
  const attribute =
    element.getAttribute("content") ??
    (element.matches("a, link") ? element.getAttribute("href") : null) ??
    (element.matches("img, source") ? element.getAttribute("src") : null) ??
    (element.matches("meta, data, input") ? element.getAttribute("value") : null);
  return attribute ?? element.textContent;
}

/** Itemprop lookup that ignores properties belonging to nested items (reviews…). */
function findProp(scope: Element, name: string): Element | null {
  for (const element of scope.querySelectorAll(`[itemprop~="${name}"]`)) {
    const owner = element.parentElement?.closest("[itemscope]");
    if (owner === scope || owner === null) {
      return element;
    }
  }
  return null;
}

export function extractFromMicrodata(document: Document, pageUrl: string): StructuredResult | null {
  const scope = document.querySelector('[itemscope][itemtype*="schema.org/Product" i]');
  if (scope === null) {
    return null;
  }
  const offers = findProp(scope, "offers");
  const offerScope = offers?.hasAttribute("itemscope") ? offers : scope;
  const priceElement = findProp(offerScope, "price") ?? scope.querySelector('[itemprop="price"]');
  const rawPrice = propValue(priceElement);
  const brandElement = findProp(scope, "brand");
  const brand = brandElement?.hasAttribute("itemscope")
    ? propValue(findProp(brandElement, "name"))
    : propValue(brandElement);
  const vat = propValue(findProp(offerScope, "valueAddedTaxIncluded"));
  let gtin: string | null = null;
  for (const key of ["gtin13", "gtin", "gtin14", "gtin12", "gtin8"]) {
    gtin = normalizeGtin(propValue(findProp(scope, key)));
    if (gtin !== null) {
      break;
    }
  }
  return {
    designation: cleanText(propValue(findProp(scope, "name"))) ?? undefined,
    supplierCode: cleanText(propValue(findProp(scope, "sku")), 100),
    manufacturerCode: cleanText(propValue(findProp(scope, "mpn")), 100),
    gtin,
    brand: cleanText(brand, 200),
    imageUrl: toHttpsUrl(propValue(findProp(scope, "image")), pageUrl),
    priceCents:
      parseDecimal(rawPrice) ??
      (rawPrice === null ? null : (parsePriceText(rawPrice)?.cents ?? null)),
    currency: cleanText(propValue(findProp(offerScope, "priceCurrency"))),
    structuredBasis: vat === "true" ? PriceBasis.TTC : vat === "false" ? PriceBasis.HT : null,
  };
}
