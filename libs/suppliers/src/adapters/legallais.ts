import { PriceBasisSource } from "../model/price-basis";
import { detectBasisInText, parsePriceText } from "../parsing/price";
import { canonicalProductUrl } from "../parsing/url";
import { detectPackagingQuantity } from "../parsing/unit";
import { type SupplierAdapter, textOf } from "./adapter";

/**
 * Legallais (www.legallais.com). `/produit/<slug>/<family>/<article>` pages:
 * the family carries the JSON-LD and microdata, the article (« Réf ») is in the
 * buy box and the references table. Prices are for logged-in professionals.
 */
export const legallaisAdapter: SupplierAdapter = {
  supplierId: "legallais",
  version: 1,

  isProductPage(page) {
    return (
      /^\/produit\/.+\/\d+\/\d+\/?$/.test(page.url.pathname) &&
      page.document.querySelector(".c-buy-box") !== null
    );
  },

  findAnchor(page) {
    const box = page.document.querySelector("#buy-box-addtocart, .c-buy-box");
    return box === null ? null : { element: box, position: "afterend" };
  },

  refine(page) {
    const document = page.document;
    const reference = textOf(document, ".c-buy-box .c-reference__ref");
    const row =
      reference === null
        ? null
        : document.querySelector(`tr[data-article-code="${CSS.escape(reference)}"]`);
    const packaging = row?.querySelector("td:last-child")?.textContent ?? "";
    const designation = textOf(document, "h1");
    const connectedPrice = textOf(document, ".c-buy-box [class*='price']");
    const price = connectedPrice === null ? null : parsePriceText(connectedPrice);
    return {
      ...(designation === null ? {} : { designation }),
      ...(reference === null ? {} : { supplierCode: reference }),
      productUrl: canonicalProductUrl(page.url.href) ?? undefined,
      packagingQuantity: detectPackagingQuantity(packaging),
      ...(price === null ? {} : { priceCents: price.cents }),
    };
  },

  detectPriceBasis(page) {
    const basis = detectBasisInText(textOf(page.document, ".c-buy-box [class*='price']") ?? "");
    return basis === null ? null : { basis, source: PriceBasisSource.ADAPTER };
  },
};
