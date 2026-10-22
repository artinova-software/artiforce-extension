import { getSupplier } from "@artiforce-software/extension-suppliers/registry";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { product } from "../../../test/fixtures";
import { CART_KEY } from "../../cart/cart.state";
import { CartService } from "../../cart/services/cart.service";
import type { LogService } from "../../platform/logging/log.service";
import { GlobalStateProvider } from "../../platform/state/global-state";
import { fitWithin, type ImageCodec } from "./image-codec";
import type { FetchLike } from "./image-fetcher";
import { ImageService } from "./image.service";

const log: LogService = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

const fakeCodec: ImageCodec = {
  encode: vi.fn(async () => ({
    full: { dataUrl: "data:image/jpeg;base64,RlVMTA==", width: 800, height: 600, bytes: 4 },
    thumbnail: { dataUrl: "data:image/jpeg;base64,VEhVTUI=", width: 128, height: 96, bytes: 5 },
  })),
};

function respond(body: BodyInit, init: ResponseInit & { type?: string } = {}) {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { "content-type": init.type ?? "image/jpeg" },
  });
}

describe("ImageService", () => {
  let cart: CartService;
  let provider: GlobalStateProvider;
  let fetchMock: Mock<FetchLike>;
  let images: ImageService;
  const supplier = getSupplier("leroy-merlin");

  beforeEach(() => {
    provider = new GlobalStateProvider({ log, canWrite: true });
    cart = new CartService({ state: provider.get(CART_KEY) });
    fetchMock = vi.fn<FetchLike>(async () => respond(JPEG));
    images = new ImageService({
      cart,
      stateProvider: provider,
      codec: fakeCodec,
      log,
      supplierFor: getSupplier,
      fetch: fetchMock,
    });
  });

  async function addAndProcess(imageUrl: string | null) {
    if (supplier === undefined) {
      throw new Error("missing supplier");
    }
    const { item } = await cart.add(product({ imageUrl }), supplier, 1);
    images.enqueue(item);
    await images.idle();
    return (await cart.get()).items.find((entry) => entry.id === item.id);
  }

  it("downloads without cookies, stores the JPEG and the thumbnail", async () => {
    const item = await addAndProcess("https://media.adeo.com/media/1/media.jpg");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://media.adeo.com/media/1/media.jpg",
      expect.objectContaining({ credentials: "omit" }),
    );
    expect(item?.image).toMatchObject({
      status: "ready",
      width: 800,
      thumbnailDataUrl: "data:image/jpeg;base64,VEhVTUI=",
    });
    expect(await chrome.storage.local.get(`global_image_${item?.id}`)).toMatchObject({
      [`global_image_${item?.id}`]: { dataUrl: "data:image/jpeg;base64,RlVMTA==" },
    });
  });

  it("refuses hosts the supplier does not declare", async () => {
    const item = await addAndProcess("https://evil.example/a.jpg");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(item?.image).toEqual({ status: "failed", reason: "HOST_NOT_ALLOWED" });
  });

  it.each([
    ["an SVG", () => respond("<svg/>", { type: "image/svg+xml" }), "SVG"],
    ["HTML", () => respond("<html>", { type: "text/html" }), "NOT_AN_IMAGE"],
    ["fake bytes", () => respond("<html>", { type: "image/jpeg" }), "NOT_AN_IMAGE"],
    ["a 404", () => respond("", { status: 404 }), "HTTP_ERROR"],
  ])("fails on %s", async (_name, response, reason) => {
    fetchMock.mockImplementation(async () => response());
    const item = await addAndProcess("https://media.adeo.com/media/2/media.jpg");
    expect(item?.image).toEqual({ status: "failed", reason });
  });

  it("retries network errors up to three times", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    let item = await addAndProcess("https://media.adeo.com/media/3/media.jpg");
    expect(item?.image).toEqual({ status: "pending", attempts: 1 });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await images.resumePending();
      await images.idle();
    }
    item = (await cart.get()).items[0];
    expect(item?.image).toEqual({ status: "failed", reason: "NETWORK" });
  });

  it("skips items without an image and removes orphans", async () => {
    const item = await addAndProcess(null);
    expect(item?.image).toEqual({ status: "none" });
    await chrome.storage.local.set({
      "global_image_00000000-0000-4000-8000-000000000000": { dataUrl: "x" },
    });
    await images.removeOrphans();
    expect(await chrome.storage.local.get(null)).not.toHaveProperty(
      "global_image_00000000-0000-4000-8000-000000000000",
    );
  });
});

describe("fitWithin", () => {
  it("scales down to the longest side, never up", () => {
    expect(fitWithin(4000, 3000, 1024)).toEqual({ width: 1024, height: 768 });
    expect(fitWithin(300, 200, 1024)).toEqual({ width: 300, height: 200 });
  });
});
