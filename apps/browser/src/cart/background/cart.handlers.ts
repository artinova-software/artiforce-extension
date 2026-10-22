import type { SupplierRecord } from "@artiforce-software/extension-suppliers/registry";

import { CommandError } from "../../platform/messaging/command";
import type { MessageRouter } from "../../platform/messaging/message-router";
import { CartErrorCode, cartAdd, cartClear, cartRemove } from "../cart.commands";
import type { CartItem } from "../models/cart-item";
import type { CartService } from "../services/cart.service";

export type CartHandlerDependencies = {
  cart: CartService;
  /** The supplier owning a sender URL (the router already checked it is one). */
  supplierFor(url: string): SupplierRecord | undefined;
  /** Called after an add whose image must be downloaded. */
  onImagePending(item: CartItem): void;
};

export function registerCartHandlers(router: MessageRouter, deps: CartHandlerDependencies): void {
  router.register(cartAdd, async ({ product, adapterVersion }, { sender }) => {
    const supplier = sender.url === undefined ? undefined : deps.supplierFor(sender.url);
    if (supplier === undefined) {
      throw new CommandError(CartErrorCode.UNKNOWN_SUPPLIER, "Sender is not a supplier page");
    }
    const result = await deps.cart.add(product, supplier, adapterVersion);
    if (result.item.image.status === "pending") {
      deps.onImagePending(result.item);
    }
    return { status: result.status, itemId: result.item.id, count: result.count };
  });

  router.register(cartRemove, async ({ ids }) => {
    const cart = await deps.cart.remove(ids);
    return { count: cart.items.length };
  });

  router.register(cartClear, async () => {
    await deps.cart.clear();
    return { count: 0 as const };
  });
}
