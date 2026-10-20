import type { PartialProduct } from "../model/captured-product";
import { PriceBasis } from "../model/price-basis";
import { normalizeGtin } from "../parsing/gtin";
import { parseDecimal } from "../parsing/price";
import { cleanText, decodeEntities } from "../parsing/text";
import { canonicalProductUrl, toHttpsUrl } from "../parsing/url";

type JsonObject = Record<string, unknown>;

export type StructuredResult = PartialProduct & {
  /** `valueAddedTaxIncluded` or an explicit HT/TTC in the offer, if any. */
  structuredBasis?: PriceBasis | null;
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function typesOf(node: JsonObject): string[] {
  const raw = node["@type"];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.replace(/^(?:https?:\/\/)?schema\.org\//i, "").replace(/^schema:/i, ""));
}

/** Every object node in the JSON-LD blocks, @graph and nested arrays flattened. */
export function readJsonLdNodes(document: Document): JsonObject[] {
  const nodes: JsonObject[] = [];
  const visit = (value: unknown, depth: number): void => {
    if (depth > 6) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, depth + 1));
    } else if (isObject(value)) {
      nodes.push(value);
      if (Array.isArray(value["@graph"])) {
        visit(value["@graph"], depth + 1);
      }
    }
  };
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      visit(JSON.parse(script.textContent ?? ""), 0);
    } catch {
      // Malformed JSON-LD is common; skip the block.
    }
  }
  return nodes;
}

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function text(value: unknown): string | null {
  const raw = first(value);
  if (isObject(raw)) {
    return text(raw["name"] ?? raw["@value"]);
  }
  return typeof raw === "string" ? cleanText(decodeEntities(raw)) : cleanText(raw);
}

function imageOf(value: unknown, base: string): string | null {
  const raw = first(value);
  if (isObject(raw)) {
    return imageOf(raw["url"] ?? raw["contentUrl"] ?? raw["@id"], base);
  }
  return toHttpsUrl(typeof raw === "string" ? decodeEntities(raw) : raw, base);
}

/** `productID: "ean:3660965018136"` carries a GTIN, not a supplier reference. */
function prefixedId(value: unknown): { kind: "gtin" | "other"; id: string } | null {
  const raw = text(value);
  if (raw === null) {
    return null;
  }
  const match = /^(ean|gtin(?:8|12|13|14)?|upc|isbn)\s*:\s*(.+)$/i.exec(raw);
  return match?.[2] === undefined ? { kind: "other", id: raw } : { kind: "gtin", id: match[2] };
}

function gtinOf(node: JsonObject): string | null {
  for (const key of ["gtin13", "gtin", "gtin14", "gtin12", "gtin8", "ean"]) {
    const gtin = normalizeGtin(first(node[key]));
    if (gtin !== null) {
      return gtin;
    }
  }
  const productId = prefixedId(node["productID"]);
  return productId?.kind === "gtin" ? normalizeGtin(productId.id) : null;
}

type OfferRead = {
  priceCents: number | null;
  currency: string | null;
  basis: PriceBasis | null;
  url: unknown;
  /** Only a « from » price is known (AggregateOffer lowPrice with a different highPrice). */
  lowerBound: boolean;
};

const isStrikethrough = (node: JsonObject) =>
  /Strikethrough|ListPrice|MSRP/i.test(String(node["priceType"] ?? ""));

function readOffer(offers: unknown, pageUrl: string): OfferRead | null {
  const list = (Array.isArray(offers) ? offers : [offers]).filter(isObject);
  if (list.length === 0) {
    return null;
  }
  // AggregateOffer carries lowPrice; a list of offers: the one for this page, else the first.
  const offer =
    list.find((entry) => canonicalProductUrl(entry["url"], pageUrl) === pageUrl) ?? list[0];
  if (offer === undefined) {
    return null;
  }
  if (typesOf(offer).includes("AggregateOffer") && Array.isArray(offer["offers"])) {
    return readOffer(offer["offers"], pageUrl);
  }
  // A struck-through « old price » specification is not the price.
  const specification = (
    Array.isArray(offer["priceSpecification"])
      ? offer["priceSpecification"]
      : [offer["priceSpecification"]]
  )
    .filter(isObject)
    .find((entry) => !isStrikethrough(entry));
  const fromLowPrice = offer["price"] === undefined && specification?.["price"] === undefined;
  const price = offer["price"] ?? specification?.["price"] ?? offer["lowPrice"];
  const lowerBound =
    fromLowPrice &&
    offer["lowPrice"] !== undefined &&
    offer["highPrice"] !== undefined &&
    parseDecimal(offer["lowPrice"]) !== parseDecimal(offer["highPrice"]);
  const vat = specification?.["valueAddedTaxIncluded"] ?? offer["valueAddedTaxIncluded"];
  const basis =
    vat === true || vat === "true"
      ? PriceBasis.TTC
      : vat === false || vat === "false"
        ? PriceBasis.HT
        : null;
  return {
    priceCents: parseDecimal(price),
    currency: text(offer["priceCurrency"] ?? specification?.["priceCurrency"]),
    basis,
    url: offer["url"],
    lowerBound,
  };
}

/** « Unbranded », « Sans marque »… are not brands. */
export function realBrand(brand: string | null): string | null {
  return brand === null ||
    /^(unbranded|no brand|generic|g[ée]n[ée]rique|sans marque|non renseign[ée]e?)$/i.test(brand)
    ? null
    : brand;
}

/** The product described by JSON-LD (`Product`, `ProductGroup`, `@graph`), or null. */
export function extractFromJsonLd(document: Document, pageUrl: string): StructuredResult | null {
  const nodes = readJsonLdNodes(document);
  const products = nodes.filter((node) =>
    typesOf(node).some((type) => type === "Product" || type === "ProductGroup"),
  );
  if (products.length === 0) {
    return null;
  }
  // Prefer the product whose url/offer url is this page, then a plain Product.
  const canonical = canonicalProductUrl(pageUrl);
  const product =
    products.find((node) => canonicalProductUrl(node["url"], pageUrl) === canonical) ??
    products.find((node) => typesOf(node).includes("Product")) ??
    products[0];
  if (product === undefined) {
    return null;
  }
  let offerSource: unknown = product["offers"];
  if (offerSource === undefined && Array.isArray(product["hasVariant"])) {
    const variants = product["hasVariant"].filter(isObject);
    const variant =
      variants.find((entry) => canonicalProductUrl(entry["url"], pageUrl) === canonical) ??
      variants[0];
    offerSource = variant?.["offers"];
  }
  const offer = readOffer(offerSource, canonical ?? pageUrl);
  return {
    designation: text(product["name"]) ?? undefined,
    supplierCode:
      text(product["sku"]) ??
      ((id) => (id?.kind === "other" ? id.id : null))(prefixedId(product["productID"])),
    manufacturerCode: text(product["mpn"]),
    gtin: gtinOf(product),
    brand: realBrand(text(product["brand"] ?? product["manufacturer"])),
    imageUrl: imageOf(product["image"], pageUrl),
    productUrl: canonicalProductUrl(product["url"] ?? offer?.url, pageUrl) ?? undefined,
    priceCents: offer?.priceCents ?? null,
    currency: offer?.currency ?? null,
    structuredBasis: offer?.basis ?? null,
    priceIsLowerBound: offer?.lowerBound ?? false,
  };
}
