import { describe, expect, it } from "vitest";

import { loadDocument } from "../../test/load-fixture";
import type { SupplierRecord } from "../registry/supplier-record.schema";
import { extractProduct, findAnchor, isProductPage } from "./extract-product";
import { createProductPage } from "./product-page";

const supplier = (overrides: Partial<SupplierRecord> = {}): SupplierRecord => ({
  id: "generic-test",
  name: "Générique",
  country: "FR",
  segment: "pro",
  sites: [{ host: "shop.example.fr" }],
  imageHosts: [],
  defaultPriceBasis: "HT",
  support: "generic",
  ...overrides,
});

const URL_ = "https://shop.example.fr/p/vis-123?utm_source=x#avis";

function page(html: string, record = supplier()) {
  return createProductPage(loadDocument(html, URL_), record);
}

describe("JSON-LD", () => {
  it("reads a Product inside @graph with a priceSpecification", () => {
    const result = extractProduct(
      page(
        `<script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", name: "X" },
            {
              "@type": ["Product"],
              name: "Vis &amp; écrou 4x40",
              sku: "V-123",
              mpn: "MPN-9",
              gtin13: "4006381333931",
              brand: { "@type": "Brand", name: "Spit" },
              image: [{ "@type": "ImageObject", url: "//cdn.example.fr/v.jpg" }],
              offers: {
                "@type": "Offer",
                priceSpecification: {
                  price: 12.5,
                  priceCurrency: "EUR",
                  valueAddedTaxIncluded: false,
                },
              },
            },
          ],
        })}</script>`,
      ),
    );
    expect(result).toMatchObject({
      ok: true,
      product: {
        designation: "Vis & écrou 4x40",
        supplierCode: "V-123",
        manufacturerCode: "MPN-9",
        gtin: "4006381333931",
        brand: "Spit",
        imageUrl: "https://cdn.example.fr/v.jpg",
        priceCents: 1250,
        priceBasis: "HT",
        priceBasisSource: "structured-data",
        productUrl: "https://shop.example.fr/p/vis-123",
      },
    });
  });

  it("reads the first variant of a ProductGroup and tolerates broken blocks", () => {
    const result = extractProduct(
      page(`<script type="application/ld+json">{ broken</script>
        <script type="application/ld+json">${JSON.stringify({
          "@type": "ProductGroup",
          name: "Peinture blanche",
          hasVariant: [{ "@type": "Product", offers: { price: "39.90", priceCurrency: "EUR" } }],
        })}</script>`),
    );
    expect(result).toMatchObject({
      ok: true,
      product: { designation: "Peinture blanche", priceCents: 3990, priceBasis: "HT" },
    });
    if (result.ok) {
      expect(result.product.priceBasisSource).toBe("registry-default");
    }
  });

  it("drops a price in another currency", () => {
    const result = extractProduct(
      page(
        `<script type="application/ld+json">${JSON.stringify({
          "@type": "Product",
          name: "Vis",
          offers: { price: "10", priceCurrency: "USD" },
        })}</script>`,
      ),
    );
    expect(result).toMatchObject({
      ok: true,
      product: { priceCents: null, priceBasis: "UNKNOWN", priceBasisSource: "none" },
    });
  });
});

describe("JSON-LD offers", () => {
  const product = (offers: unknown, extra: Record<string, unknown> = {}) =>
    page(
      `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", name: "Vis", offers, ...extra })}</script>`,
    );

  it("ignores a struck-through former price", () => {
    const result = extractProduct(
      product({
        priceSpecification: [
          {
            price: "74.99",
            priceCurrency: "EUR",
            priceType: "https://schema.org/StrikethroughPrice",
          },
          { price: "59.99", priceCurrency: "EUR" },
        ],
      }),
    );
    expect(result).toMatchObject({ ok: true, product: { priceCents: 5999 } });
  });

  it("treats an AggregateOffer range as a lower bound with an unknown basis", () => {
    const result = extractProduct(
      product({
        "@type": "AggregateOffer",
        lowPrice: 85.3,
        highPrice: 982.35,
        priceCurrency: "EUR",
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      product: { priceCents: 8530, priceBasis: "UNKNOWN" },
    });
  });

  it("reads « ean: » product ids as GTINs and drops placeholder brands", () => {
    const result = extractProduct(
      product({ price: 1 }, { productID: "ean:4006381333931", brand: { name: "Unbranded" } }),
    );
    expect(result).toMatchObject({
      ok: true,
      product: { gtin: "4006381333931", supplierCode: null, brand: null },
    });
  });
});

describe("microdata", () => {
  it("reads itemprops and the HT label next to the price", () => {
    const result = extractProduct(
      page(
        `<div itemscope itemtype="https://schema.org/Product">
        <h1 itemprop="name">Câble R2V 3G2,5</h1>
        <span itemprop="sku">CAB-25</span>
        <img itemprop="image" src="/img/cable.jpg">
        <div itemprop="review" itemscope itemtype="https://schema.org/Review"><span itemprop="name">Avis</span></div>
        <div itemprop="offers" itemscope itemtype="https://schema.org/Offer">
          <p><span itemprop="price" content="1.95">1,95 €</span> HT / m</p>
          <meta itemprop="priceCurrency" content="EUR">
        </div>
      </div>`,
        supplier({ defaultPriceBasis: "UNKNOWN" }),
      ),
    );
    expect(result).toMatchObject({
      ok: true,
      product: {
        designation: "Câble R2V 3G2,5",
        supplierCode: "CAB-25",
        imageUrl: "https://shop.example.fr/img/cable.jpg",
        priceCents: 195,
        priceBasis: "HT",
        priceBasisSource: "page-text",
      },
    });
  });
});

describe("meta tags", () => {
  it("falls back to Open Graph and the canonical link", () => {
    const result = extractProduct(
      page(`<head>
        <meta property="og:type" content="product">
        <meta property="og:title" content="Disjoncteur 16A | Shop">
        <meta property="og:image" content="https://shop.example.fr/d.jpg">
        <meta property="product:price:amount" content="8.40">
        <meta property="product:price:currency" content="EUR">
        <link rel="canonical" href="https://shop.example.fr/p/disjoncteur-16a">
      </head>`),
    );
    expect(result).toMatchObject({
      ok: true,
      product: {
        designation: "Disjoncteur 16A",
        productUrl: "https://shop.example.fr/p/disjoncteur-16a",
        priceCents: 840,
      },
    });
  });

  it("fails without a designation", () => {
    const result = extractProduct(page("<p>Rien</p>"));
    expect(result.ok).toBe(false);
  });
});

describe("product page and anchor", () => {
  it("needs structured data and a matching productPath", () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"A"}</script>`;
    expect(isProductPage(page(html))).toBe(true);
    expect(isProductPage(page(html, supplier({ productPath: "^/produit/" })))).toBe(false);
    expect(isProductPage(page("<h1>Catégorie</h1>"))).toBe(false);
  });

  it("anchors after a visible add-to-cart button", () => {
    const anchor = findAnchor(
      page(`<button hidden>Ajouter au panier</button><button id="b">Ajouter au panier</button>`),
    );
    expect(anchor?.element.id).toBe("b");
    expect(anchor?.position).toBe("afterend");
    expect(findAnchor(page("<button>Acheter</button>"))).toBeNull();
  });
});
