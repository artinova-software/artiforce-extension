import { PriceBasis, PriceBasisSource } from "../model/price-basis";
import { detectBasisInText, parsePriceText } from "../parsing/price";
import { detectPackagingQuantity } from "../parsing/unit";
import { type SupplierAdapter, textOf } from "./adapter";

/**
 * Brico Dépôt (www.bricodepot.fr). `/p/<EAN>/<slug>` pages. Products sold by
 * the piece but priced by area show « 2€45 TTC/Le M2 » then « Soit 7€35
 * TTC/La pièce »: the selling-unit price (the second one) is kept, like the
 * JSON-LD offer. There is no « Ajouter au panier » before a depot is chosen.
 */
export const bricoDepotAdapter: SupplierAdapter = {
  supplierId: "brico-depot",
  version: 1,

  isProductPage(page) {
    return (
      /^\/p\/\d{8,14}\//.test(page.url.pathname) &&
      page.document.querySelector(".pdp-info") !== null
    );
  },

  findAnchor(page) {
    const price = page.document.querySelector(".pdp-info .product-price");
    return price === null ? null : { element: price, position: "afterend" };
  },

  refine(page) {
    const document = page.document;
    const designation = textOf(document, "h1.pdp-slider-title, h1");
    const secondary = textOf(document, ".pdp-info .product-price-secondary-price");
    const main = textOf(document, ".pdp-info .product-price-wrapper");
    const selling = secondary ?? main;
    const price = selling === null ? null : parsePriceText(selling);
    const code = /^\/p\/(\d{8,14})\//.exec(page.url.pathname)?.[1] ?? null;
    const perPiece = secondary !== null && /pi[eè]ce|unit[eé]/i.test(secondary);
    return {
      ...(designation === null
        ? {}
        : { designation, packagingQuantity: detectPackagingQuantity(designation) }),
      ...(price === null ? {} : { priceCents: price.cents, priceIsLowerBound: price.lowerBound }),
      ...(code === null ? {} : { supplierCode: code }),
      ...(perPiece ? { unit: "u" as const } : {}),
    };
  },

  detectPriceBasis(page) {
    const text = textOf(page.document, ".pdp-info .product-price-wrapper") ?? "";
    const basis = detectBasisInText(text);
    return { basis: basis ?? PriceBasis.TTC, source: PriceBasisSource.ADAPTER };
  },
};
