import { PriceBasis, PriceBasisSource } from "../model/price-basis";
import { detectPackagingQuantity, detectUnit } from "../parsing/unit";
import { parsePriceText } from "../parsing/price";
import { type SupplierAdapter, textOf } from "./adapter";

const BUY_BOX = ".js-buy-box";

/**
 * Leroy Merlin (www.leroymerlin.fr). Product pages are server-rendered with a
 * Product JSON-LD; the buy box holds the displayed price, its unit (« / Lot »,
 * « / m² ») and the hidden `reflm` input. Prices are always TTC.
 */
export const leroyMerlinAdapter: SupplierAdapter = {
  supplierId: "leroy-merlin",
  version: 2,

  isProductPage(page) {
    return (
      /^\/produits\/.+-\d{6,}\.html$/.test(page.url.pathname) &&
      page.document.querySelector(`#product-detail, ${BUY_BOX}`) !== null
    );
  },

  findAnchor(page) {
    const buyLine = page.document.querySelector(`${BUY_BOX} .m-buyLine`);
    if (buyLine !== null) {
      return { element: buyLine, position: "afterend" };
    }
    const form = page.document.querySelector(".js-add-to-cart-pdp-form");
    return form === null ? null : { element: form, position: "afterend" };
  },

  refine(page) {
    const document = page.document;
    const box = document.querySelector(BUY_BOX) ?? document;
    // During a promotion the struck former price (« -crossed », CROSSED_PRICE)
    // comes first in the DOM: read the main price only.
    const priceLine =
      textOf(box, ".m-price.-main [data-cerberus='ELEM_PRIX']") ??
      textOf(box, ".m-price:not(.-crossed) .m-price__line");
    const unitText = textOf(box, ".m-price:not(.-crossed) .m-price__unit") ?? "";
    const accessible = textOf(box, ".m-price:not(.-crossed) .kl-hidden-accessibility") ?? "";
    const price = priceLine === null ? null : parsePriceText(priceLine);
    const designation = textOf(document, "h1#product-name, h1");
    const ecoText =
      textOf(box, "[data-feature-name='ecopart']") ?? textOf(box, "[class*='ecopart' i]");
    const eco = ecoText === null ? null : parsePriceText(ecoText);
    const reference = box.querySelector("input[name='reflm']")?.getAttribute("value") ?? null;
    return {
      ...(designation === null ? {} : { designation }),
      ...(reference === null ? {} : { supplierCode: reference }),
      ...(price === null ? {} : { priceCents: price.cents, priceIsLowerBound: price.lowerBound }),
      unit: detectUnit(`${unitText} ${accessible}`),
      packagingQuantity: detectPackagingQuantity(designation ?? ""),
      ecoContributionCents: eco?.cents ?? null,
    };
  },

  detectPriceBasis() {
    return { basis: PriceBasis.TTC, source: PriceBasisSource.ADAPTER };
  },
};
