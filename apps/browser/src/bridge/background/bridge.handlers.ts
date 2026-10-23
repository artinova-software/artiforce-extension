import { SUPPORTED_PROTOCOLS } from "@artiforce-software/extension-bridge/wire";

import type { CartService } from "../../cart/services/cart.service";
import type { ImageService } from "../../images/services/image.service";
import type { MessageRouter } from "../../platform/messaging/message-router";
import {
  bridgeClearCart,
  bridgeGetCart,
  bridgeGetImages,
  bridgeHello,
  bridgeRemoveItems,
} from "../bridge.commands";
import { toWire } from "./to-wire";

export type BridgeHandlerDependencies = {
  cart: CartService;
  images: ImageService;
  version: string;
  browser: "chrome" | "edge" | "firefox" | "safari";
};

export function registerBridgeHandlers(
  router: MessageRouter,
  deps: BridgeHandlerDependencies,
): void {
  router.register(bridgeHello, async () => ({
    extensionVersion: deps.version,
    browser: deps.browser,
    protocols: [...SUPPORTED_PROTOCOLS],
    capabilities: ["cart", "images", "removeItems", "clearCart"],
  }));

  router.register(bridgeGetCart, async () => {
    const cart = await deps.cart.get();
    return { revision: cart.revision, items: cart.items.map(toWire) };
  });

  router.register(bridgeGetImages, async ({ itemIds }) => {
    const known = new Set((await deps.cart.get()).items.map((item) => item.id));
    const images = await Promise.all(
      [...new Set(itemIds)].map(async (itemId) => {
        const stored = known.has(itemId) ? await deps.images.get(itemId) : null;
        return {
          itemId,
          dataUrl: stored?.dataUrl ?? null,
          width: stored?.width ?? null,
          height: stored?.height ?? null,
        };
      }),
    );
    return { images };
  });

  router.register(bridgeRemoveItems, async ({ items }) => {
    const result = await deps.cart.removeObserved(items);
    return { removed: result.removed, kept: result.kept, revision: result.cart.revision };
  });

  router.register(bridgeClearCart, async ({ expectedRevision }) => {
    const cart = await deps.cart.clear(expectedRevision);
    return { revision: cart.revision };
  });
}
