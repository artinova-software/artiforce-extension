import type { SupplierRecord } from "@artinova-software/extension-suppliers/registry";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LogService } from "../../platform/logging/log.service";
import { GlobalStateProvider } from "../../platform/state/global-state";
import { CART_KEY } from "../cart.state";
import { CART_TTL_MS } from "../models/cart-item";
import { product } from "../../../test/fixtures";
import { CartService, dedupeKeyFor } from "./cart.service";

const log: LogService = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const supplier: SupplierRecord = {
  id: "leroy-merlin",
  name: "Leroy Merlin",
  country: "FR",
  segment: "retail",
  sites: [{ host: "www.leroymerlin.fr" }],
  imageHosts: ["media.adeo.com"],
  defaultPriceBasis: "TTC",
  support: "verified",
};

describe("CartService", () => {
  let now: number;
  let counter: number;
  let service: CartService;

  beforeEach(() => {
    now = Date.parse("2026-10-12T10:00:00.000Z");
    counter = 0;
    service = new CartService({
      state: new GlobalStateProvider({ log, canWrite: true }).get(CART_KEY),
      now: () => now,
      newId: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`,
    });
  });

  it("adds an item with a 7-day expiry and bumps the revision", async () => {
    const result = await service.add(product(), supplier, 1);
    expect(result.status).toBe("added");
    expect(result.item).toMatchObject({
      supplierId: "leroy-merlin",
      supplierName: "Leroy Merlin",
      priceCents: 399,
      observedAt: "2026-10-12T10:00:00.000Z",
      expiresAt: new Date(now + CART_TTL_MS).toISOString(),
      image: { status: "pending", attempts: 0 },
    });
    expect((await service.get()).revision).toBe(1);
  });

  it("deduplicates by supplier reference and refreshes price and dates", async () => {
    const first = await service.add(product(), supplier, 1);
    now += 60_000;
    const second = await service.add(
      product({
        priceCents: 449,
        productUrl: "https://www.leroymerlin.fr/produits/sac-1.html?x=1",
      }),
      supplier,
      1,
    );
    expect(second.status).toBe("updated");
    expect(second.item.id).toBe(first.item.id);
    expect(second.item.priceCents).toBe(449);
    expect(second.item.observedAt).toBe(new Date(now).toISOString());
    expect(second.item.image).toEqual(first.item.image);
    expect((await service.get()).items).toHaveLength(1);
  });

  it("falls back to the canonical URL when there is no reference", () => {
    expect(dedupeKeyFor("x", product({ supplierCode: null }))).toBe(
      "x|url|https://www.leroymerlin.fr/produits/sac-1.html",
    );
    expect(dedupeKeyFor("x", product({ supplierCode: "AbC" }))).toBe("x|ref|abc");
  });

  it("refuses the 101st product with CART_FULL", async () => {
    for (let index = 0; index < 100; index += 1) {
      await service.add(product({ supplierCode: `REF-${index}` }), supplier, 1);
    }
    await expect(
      service.add(product({ supplierCode: "REF-100" }), supplier, 1),
    ).rejects.toMatchObject({
      code: "CART_FULL",
    });
    // Updating an existing product still works when full.
    await expect(
      service.add(product({ supplierCode: "REF-5" }), supplier, 1),
    ).resolves.toMatchObject({
      status: "updated",
    });
  });

  it("purges expired items, and expired items do not count towards the maximum", async () => {
    await service.add(product({ supplierCode: "OLD" }), supplier, 1);
    now += CART_TTL_MS + 1;
    await service.add(product({ supplierCode: "NEW" }), supplier, 1);
    expect((await service.get()).items.map((item) => item.supplierCode)).toEqual(["NEW"]);
    now += CART_TTL_MS + 1;
    expect(await service.purgeExpired()).toHaveLength(1);
    expect((await service.get()).items).toEqual([]);
    expect(await service.purgeExpired()).toEqual([]);
  });

  it("keeps concurrent adds consistent", async () => {
    await Promise.all(
      Array.from({ length: 30 }, (_value, index) =>
        service.add(product({ supplierCode: `C-${index % 10}` }), supplier, 1),
      ),
    );
    const cart = await service.get();
    expect(cart.items).toHaveLength(10);
    expect(cart.revision).toBe(30);
  });

  it("removes only items whose observedAt still matches", async () => {
    const a = (await service.add(product({ supplierCode: "A" }), supplier, 1)).item;
    const b = (await service.add(product({ supplierCode: "B" }), supplier, 1)).item;
    now += 1000;
    await service.add(product({ supplierCode: "B", priceCents: 1 }), supplier, 1);
    const result = await service.removeObserved([
      { id: a.id, observedAt: a.observedAt },
      { id: b.id, observedAt: b.observedAt },
    ]);
    expect(result.removed).toEqual([a.id]);
    expect(result.kept).toEqual([b.id]);
    expect(result.cart.items.map((item) => item.id)).toEqual([b.id]);
  });

  it("clears with an optimistic revision check", async () => {
    await service.add(product(), supplier, 1);
    const { revision } = await service.get();
    await expect(service.clear(revision + 5)).rejects.toMatchObject({ code: "REVISION_MISMATCH" });
    expect((await service.clear(revision)).items).toEqual([]);
  });

  it("re-downloads the image when the image URL changes", async () => {
    const first = await service.add(product(), supplier, 1);
    await service.setImage(first.item.id, { status: "failed", reason: "HTTP_404" });
    const second = await service.add(
      product({ imageUrl: "https://media.adeo.com/media/2/media.jpg" }),
      supplier,
      1,
    );
    expect(second.item.image).toEqual({ status: "pending", attempts: 0 });
  });
});
