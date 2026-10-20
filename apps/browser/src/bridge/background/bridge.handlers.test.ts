import { getSupplier } from "@artinova-software/extension-suppliers/registry";
import { describe, expect, it, vi } from "vitest";

import { product } from "../../../test/fixtures";
import { CART_KEY } from "../../cart/cart.state";
import { CartService } from "../../cart/services/cart.service";
import type { ImageService } from "../../images/services/image.service";
import type { LogService } from "../../platform/logging/log.service";
import { CHANNEL, SenderKind } from "../../platform/messaging/command";
import { MessageRouter } from "../../platform/messaging/message-router";
import { GlobalStateProvider } from "../../platform/state/global-state";
import { registerBridgeHandlers } from "./bridge.handlers";

const log: LogService = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function setup(kind: SenderKind) {
  const cart = new CartService({
    state: new GlobalStateProvider({ log, canWrite: true }).get(CART_KEY),
  });
  const images = {
    get: vi.fn(async () => ({
      dataUrl: "data:image/jpeg;base64,AA==",
      width: 10,
      height: 10,
      bytes: 1,
    })),
  } as unknown as ImageService;
  const router = new MessageRouter({ classify: () => kind, ready: Promise.resolve(), log });
  registerBridgeHandlers(router, { cart, images, version: "0.1.0", browser: "chrome" });
  const call = (command: string, payload: unknown) =>
    router.handle({ channel: CHANNEL, command, payload }, {});
  return { cart, call, images };
}

describe("bridge handlers", () => {
  it("answer only the bridge content script", async () => {
    const { call } = setup(SenderKind.SUPPLIER_CONTENT);
    expect(await call("bridge/getCart", {})).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    const popup = setup(SenderKind.EXTENSION_PAGE);
    expect(await popup.call("bridge/clearCart", { expectedRevision: 0 })).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });

  it("say hello, list the cart and return images of known items only", async () => {
    const { call, cart, images } = setup(SenderKind.BRIDGE_CONTENT);
    expect(await call("bridge/hello", {})).toMatchObject({
      ok: true,
      result: { protocols: [1], extensionVersion: "0.1.0" },
    });
    const supplier = getSupplier("leroy-merlin");
    if (supplier === undefined) {
      throw new Error("missing supplier");
    }
    const { item } = await cart.add(product(), supplier, 1);
    expect(await call("bridge/getCart", {})).toMatchObject({
      ok: true,
      result: { revision: 1, items: [{ id: item.id }] },
    });
    const unknown = crypto.randomUUID();
    const response = await call("bridge/getImages", { itemIds: [item.id, unknown] });
    expect(response).toMatchObject({
      ok: true,
      result: {
        images: [
          { itemId: item.id, width: 10 },
          { itemId: unknown, dataUrl: null },
        ],
      },
    });
    expect(images.get).toHaveBeenCalledTimes(1);
  });

  it("revalidate the request with the bridge schemas", async () => {
    const { call } = setup(SenderKind.BRIDGE_CONTENT);
    expect(
      await call("bridge/getImages", {
        itemIds: Array.from({ length: 11 }, () => crypto.randomUUID()),
      }),
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_REQUEST" },
    });
  });

  it("clear with the expected revision", async () => {
    const { call } = setup(SenderKind.BRIDGE_CONTENT);
    expect(await call("bridge/clearCart", { expectedRevision: 3 })).toMatchObject({
      ok: false,
      error: { code: "REVISION_MISMATCH" },
    });
    expect(await call("bridge/clearCart", { expectedRevision: 0 })).toMatchObject({
      ok: true,
      result: { revision: 1 },
    });
  });
});
