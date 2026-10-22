import {
  isAllowedImageHost,
  type SupplierRecord,
} from "@artiforce-software/extension-suppliers/registry";

import type { CartItem } from "../../cart/models/cart-item";
import type { CartService } from "../../cart/services/cart.service";
import { BrowserApi } from "../../platform/browser/browser-api";
import type { LogService } from "../../platform/logging/log.service";
import type { GlobalStateProvider } from "../../platform/state/global-state";
import { IMAGE_KEY_PREFIX, imageKey, type StoredImage } from "../image.state";
import type { ImageCodec } from "./image-codec";
import { type FetchLike, fetchImage, ImageError, ImageFailure } from "./image-fetcher";

export const MAX_IMAGE_ATTEMPTS = 3;
const CONCURRENCY = 2;

export type ImageServiceDependencies = {
  cart: CartService;
  stateProvider: GlobalStateProvider;
  codec: ImageCodec;
  log: LogService;
  supplierFor(id: string): SupplierRecord | undefined;
  fetch?: FetchLike;
};

/**
 * Downloads, shrinks and stores product images in the background. A failure
 * never blocks: the item is marked `failed` and imports without a photo.
 */
export class ImageService {
  private readonly queue: string[] = [];
  private readonly inFlight = new Set<string>();
  private running = 0;
  private idleWaiters: (() => void)[] = [];

  constructor(private readonly deps: ImageServiceDependencies) {}

  enqueue(item: Pick<CartItem, "id">): void {
    if (this.inFlight.has(item.id) || this.queue.includes(item.id)) {
      return;
    }
    this.queue.push(item.id);
    this.pump();
  }

  /** Bootstrap: items left `pending` by a stopped service worker. */
  async resumePending(): Promise<void> {
    const cart = await this.deps.cart.get();
    cart.items
      .filter((item) => item.image.status === "pending")
      .forEach((item) => this.enqueue(item));
  }

  /** Resolves when the queue is empty (tests, diagnostics). */
  idle(): Promise<void> {
    if (this.running === 0 && this.queue.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  async get(itemId: string): Promise<StoredImage> {
    return this.deps.stateProvider.get(imageKey(itemId)).get();
  }

  async remove(itemIds: readonly string[]): Promise<void> {
    await Promise.all(itemIds.map((id) => this.deps.stateProvider.get(imageKey(id)).remove()));
  }

  /** Deletes stored images whose cart item is gone. */
  async removeOrphans(): Promise<void> {
    const cart = await this.deps.cart.get();
    const live = new Set(cart.items.map((item) => item.id));
    const keys = (await BrowserApi.storageArea("local").keys()).filter((key) =>
      key.startsWith(IMAGE_KEY_PREFIX),
    );
    const orphans = keys
      .map((key) => key.slice(IMAGE_KEY_PREFIX.length))
      .filter((id) => !live.has(id));
    await this.remove(orphans);
  }

  private pump(): void {
    while (this.running < CONCURRENCY && this.queue.length > 0) {
      const id = this.queue.shift();
      if (id === undefined) {
        break;
      }
      this.running += 1;
      this.inFlight.add(id);
      void this.process(id).finally(() => {
        this.running -= 1;
        this.inFlight.delete(id);
        this.pump();
        if (this.running === 0 && this.queue.length === 0) {
          this.idleWaiters.splice(0).forEach((resolve) => resolve());
        }
      });
    }
  }

  private async process(id: string): Promise<void> {
    const item = (await this.deps.cart.get()).items.find((entry) => entry.id === id);
    if (item === undefined || item.image.status !== "pending" || item.sourceImageUrl === null) {
      return;
    }
    const attempts = item.image.attempts + 1;
    await this.deps.cart.setImage(id, { status: "pending", attempts });
    try {
      const url = this.checkUrl(item);
      const blob = await fetchImage(url, this.deps.fetch);
      let encoded;
      try {
        encoded = await this.deps.codec.encode(blob);
      } catch {
        throw new ImageError(ImageFailure.DECODE);
      }
      // The item may have changed (new image URL) or gone while downloading.
      const current = (await this.deps.cart.get()).items.find((entry) => entry.id === id);
      if (current === undefined || current.sourceImageUrl !== item.sourceImageUrl) {
        return;
      }
      await this.deps.stateProvider.get(imageKey(id)).update(() => encoded.full);
      await this.deps.cart.setImage(id, {
        status: "ready",
        width: encoded.full.width,
        height: encoded.full.height,
        bytes: encoded.full.bytes,
        thumbnailDataUrl: encoded.thumbnail.dataUrl,
      });
    } catch (error) {
      const reason = error instanceof ImageError ? error.reason : ImageFailure.NETWORK;
      const retryable = reason === ImageFailure.TIMEOUT || reason === ImageFailure.NETWORK;
      this.deps.log.warn(`Image ${id} failed (${reason}, attempt ${attempts})`);
      if (retryable && attempts < MAX_IMAGE_ATTEMPTS) {
        // Retried on the next bootstrap or capture; the item stays `pending`.
        return;
      }
      await this.deps.cart.setImage(id, { status: "failed", reason });
    }
  }

  /** https only, on a host the supplier declares (site or imageHosts). */
  private checkUrl(item: CartItem): string {
    let url: URL;
    try {
      url = new URL(item.sourceImageUrl ?? "");
    } catch {
      throw new ImageError(ImageFailure.BAD_URL);
    }
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "") {
      throw new ImageError(ImageFailure.BAD_URL);
    }
    const supplier = this.deps.supplierFor(item.supplierId);
    if (supplier === undefined || !isAllowedImageHost(supplier, url.hostname)) {
      throw new ImageError(ImageFailure.HOST_NOT_ALLOWED);
    }
    return url.href;
  }
}
