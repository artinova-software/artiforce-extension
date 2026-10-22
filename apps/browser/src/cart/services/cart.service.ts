import type {
  CapturedProduct,
  SupplierRecord,
} from "@artiforce-software/extension-suppliers/registry";

import { CommandError } from "../../platform/messaging/command";
import type { GlobalState } from "../../platform/state/global-state";
import { CartErrorCode } from "../cart.commands";
import {
  CART_MAX_ITEMS,
  CART_TTL_MS,
  type CartImage,
  type CartItem,
  type CartState,
} from "../models/cart-item";

export type CartServiceDependencies = {
  state: GlobalState<CartState>;
  now?: () => number;
  newId?: () => string;
};

export type AddResult = { status: "added" | "updated"; item: CartItem; count: number };

/**
 * Same product, same line: the supplier and its reference, or the canonical URL
 * when the page shows no reference.
 */
export function dedupeKeyFor(supplierId: string, product: CapturedProduct): string {
  const reference = product.supplierCode ?? product.manufacturerCode ?? product.gtin;
  return reference === null
    ? `${supplierId}|url|${product.productUrl}`
    : `${supplierId}|ref|${reference.toLowerCase()}`;
}

/**
 * The selection. Every write is a read-modify-write through GlobalState.update,
 * which runs under the key's mutex, and bumps `revision`.
 */
export class CartService {
  private readonly now: () => number;
  private readonly newId: () => string;

  constructor(private readonly deps: CartServiceDependencies) {
    this.now = deps.now ?? Date.now;
    this.newId = deps.newId ?? (() => crypto.randomUUID());
  }

  get(): Promise<CartState> {
    return this.deps.state.get();
  }

  subscribe(listener: (cart: CartState) => void): () => void {
    return this.deps.state.subscribe(listener);
  }

  /** Adds a product, or refreshes the price and dates of the same product. */
  async add(
    product: CapturedProduct,
    supplier: SupplierRecord,
    adapterVersion: number | null,
  ): Promise<AddResult> {
    let result: AddResult | undefined;
    await this.deps.state.update((cart) => {
      const now = this.now();
      const live = this.withoutExpired(cart.items, now);
      const key = dedupeKeyFor(supplier.id, product);
      const existing = live.find((item) => item.dedupeKey === key);
      const observed = {
        designation: product.designation,
        supplierCode: product.supplierCode,
        manufacturerCode: product.manufacturerCode,
        gtin: product.gtin,
        brand: product.brand,
        unit: product.unit,
        packagingQuantity: product.packagingQuantity,
        productUrl: product.productUrl,
        priceCents: product.priceCents,
        currency: product.currency,
        priceBasis: product.priceBasis,
        priceBasisSource: product.priceBasisSource,
        ecoContributionCents: product.ecoContributionCents,
        adapterVersion,
        observedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + CART_TTL_MS).toISOString(),
      };
      if (existing !== undefined) {
        const imageChanged = existing.sourceImageUrl !== product.imageUrl;
        const item: CartItem = {
          ...existing,
          ...observed,
          sourceImageUrl: product.imageUrl,
          image: imageChanged ? initialImage(product.imageUrl) : existing.image,
        };
        const items = [item, ...live.filter((entry) => entry.id !== existing.id)];
        result = { status: "updated", item, count: items.length };
        return { ...cart, revision: cart.revision + 1, items };
      }
      if (live.length >= CART_MAX_ITEMS) {
        throw new CommandError(CartErrorCode.CART_FULL, "The selection holds 100 products");
      }
      const item: CartItem = {
        id: this.newId(),
        dedupeKey: key,
        supplierId: supplier.id,
        supplierName: supplier.name,
        ...observed,
        sourceImageUrl: product.imageUrl,
        image: initialImage(product.imageUrl),
      };
      const items = [item, ...live];
      result = { status: "added", item, count: items.length };
      return { ...cart, revision: cart.revision + 1, items };
    });
    if (result === undefined) {
      throw new Error("Cart update did not run");
    }
    return result;
  }

  async remove(ids: readonly string[]): Promise<CartState> {
    const remove = new Set(ids);
    return this.change((items) => items.filter((item) => !remove.has(item.id)));
  }

  /**
   * Removes items imported by the web app, unless one was re-observed since
   * (its `observedAt` changed): that newer price stays in the selection.
   */
  async removeObserved(
    entries: readonly { id: string; observedAt: string }[],
  ): Promise<{ removed: string[]; kept: string[]; cart: CartState }> {
    const wanted = new Map(entries.map((entry) => [entry.id, entry.observedAt]));
    const removed: string[] = [];
    const cart = await this.change((items) =>
      items.filter((item) => {
        const observedAt = wanted.get(item.id);
        if (observedAt !== undefined && observedAt === item.observedAt) {
          removed.push(item.id);
          return false;
        }
        return true;
      }),
    );
    const kept = entries.map((entry) => entry.id).filter((id) => !removed.includes(id));
    return { removed, kept, cart };
  }

  /** Empties the selection; with `expectedRevision`, only if nothing changed meanwhile. */
  async clear(expectedRevision?: number): Promise<CartState> {
    return this.deps.state.update((cart) => {
      if (expectedRevision !== undefined && cart.revision !== expectedRevision) {
        throw new CommandError(CartErrorCode.REVISION_MISMATCH, `Revision is ${cart.revision}`);
      }
      return { ...cart, revision: cart.revision + 1, items: [] };
    });
  }

  /** Drops expired items. Writes only when something expired. */
  async purgeExpired(): Promise<string[]> {
    const now = this.now();
    const cart = await this.deps.state.get();
    if (cart.items.every((item) => Date.parse(item.expiresAt) > now)) {
      return [];
    }
    const expired: string[] = [];
    await this.change((items) =>
      items.filter((item) => {
        const keep = Date.parse(item.expiresAt) > now;
        if (!keep) {
          expired.push(item.id);
        }
        return keep;
      }),
    );
    return expired;
  }

  async setImage(id: string, image: CartImage): Promise<void> {
    await this.deps.state.update((cart) => {
      if (!cart.items.some((item) => item.id === id)) {
        return cart;
      }
      return {
        ...cart,
        revision: cart.revision + 1,
        items: cart.items.map((item) => (item.id === id ? { ...item, image } : item)),
      };
    });
  }

  private withoutExpired(items: readonly CartItem[], now: number): CartItem[] {
    return items.filter((item) => Date.parse(item.expiresAt) > now);
  }

  private change(select: (items: CartItem[]) => CartItem[]): Promise<CartState> {
    return this.deps.state.update((cart) => {
      const items = select(cart.items);
      return items.length === cart.items.length
        ? cart
        : { ...cart, revision: cart.revision + 1, items };
    });
  }
}

function initialImage(url: string | null): CartImage {
  return url === null ? { status: "none" } : { status: "pending", attempts: 0 };
}
