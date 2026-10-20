import { BrowserApi } from "../../platform/browser/browser-api";
import type { LogService } from "../../platform/logging/log.service";
import type { CartService } from "../services/cart.service";

export const CART_PURGE_ALARM = "cart-purge";
export const CART_PURGE_PERIOD_MINUTES = 60;

/** Synchronous listener registration; the alarm itself is (re)created in bootstrap. */
export function listenCartPurgeAlarm(
  cart: CartService,
  log: LogService,
  ready: Promise<void>,
): void {
  BrowserApi.alarms.addListener((name) => {
    if (name !== CART_PURGE_ALARM) {
      return;
    }
    void ready
      .then(() => cart.purgeExpired())
      .then((expired) => {
        if (expired.length > 0) {
          log.info(`Purged ${expired.length} expired item(s)`);
        }
      })
      .catch((error: unknown) => log.error("Cart purge failed", error));
  });
}

export function ensureCartPurgeAlarm(): Promise<void> {
  return BrowserApi.alarms.ensure(CART_PURGE_ALARM, CART_PURGE_PERIOD_MINUTES);
}
