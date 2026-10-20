import { PriceBasisSource } from "../model/price-basis";
import { normalizeGtin } from "../parsing/gtin";
import { detectBasisInText, parsePriceText } from "../parsing/price";
import { cleanText } from "../parsing/text";
import { toHttpsUrl } from "../parsing/url";
import { type SupplierAdapter, textOf } from "./adapter";

/**
 * Rexel (www.rexel.fr). An Angular storefront without structured data;
 * references sit in `aria-label`s (« Réf Rexel LEG406783 », « Réf Fab 406783 »,
 * « EAN13 … »). Prices are shown to logged-in customers only, HT.
 */
export const rexelAdapter: SupplierAdapter = {
  supplierId: "rexel",
  version: 1,

  isProductPage(page) {
    return (
      /\/p\/\d+$/.test(page.url.pathname) &&
      page.document.querySelector(".product-header h1, h1") !== null
    );
  },

  findAnchor(page) {
    const cart = page.document.querySelector(".product-cart .add-to-cart-wrapper, .product-cart");
    return cart === null ? null : { element: cart, position: "afterend" };
  },

  refine(page) {
    const document = page.document;
    const references = new Map<string, string>();
    for (const element of document.querySelectorAll(".ds-product-reference[aria-label]")) {
      const label = cleanText(element.getAttribute("aria-label")) ?? "";
      const match = /^(Réf Rexel|Réf Fab|EAN13)\s+(.+)$/i.exec(label);
      if (
        match?.[1] !== undefined &&
        match[2] !== undefined &&
        !references.has(match[1].toLowerCase())
      ) {
        references.set(match[1].toLowerCase(), match[2].trim());
      }
    }
    const designation = textOf(document, ".product-header h1, h1");
    const brand = cleanText(
      document.querySelector(".product-header a[href*='/Fabricant/'] img")?.getAttribute("alt"),
    );
    const image = document.querySelector(".product-medias img.object-fit-contain");
    const imageUrl = toHttpsUrl(image?.getAttribute("src"), page.url.href);
    const priceText = textOf(document, "mf-pdp-product-price-display");
    const price = priceText === null ? null : parsePriceText(priceText);
    return {
      ...(designation === null ? {} : { designation }),
      supplierCode: references.get("réf rexel") ?? null,
      manufacturerCode: references.get("réf fab") ?? null,
      gtin: normalizeGtin(references.get("ean13")),
      ...(brand === null ? {} : { brand }),
      ...(imageUrl === null ? {} : { imageUrl }),
      ...(price === null ? {} : { priceCents: price.cents, priceIsLowerBound: price.lowerBound }),
    };
  },

  detectPriceBasis(page) {
    const basis = detectBasisInText(textOf(page.document, "mf-pdp-product-price-display") ?? "");
    return basis === null ? null : { basis, source: PriceBasisSource.ADAPTER };
  },
};
