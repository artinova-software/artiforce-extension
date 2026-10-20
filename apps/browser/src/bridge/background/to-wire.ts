import type { BridgeCartItem } from "@artinova-software/extension-bridge/wire";

import type { CartItem } from "../../cart/models/cart-item";

/** Storage model to wire model. Internal fields (dedupe key, thumbnails…) stay home. */
export function toWire(item: CartItem): BridgeCartItem {
  return {
    id: item.id,
    observedAt: item.observedAt,
    expiresAt: item.expiresAt,
    supplier: { id: item.supplierId, name: item.supplierName },
    designation: item.designation,
    supplierCode: item.supplierCode,
    manufacturerCode: item.manufacturerCode,
    gtin: item.gtin,
    brand: item.brand,
    unit: item.unit,
    packagingQuantity: item.packagingQuantity,
    productUrl: item.productUrl,
    price: {
      cents: item.priceCents,
      currency: item.currency,
      basis: item.priceBasis,
      basisSource: item.priceBasisSource,
    },
    ecoContributionCents: item.ecoContributionCents,
    image: {
      status: item.image.status,
      width: item.image.status === "ready" ? item.image.width : null,
      height: item.image.status === "ready" ? item.image.height : null,
    },
  };
}
