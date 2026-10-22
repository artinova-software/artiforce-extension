import {
  createProductPage,
  extractProduct,
  findAnchor,
  isProductPage,
  type SupplierRecord,
} from "@artiforce-software/extension-suppliers";

import { cartAdd } from "../../cart/cart.commands";
import { BrowserApi } from "../../platform/browser/browser-api";
import { t } from "../../platform/i18n/t";
import { CommandError, MessagingErrorCode } from "../../platform/messaging/command";
import { sendCommand } from "../../platform/messaging/message-sender";
import { ButtonState, type ButtonView, renderButton } from "./button-ui";
import { mountHost, type MountedHost } from "./mount";
import { SpaWatcher } from "./spa-watcher";

/** Above this many re-injections per minute the page fights us: float instead. */
export const MAX_REINJECTIONS_PER_MINUTE = 30;
const RESET_STATUS_MS = 6000;

/**
 * Owns the button on one supplier tab: mounts it on product pages, follows
 * SPA navigations, extracts the product on click and sends it to the
 * background, and removes itself when the extension context goes away.
 */
export class ButtonLifecycle {
  private mounted: MountedHost | undefined;
  private view: ButtonView | undefined;
  private readonly watcher: SpaWatcher;
  private reinjections: number[] = [];
  private forceFloating = false;
  private stopped = false;
  private resetTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly window: Window,
    private readonly supplier: SupplierRecord,
    private readonly send: typeof sendCommand = sendCommand,
  ) {
    this.watcher = new SpaWatcher(window, { onChange: (urlChanged) => this.refresh(urlChanged) });
  }

  start(): void {
    this.refresh(false);
    this.watcher.start();
  }

  stop(): void {
    this.stopped = true;
    this.watcher.stop();
    this.unmount();
  }

  /** Mounted host, for tests. */
  get host(): HTMLElement | undefined {
    return this.mounted?.host;
  }

  private page() {
    return createProductPage(this.window.document, this.supplier);
  }

  private refresh(urlChanged: boolean): void {
    if (this.stopped) {
      return;
    }
    if (!BrowserApi.contextValid()) {
      this.stop();
      return;
    }
    const onProductPage = isProductPage(this.page());
    if (!onProductPage) {
      this.unmount();
      return;
    }
    const detached = this.mounted !== undefined && !this.mounted.host.isConnected;
    if (this.mounted !== undefined && !urlChanged && !detached) {
      return;
    }
    if (detached) {
      this.countReinjection();
    }
    this.unmount();
    this.mount();
  }

  private countReinjection(): void {
    const now = Date.now();
    this.reinjections = [...this.reinjections.filter((time) => now - time < 60_000), now];
    if (this.reinjections.length > MAX_REINJECTIONS_PER_MINUTE) {
      this.forceFloating = true;
    }
  }

  private mount(): void {
    const anchor = this.forceFloating ? null : findAnchor(this.page());
    this.mounted = mountHost(this.window.document, anchor);
    this.view = renderButton(
      this.mounted.shadow,
      (key) => t(key),
      () => void this.add(),
    );
  }

  private unmount(): void {
    if (this.resetTimer !== undefined) {
      clearTimeout(this.resetTimer);
    }
    this.mounted?.remove();
    this.mounted = undefined;
    this.view = undefined;
  }

  /** Extraction happens here, on click: the page is fully rendered by then. */
  async add(): Promise<void> {
    const view = this.view;
    if (view === undefined) {
      return;
    }
    if (!BrowserApi.contextValid()) {
      view.setState(ButtonState.RELOAD);
      return;
    }
    view.setState(ButtonState.ADDING);
    const extraction = extractProduct(this.page());
    if (!extraction.ok) {
      view.setState(ButtonState.FAILED);
      return;
    }
    try {
      const result = await this.send(cartAdd, {
        product: extraction.product,
        adapterVersion: extraction.adapterVersion,
      });
      view.setState(result.status === "updated" ? ButtonState.UPDATED : ButtonState.ADDED);
    } catch (error) {
      const code = error instanceof CommandError ? error.code : "";
      view.setState(
        code === "CART_FULL"
          ? ButtonState.FULL
          : code === MessagingErrorCode.EXTENSION_RELOADED
            ? ButtonState.RELOAD
            : ButtonState.FAILED,
      );
      if (code === MessagingErrorCode.EXTENSION_RELOADED) {
        this.watcher.stop();
        return;
      }
    }
    this.resetTimer = setTimeout(() => this.view?.setState(ButtonState.IDLE), RESET_STATUS_MS);
  }
}
