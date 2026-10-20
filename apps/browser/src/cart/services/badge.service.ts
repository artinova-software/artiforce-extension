import { BrowserApi } from "../../platform/browser/browser-api";
import type { LogService } from "../../platform/logging/log.service";
import type { CartState } from "../models/cart-item";
import type { CartService } from "./cart.service";

/** Keeps the toolbar badge equal to the number of products in the selection. */
export class BadgeService {
  private lastCount = -1;

  constructor(
    private readonly cart: CartService,
    private readonly log: LogService,
  ) {}

  /** Synchronous: subscribes to cart changes. */
  start(): void {
    this.cart.subscribe((cart) => void this.render(cart));
  }

  async refresh(): Promise<void> {
    await this.render(await this.cart.get());
  }

  private async render(cart: CartState): Promise<void> {
    const count = cart.items.length;
    if (count === this.lastCount) {
      return;
    }
    this.lastCount = count;
    try {
      await BrowserApi.setBadge(count);
    } catch (error) {
      this.log.warn("Badge update failed", error);
    }
  }
}
