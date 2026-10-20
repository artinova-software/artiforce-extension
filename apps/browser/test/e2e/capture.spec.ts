import { clickButton, buttonHost } from "./button";
import { expect, readBadge, readCart, test } from "./fixtures";
import { APP, SHOP } from "./routes";

test.describe("capture", () => {
  test("adds a product from a supplier page, then updates it", async ({
    context,
    serviceWorker,
  }) => {
    const page = await context.newPage();
    await page.goto(`${SHOP}/produits/perceuse-visseuse-18v`);

    const host = buttonHost(page);
    await expect(host).toHaveAttribute("data-state", "idle");
    // Anchored right after the shop's own add-to-cart button.
    await expect(page.locator("#add-to-cart + *")).toHaveCount(1);
    expect(await host.evaluate((element) => element.shadowRoot)).toBeNull();

    await clickButton(page);
    await expect(host).toHaveAttribute("data-state", "added");
    const cart = await readCart(serviceWorker);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({
      designation: "Perceuse visseuse sans fil 18 V",
      priceCents: 8990,
      priceBasis: "TTC",
    });
    await expect.poll(() => readBadge(serviceWorker)).toBe("1");
    // The service worker downloads and shrinks the image from the declared CDN.
    await expect
      .poll(async () => (await readCart(serviceWorker)).items[0]?.image.status)
      .toBe("ready");

    await page.reload();
    await clickButton(page);
    await expect(buttonHost(page)).toHaveAttribute("data-state", "updated");
    expect((await readCart(serviceWorker)).items).toHaveLength(1);
  });

  test("stays off category pages and non-supplier sites", async ({ context }) => {
    const page = await context.newPage();
    await page.goto(`${SHOP}/outillage`);
    await page.waitForTimeout(800);
    await expect(buttonHost(page)).toHaveCount(0);

    await page.goto(`${APP}/devis`);
    await page.waitForTimeout(500);
    await expect(buttonHost(page)).toHaveCount(0);
  });

  test("follows a single-page navigation to a product", async ({ context, serviceWorker }) => {
    const page = await context.newPage();
    await page.goto(`${SHOP}/spa`);
    await page.waitForTimeout(500);
    await expect(buttonHost(page)).toHaveCount(0);
    await page.evaluate(() => (window as unknown as { openProduct(): void }).openProduct());
    await expect(buttonHost(page)).toHaveCount(1);
    await clickButton(page);
    await expect(buttonHost(page)).toHaveAttribute("data-state", "added");
    expect((await readCart(serviceWorker)).items[0]?.designation).toBe("Niveau laser croix");
  });
});
