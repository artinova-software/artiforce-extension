import { PriceBasis, PriceBasisSource } from "../model/price-basis";
import { parsePriceText } from "../parsing/price";
import { cleanText } from "../parsing/text";
import { toHttpsUrl } from "../parsing/url";
import { detectPackagingQuantity } from "../parsing/unit";
import { type SupplierAdapter, textOf } from "./adapter";

const ASIN = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/;

/**
 * Amazon.fr. No structured data: title, buy-box price, ASIN and the hi-res
 * landing image come from the DOM. The page language may be English
 * (« €9.90 »): the price parser reads both. Prices are TTC.
 */
export const amazonAdapter: SupplierAdapter = {
  supplierId: "amazon",
  version: 1,

  isProductPage(page) {
    return ASIN.test(page.url.pathname) && page.document.querySelector("#productTitle") !== null;
  },

  findAnchor(page) {
    const cart = page.document.querySelector("#addToCart_feature_div, #buybox");
    return cart === null ? null : { element: cart, position: "afterend" };
  },

  refine(page) {
    const document = page.document;
    const designation = textOf(document, "#productTitle");
    const asin =
      document.querySelector("input#ASIN")?.getAttribute("value") ??
      ASIN.exec(page.url.pathname)?.[1] ??
      null;
    const box = document.querySelector(
      "#corePriceDisplay_desktop_feature_div .priceToPay, #corePrice_feature_div .a-price",
    );
    const offscreen = cleanText(box?.querySelector(".a-offscreen")?.textContent);
    const whole = cleanText(box?.querySelector(".a-price-whole")?.textContent)?.replace(
      /[.,]$/,
      "",
    );
    const fraction = cleanText(box?.querySelector(".a-price-fraction")?.textContent);
    const priceText =
      offscreen ??
      (whole === undefined || whole === null ? null : `${whole},${fraction ?? "00"} €`);
    const price = priceText === null ? null : parsePriceText(priceText);
    // « Visiter la boutique Legrand », « Visit the Legrand Store », « Marque : Legrand ».
    const byline = textOf(document, "#bylineInfo") ?? "";
    const brand =
      /^(?:visiter la boutique|visit the)\s+(.+?)(?:\s+store)?$/i.exec(byline)?.[1] ??
      /^(?:marque|brand)\s*:\s*(.+)$/i.exec(byline)?.[1] ??
      null;
    const image = document.querySelector("#landingImage");
    const imageUrl = toHttpsUrl(
      image?.getAttribute("data-old-hires") || image?.getAttribute("src"),
    );
    return {
      ...(designation === null
        ? {}
        : { designation, packagingQuantity: detectPackagingQuantity(designation) }),
      ...(asin === null
        ? {}
        : { supplierCode: asin, productUrl: `https://www.amazon.fr/dp/${asin}` }),
      ...(price === null ? {} : { priceCents: price.cents, priceIsLowerBound: price.lowerBound }),
      ...(imageUrl === null ? {} : { imageUrl }),
      ...(brand === null ? {} : { brand: brand.trim() }),
    };
  },

  detectPriceBasis() {
    return { basis: PriceBasis.TTC, source: PriceBasisSource.ADAPTER };
  },
};
