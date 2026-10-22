import { bridgeCartItemSchema } from "@artiforce-software/extension-bridge/wire";
import { describe, expect, it } from "vitest";

import type { CartItem } from "../../cart/models/cart-item";
import { toWire } from "./to-wire";

const item: CartItem = {
  id: "00000000-0000-4000-8000-000000000001",
  dedupeKey: "leroy-merlin|ref|66471860",
  supplierId: "leroy-merlin",
  supplierName: "Leroy Merlin",
  designation: "Sac à gravats 70 l",
  supplierCode: "66471860",
  manufacturerCode: null,
  gtin: "3045050086274",
  brand: "OCAI",
  unit: "u",
  packagingQuantity: null,
  productUrl: "https://www.leroymerlin.fr/produits/sac-1.html",
  sourceImageUrl: "https://media.adeo.com/media/1/media.jpg",
  priceCents: 399,
  currency: "EUR",
  priceBasis: "TTC",
  priceBasisSource: "adapter",
  ecoContributionCents: null,
  adapterVersion: 1,
  image: {
    status: "ready",
    width: 634,
    height: 1024,
    bytes: 92164,
    thumbnailDataUrl: "data:image/jpeg;base64,AA==",
  },
  observedAt: "2026-10-12T10:00:00.000Z",
  expiresAt: "2026-10-19T10:00:00.000Z",
};

describe("toWire", () => {
  it("maps a cart item to a valid bridge item without internal fields", () => {
    const wire = toWire(item);
    expect(bridgeCartItemSchema.parse(wire)).toEqual(wire);
    expect(wire).toMatchObject({
      supplier: { id: "leroy-merlin", name: "Leroy Merlin" },
      price: { cents: 399, currency: "EUR", basis: "TTC", basisSource: "adapter" },
      image: { status: "ready", width: 634, height: 1024 },
    });
    expect(JSON.stringify(wire)).not.toMatch(
      /dedupeKey|thumbnailDataUrl|sourceImageUrl|adapterVersion/,
    );
  });

  it("reports image dimensions only when ready", () => {
    expect(toWire({ ...item, image: { status: "pending", attempts: 1 } }).image).toEqual({
      status: "pending",
      width: null,
      height: null,
    });
  });
});
