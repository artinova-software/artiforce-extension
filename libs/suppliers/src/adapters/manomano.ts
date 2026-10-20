import { PriceBasis, PriceBasisSource } from "../model/price-basis";
import { type SupplierAdapter, textOf } from "./adapter";

/**
 * ManoMano (www.manomano.fr). A marketplace: one JSON-LD Product per variant,
 * the selected one matching the canonical `?model_id=`; the generic chain picks
 * it. The adapter places the button and pins the basis (consumer prices, TTC).
 */
export const manomanoAdapter: SupplierAdapter = {
  supplierId: "manomano",
  version: 1,

  isProductPage(page) {
    return (
      /^\/p\/.+-\d+$/.test(page.url.pathname) &&
      page.document.querySelector(
        "[data-testid='paybox-main-cta'], script[type='application/ld+json']",
      ) !== null
    );
  },

  findAnchor(page) {
    const cta = page.document.querySelector("[data-testid='paybox-main-cta']");
    const block = cta?.parentElement ?? null;
    return block === null ? null : { element: block, position: "afterend" };
  },

  refine(page) {
    const designation = textOf(page.document, "h1");
    return designation === null ? {} : { designation };
  },

  detectPriceBasis() {
    return { basis: PriceBasis.TTC, source: PriceBasisSource.ADAPTER };
  },
};
