import { PriceBasis, PriceBasisSource } from "../model/price-basis";
import { parsePriceText } from "../parsing/price";
import { type SupplierAdapter, textOf } from "./adapter";

/**
 * IKEA France (www.ikea.com/fr/fr). The price module shows the current price,
 * a struck-through former price during offers, and « Dont Éco-part. … ».
 */
export const ikeaAdapter: SupplierAdapter = {
  supplierId: "ikea",
  version: 1,

  isProductPage(page) {
    return (
      /^\/fr\/fr\/p\/.+-s?\d{8}\/?$/.test(page.url.pathname) &&
      page.document.querySelector(".js-product-pip, .pipf-page") !== null
    );
  },

  findAnchor(page) {
    const cart = page.document.querySelector(".js-add-to-cart-section");
    return cart === null ? null : { element: cart, position: "afterend" };
  },

  refine(page) {
    const document = page.document;
    const designation = textOf(document, ".pipf-price-package h1, h1");
    const current =
      textOf(
        document,
        ".pipf-price-package .pipcom-price-module__current-price .pipcom-price__sr-text",
      ) ?? textOf(document, ".pipf-price-package .pipcom-price-module__current-price");
    const price = current === null ? null : parsePriceText(current);
    const reference = textOf(document, ".pipf-product-identifier__value");
    const ecoText = [...document.querySelectorAll(".pipcom-price-module__addon")]
      .map((element) => element.textContent ?? "")
      .find((text) => /[ée]co-?part/i.test(text));
    const eco = ecoText === undefined ? null : parsePriceText(ecoText.replace(/^[^\d]*/, ""));
    return {
      ...(designation === null ? {} : { designation }),
      ...(price === null ? {} : { priceCents: price.cents, priceIsLowerBound: price.lowerBound }),
      ...(reference === null ? {} : { supplierCode: reference, manufacturerCode: null }),
      ecoContributionCents: eco?.cents ?? null,
      unit: "u",
    };
  },

  detectPriceBasis() {
    return { basis: PriceBasis.TTC, source: PriceBasisSource.ADAPTER };
  },
};
