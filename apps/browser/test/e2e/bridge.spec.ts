import type { Page } from "@playwright/test";

import type { BridgeClient } from "@artinova-software/extension-bridge";

import { buttonHost, clickButton } from "./button";
import { expect, readCart, test } from "./fixtures";
import { APP, FOREIGN_APP, SHOP } from "./routes";

type AppWindow = Window & {
  artinovaBridge: { client: BridgeClient; events: { event: string; data: unknown }[] };
};

async function call(page: Page, command: string, params: unknown): Promise<unknown> {
  return page.evaluate(
    async ([name, args]) => {
      const { client } = (window as unknown as AppWindow).artinovaBridge;
      try {
        return {
          ok: true,
          result: await client.request(name as "hello", args as Record<string, never>),
        };
      } catch (error) {
        return { ok: false, code: (error as { code: string }).code };
      }
    },
    [command, params] as const,
  );
}

async function events(page: Page) {
  return page.evaluate(() => (window as unknown as AppWindow).artinovaBridge.events);
}

async function postRaw(page: Page, message: unknown) {
  return page.evaluate(
    (data) =>
      new Promise((resolve) => {
        const listener = (event: MessageEvent) => {
          if ((event.data as { direction?: string }).direction === "response") {
            window.removeEventListener("message", listener);
            resolve(event.data);
          }
        };
        window.addEventListener("message", listener);
        window.postMessage(data, window.location.origin);
        setTimeout(() => resolve(null), 1500);
      }),
    message,
  );
}

test.describe("bridge", () => {
  test("serves the selection to the web app end to end", async ({ context, serviceWorker }) => {
    const app = await context.newPage();
    await app.goto(`${APP}/devis/1`);

    const hello = await call(app, "hello", {});
    expect(hello).toMatchObject({ ok: true, result: { protocols: [1], browser: "chrome" } });

    // Capture on a supplier tab: the web app hears cart.changed live.
    const shop = await context.newPage();
    await shop.goto(`${SHOP}/produits/perceuse-visseuse-18v`);
    await clickButton(shop);
    await expect(buttonHost(shop)).toHaveAttribute("data-state", "added");
    await expect
      .poll(
        async () =>
          (await events(app)).filter((entry) => entry.event === "cart.changed").at(-1)?.data,
      )
      .toMatchObject({ count: 1 });

    await expect
      .poll(async () => (await readCart(serviceWorker)).items[0]?.image.status)
      .toBe("ready");
    const cart = await call(app, "getCart", {});
    expect(cart).toMatchObject({
      ok: true,
      result: {
        items: [
          {
            designation: "Perceuse visseuse sans fil 18 V",
            supplier: { id: "artinova-test-shop", name: "Boutique de test" },
            supplierCode: "PV-18",
            gtin: "4006381333931",
            price: { cents: 8990, currency: "EUR", basis: "TTC" },
            image: { status: "ready" },
          },
        ],
      },
    });
    const item = (
      cart as { result: { revision: number; items: { id: string; observedAt: string }[] } }
    ).result.items[0];
    if (item === undefined) {
      throw new Error("no item");
    }

    const images = await call(app, "getImages", { itemIds: [item.id] });
    expect(images).toMatchObject({ ok: true, result: { images: [{ itemId: item.id }] } });
    expect(
      (images as { result: { images: { dataUrl: string }[] } }).result.images[0]?.dataUrl,
    ).toMatch(/^data:image\/jpeg;base64,/);

    // A stale observedAt keeps the item: it was re-observed meanwhile.
    const stale = await call(app, "removeItems", {
      items: [{ id: item.id, observedAt: "2020-01-01T00:00:00.000Z" }],
    });
    expect(stale).toMatchObject({ ok: true, result: { removed: [], kept: [item.id] } });

    const { revision } = await readCart(serviceWorker);
    const mismatch = await call(app, "clearCart", { expectedRevision: revision + 10 });
    expect(mismatch).toEqual({ ok: false, code: "REVISION_MISMATCH" });

    const removed = await call(app, "removeItems", {
      items: [{ id: item.id, observedAt: item.observedAt }],
    });
    expect(removed).toMatchObject({ ok: true, result: { removed: [item.id], kept: [] } });
    await expect
      .poll(
        async () =>
          (await events(app)).filter((entry) => entry.event === "cart.changed").at(-1)?.data,
      )
      .toMatchObject({ count: 0 });
    expect((await readCart(serviceWorker)).items).toHaveLength(0);
  });

  test("rejects malformed requests with a code", async ({ context }) => {
    const app = await context.newPage();
    await app.goto(`${APP}/`);
    const base = { channel: "artinova-bridge", direction: "request", protocol: 1 };
    expect(
      await postRaw(app, { ...base, id: "a1", command: "dropTables", params: {} }),
    ).toMatchObject({
      ok: false,
      error: { code: "UNKNOWN_COMMAND" },
    });
    expect(
      await postRaw(app, { ...base, id: "a2", command: "getImages", params: { itemIds: ["x"] } }),
    ).toMatchObject({
      ok: false,
      error: { code: "INVALID_REQUEST" },
    });
    expect(
      await postRaw(app, { ...base, protocol: 9, id: "a3", command: "hello", params: {} }),
    ).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_PROTOCOL" },
    });
  });

  test("does not answer an origin outside the allow-list", async ({ context }) => {
    const page = await context.newPage();
    await page.goto(`${FOREIGN_APP}/`);
    expect(await call(page, "hello", {})).toEqual({ ok: false, code: "TIMEOUT" });
    expect(await call(page, "getCart", {})).toEqual({ ok: false, code: "TIMEOUT" });
  });
});
