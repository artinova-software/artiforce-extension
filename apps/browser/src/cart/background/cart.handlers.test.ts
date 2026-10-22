import { findSupplierForUrl } from "@artiforce-software/extension-suppliers/registry";
import { describe, expect, it, vi } from "vitest";

import type { LogService } from "../../platform/logging/log.service";
import { CHANNEL } from "../../platform/messaging/command";
import { MessageRouter } from "../../platform/messaging/message-router";
import { classifySender } from "../../platform/messaging/sender";
import { GlobalStateProvider } from "../../platform/state/global-state";
import { CART_KEY } from "../cart.state";
import { BadgeService } from "../services/badge.service";
import { CartService } from "../services/cart.service";
import { product } from "../../../test/fixtures";
import { listenCartPurgeAlarm } from "./cart-purge.alarm";
import { registerCartHandlers } from "./cart.handlers";

const log: LogService = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function setup() {
  const cart = new CartService({
    state: new GlobalStateProvider({ log, canWrite: true }).get(CART_KEY),
  });
  const onImagePending = vi.fn();
  const router = new MessageRouter({
    ready: Promise.resolve(),
    log,
    classify: (sender) =>
      classifySender(sender, {
        extensionId: chromeFake.id,
        extensionOrigin: `chrome-extension://${chromeFake.id}`,
        artiforceOrigins: ["https://app.artiforce.test"],
        isSupplierUrl: (url) => findSupplierForUrl(url) !== undefined,
      }),
  });
  registerCartHandlers(router, {
    cart,
    supplierFor: (url) => findSupplierForUrl(url),
    onImagePending,
  });
  return { cart, router, onImagePending };
}

const supplierSender = {
  id: "abcdefghijklmnopabcdefghijklmnop",
  tab: { id: 1 } as chrome.tabs.Tab,
  frameId: 0,
  url: "https://www.leroymerlin.fr/produits/sac-1.html",
};
const popupSender = {
  id: "abcdefghijklmnopabcdefghijklmnop",
  url: "chrome-extension://abcdefghijklmnopabcdefghijklmnop/popup/index.html",
};

describe("cart handlers", () => {
  it("adds from a supplier page and queues the image", async () => {
    const { router, onImagePending, cart } = setup();
    const response = await router.handle(
      { channel: CHANNEL, command: "cart/add", payload: { product: product(), adapterVersion: 1 } },
      supplierSender,
    );
    expect(response).toMatchObject({ ok: true, result: { status: "added", count: 1 } });
    expect(onImagePending).toHaveBeenCalledTimes(1);
    expect((await cart.get()).items[0]?.supplierId).toBe("leroy-merlin");
  });

  it("refuses cart/add from the popup and cart/clear from a supplier page", async () => {
    const { router } = setup();
    expect(
      await router.handle(
        {
          channel: CHANNEL,
          command: "cart/add",
          payload: { product: product(), adapterVersion: 1 },
        },
        popupSender,
      ),
    ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(
      await router.handle({ channel: CHANNEL, command: "cart/clear", payload: {} }, supplierSender),
    ).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });

  it("removes and clears from the popup", async () => {
    const { router, cart } = setup();
    await router.handle(
      { channel: CHANNEL, command: "cart/add", payload: { product: product(), adapterVersion: 1 } },
      supplierSender,
    );
    const id = (await cart.get()).items[0]?.id;
    expect(
      await router.handle(
        { channel: CHANNEL, command: "cart/remove", payload: { ids: [id] } },
        popupSender,
      ),
    ).toMatchObject({ ok: true, result: { count: 0 } });
    expect(
      await router.handle({ channel: CHANNEL, command: "cart/clear", payload: {} }, popupSender),
    ).toMatchObject({
      ok: true,
    });
  });

  it("keeps the badge in sync and purges on the alarm", async () => {
    const { router, cart } = setup();
    const badge = new BadgeService(cart, log);
    badge.start();
    listenCartPurgeAlarm(cart, log, Promise.resolve());
    await router.handle(
      { channel: CHANNEL, command: "cart/add", payload: { product: product(), adapterVersion: 1 } },
      supplierSender,
    );
    await vi.waitFor(() => expect(chromeFake.badge.text).toBe("1"));
    const purge = vi.spyOn(cart, "purgeExpired");
    chromeFake.fireAlarm("cart-purge");
    await vi.waitFor(() => expect(purge).toHaveBeenCalled());
  });
});
