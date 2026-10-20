import type { CapturedProduct } from "@artinova-software/extension-suppliers/registry";

/** A valid captured product (Leroy Merlin), with overrides. */
export function product(overrides: Partial<CapturedProduct> = {}): CapturedProduct {
  return {
    designation: "Sac à gravats 70 l",
    productUrl: "https://www.leroymerlin.fr/produits/sac-1.html",
    supplierCode: "66471860",
    manufacturerCode: null,
    gtin: null,
    brand: "OCAI",
    unit: null,
    packagingQuantity: null,
    priceCents: 399,
    currency: "EUR",
    priceBasis: "TTC",
    priceBasisSource: "adapter",
    ecoContributionCents: null,
    imageUrl: "https://media.adeo.com/media/1/media.jpg",
    ...overrides,
  };
}
