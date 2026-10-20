import { PriceBasis, PriceBasisSource } from "../model/price-basis";
import { parsePriceText } from "../parsing/price";
import { decodeEntities } from "../parsing/text";
import { toHttpsUrl } from "../parsing/url";
import { detectPackagingQuantity } from "../parsing/unit";
import { type SupplierAdapter, textOf } from "./adapter";

/**
 * Castorama (www.castorama.fr). `/<slug>/<EAN>_CAFR.prd` pages; the JSON-LD
 * image is a 284 px preview, og:image the 1200 px one. Prices are TTC.
 */
export const castoramaAdapter: SupplierAdapter = {
  supplierId: "castorama",
  version: 1,

  isProductPage(page) {
    return (
      /_CAFR\.prd$/.test(page.url.pathname) &&
      page.document.querySelector("h1[data-testid='product-name']") !== null
    );
  },

  findAnchor(page) {
    const cta = page.document.querySelector("#add-to-basket-cta-section-main");
    return cta === null ? null : { element: cta, position: "afterend" };
  },

  refine(page) {
    const document = page.document;
    const designation = textOf(document, "h1[data-testid='product-name']");
    const priceText = textOf(document, "#product-info [data-testid='product-price']");
    const price = priceText === null ? null : parsePriceText(priceText);
    const ean =
      textOf(document, "[data-oncrawl-track='product-ean']") ??
      /\/(\d{8,14})_CAFR\.prd$/.exec(page.url.pathname)?.[1] ??
      null;
    const ogImage = document.querySelector("meta[property='og:image']")?.getAttribute("content");
    const imageUrl =
      ogImage === null || ogImage === undefined ? null : toHttpsUrl(decodeEntities(ogImage));
    return {
      ...(designation === null
        ? {}
        : { designation, packagingQuantity: detectPackagingQuantity(designation) }),
      ...(price === null ? {} : { priceCents: price.cents, priceIsLowerBound: price.lowerBound }),
      ...(ean === null ? {} : { supplierCode: ean }),
      ...(imageUrl === null ? {} : { imageUrl }),
    };
  },

  detectPriceBasis() {
    return { basis: PriceBasis.TTC, source: PriceBasisSource.ADAPTER };
  },
};
