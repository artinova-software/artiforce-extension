import { getSupplier } from "@artiforce-software/extension-suppliers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommandError } from "../../platform/messaging/command";
import type { sendCommand } from "../../platform/messaging/message-sender";
import { ButtonLifecycle } from "./lifecycle";

const supplier = getSupplier("artiforce-test-shop");
if (supplier === undefined) {
  throw new Error("test supplier missing");
}

const PRODUCT = `
  <script type="application/ld+json">${JSON.stringify({
    "@type": "Product",
    name: "Perceuse visseuse 18 V",
    sku: "PV-18",
    image: "https://img.artiforce.test/perceuse.jpg",
    offers: { price: "89.90", priceCurrency: "EUR" },
  })}</script>
  <h1>Perceuse visseuse 18 V</h1>
  <form><button id="cart">Ajouter au panier</button></form>`;

function setPage(path: string, html: string) {
  window.history.pushState({}, "", path);
  document.body.innerHTML = html;
}

function hostElement(): HTMLElement | null {
  return (
    ([...document.querySelectorAll("*")].find((element) =>
      element.tagName.toLowerCase().startsWith("artiforce-btn-"),
    ) as HTMLElement | undefined) ?? null
  );
}

describe("ButtonLifecycle", () => {
  let send: ReturnType<typeof vi.fn>;
  let lifecycle: ButtonLifecycle;

  beforeEach(() => {
    vi.useFakeTimers();
    send = vi.fn(async () => ({ status: "added", itemId: crypto.randomUUID(), count: 1 }));
    setPage("/produits/perceuse", PRODUCT);
    lifecycle = new ButtonLifecycle(window, supplier, send as unknown as typeof sendCommand);
  });

  afterEach(() => {
    lifecycle.stop();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("mounts after the add-to-cart button in a closed shadow root", () => {
    lifecycle.start();
    const host = hostElement();
    expect(host).not.toBeNull();
    expect(host?.previousElementSibling?.id).toBe("cart");
    expect(host?.shadowRoot).toBeNull();
    expect(host?.style.getPropertyValue("all")).toBe("initial");
    expect(host?.style.getPropertyPriority("all")).toBe("important");
    expect(host?.dataset["state"]).toBe("idle");
  });

  it("extracts on click and reports the result", async () => {
    lifecycle.start();
    await lifecycle.add();
    expect(send).toHaveBeenCalledTimes(1);
    const [, request] = send.mock.calls[0] as [
      unknown,
      { product: { designation: string; priceCents: number } },
    ];
    expect(request.product).toMatchObject({
      designation: "Perceuse visseuse 18 V",
      priceCents: 8990,
    });
    expect(hostElement()?.dataset["state"]).toBe("added");
    vi.advanceTimersByTime(7000);
    expect(hostElement()?.dataset["state"]).toBe("idle");
  });

  it("shows CART_FULL and reload states", async () => {
    lifecycle.start();
    send.mockRejectedValueOnce(new CommandError("CART_FULL"));
    await lifecycle.add();
    expect(hostElement()?.dataset["state"]).toBe("full");
    send.mockRejectedValueOnce(new CommandError("EXTENSION_RELOADED"));
    await lifecycle.add();
    expect(hostElement()?.dataset["state"]).toBe("reload");
  });

  it("stays away from non-product pages and follows SPA navigation", async () => {
    setPage("/categorie/outillage", "<h1>Outillage</h1>");
    lifecycle.start();
    expect(hostElement()).toBeNull();
    setPage("/produits/perceuse", PRODUCT);
    await vi.advanceTimersByTimeAsync(350);
    expect(hostElement()).not.toBeNull();
    setPage("/categorie/outillage", "<h1>Outillage</h1>");
    await vi.advanceTimersByTimeAsync(350);
    expect(hostElement()).toBeNull();
  });

  it("re-injects when the page removes the button, then floats", async () => {
    lifecycle.start();
    for (let index = 0; index < 32; index += 1) {
      hostElement()?.remove();
      await vi.advanceTimersByTimeAsync(350);
    }
    expect(hostElement()?.dataset["floating"]).toBe("");
  });

  it("removes itself when the extension context is gone", async () => {
    lifecycle.start();
    chromeFake.invalidate();
    document.body.append(document.createElement("div"));
    await vi.advanceTimersByTimeAsync(350);
    expect(hostElement()).toBeNull();
  });
});
