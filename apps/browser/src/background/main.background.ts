import { findSupplierForUrl, getSupplier } from "@artinova-software/extension-suppliers/registry";

import { type AppConfig, loadAppConfig } from "../platform/config/app-config";
import { BrowserApi } from "../platform/browser/browser-api";
import { ConsoleLogService } from "../platform/logging/console-log.service";
import type { LogService } from "../platform/logging/log.service";
import { MessageRouter } from "../platform/messaging/message-router";
import { classifySender, originOf } from "../platform/messaging/sender";
import { GlobalStateProvider } from "../platform/state/global-state";
import { ensureCartPurgeAlarm, listenCartPurgeAlarm } from "../cart/background/cart-purge.alarm";
import { registerCartHandlers } from "../cart/background/cart.handlers";
import { CART_KEY } from "../cart/cart.state";
import { BadgeService } from "../cart/services/badge.service";
import { CartService } from "../cart/services/cart.service";
import { OffscreenImageCodec } from "../images/services/image-codec";
import { ImageService } from "../images/services/image.service";
import { registerBridgeHandlers } from "../bridge/background/bridge.handlers";

/**
 * Builds every background service by hand, in dependency order (Bitwarden's
 * MainBackground pattern), and owns the startup sequence. The constructor is
 * synchronous; `listen()` registers the browser listeners at the top level of
 * the service worker; `bootstrap()` does the async startup work and resolves
 * `ready`, which every message handler awaits.
 */
export class MainBackground {
  readonly log: LogService;
  readonly config: AppConfig;
  readonly stateProvider: GlobalStateProvider;
  readonly cart: CartService;
  readonly badge: BadgeService;
  readonly images: ImageService;
  readonly router: MessageRouter;
  readonly ready: Promise<void>;
  private resolveReady!: () => void;

  constructor() {
    this.log = new ConsoleLogService(__DEV__);
    this.config = loadAppConfig();
    this.stateProvider = new GlobalStateProvider({ log: this.log, canWrite: true });
    this.ready = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
    this.cart = new CartService({ state: this.stateProvider.get(CART_KEY) });
    this.images = new ImageService({
      cart: this.cart,
      stateProvider: this.stateProvider,
      codec: new OffscreenImageCodec(),
      log: this.log,
      supplierFor: getSupplier,
    });
    this.badge = new BadgeService(this.cart, this.log);
    const extensionOrigin = originOf(BrowserApi.getUrl("/")) ?? "";
    const includeTestOnly = __TARGET__ === "e2e";
    const supplierFor = (url: string) => findSupplierForUrl(url, { includeTestOnly });
    this.router = new MessageRouter({
      ready: this.ready,
      log: this.log,
      classify: (sender) =>
        classifySender(sender, {
          extensionId: BrowserApi.getExtensionId(),
          extensionOrigin,
          artinovaOrigins: this.config.artinovaOrigins,
          isSupplierUrl: (url) => supplierFor(url) !== undefined,
        }),
    });
    registerCartHandlers(this.router, {
      cart: this.cart,
      supplierFor,
      onImagePending: (item) => this.images.enqueue(item),
    });
    registerBridgeHandlers(this.router, {
      cart: this.cart,
      images: this.images,
      version: __VERSION__,
      browser: __BROWSER__,
    });
  }

  /** Synchronous: MV3 only delivers events to listeners added in the first turn. */
  listen(): void {
    BrowserApi.addMessageListener(this.router.listener);
    listenCartPurgeAlarm(this.cart, this.log, this.ready);
    this.badge.start();
    this.dropImagesOfRemovedItems();
  }

  /** Removed, cleared, purged or imported items take their stored image with them. */
  private dropImagesOfRemovedItems(): void {
    let previous: Set<string> | undefined;
    this.cart.subscribe((cart) => {
      const next = new Set(cart.items.map((item) => item.id));
      const removed = previous === undefined ? [] : [...previous].filter((id) => !next.has(id));
      previous = next;
      if (removed.length > 0) {
        void this.images
          .remove(removed)
          .catch((error: unknown) => this.log.warn("Image cleanup failed", error));
      }
    });
    void this.cart.get().then((cart) => {
      previous ??= new Set(cart.items.map((item) => item.id));
    });
  }

  async bootstrap(): Promise<void> {
    try {
      await this.cart.purgeExpired();
      await this.badge.refresh();
      await ensureCartPurgeAlarm();
      await this.images.removeOrphans();
      await this.images.resumePending();
      this.log.debug("Background ready");
    } catch (error) {
      this.log.error("Bootstrap failed", error);
    } finally {
      this.resolveReady();
    }
  }
}
