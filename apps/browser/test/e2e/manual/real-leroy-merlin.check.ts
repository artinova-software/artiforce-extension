// Manual check (not part of the suite): the button on a real Leroy Merlin page.
// Leroy Merlin uses DataDome, which may refuse an automated browser: the check
// then reports the block instead of failing on the extension.
import { buttonHost, clickButton } from "../button";
import { expect, readBadge, readCart, test } from "../fixtures";

test("adds a real Leroy Merlin product", async ({ context, serviceWorker }) => {
  await context.unrouteAll({ behavior: "ignoreErrors" });
  const page = await context.newPage();
  const response = await page.goto(
    "https://www.leroymerlin.fr/produits/sac-a-gravats-ocai-70-l-66471860.html",
  );
  const title = await page.title();
  test.info().annotations.push({ type: "page", description: `${response?.status()} ${title}` });
  test.skip(
    response?.status() === 403 || /leroymerlin\.fr$/i.test(title),
    `Blocked by bot protection: ${title}`,
  );
  await expect(buttonHost(page)).toHaveCount(1, { timeout: 15_000 });
  await clickButton(page);
  await expect(buttonHost(page)).toHaveAttribute("data-state", "added");
  await expect.poll(() => readBadge(serviceWorker)).toBe("1");
  const item = (await readCart(serviceWorker)).items[0];
  test.info().annotations.push({ type: "item", description: JSON.stringify(item) });
  expect(item).toMatchObject({ priceBasis: "TTC" });
  await expect
    .poll(async () => (await readCart(serviceWorker)).items[0]?.image.status, { timeout: 20_000 })
    .toBe("ready");
  await page.screenshot({ path: "test-results/real-leroy-merlin.png" });
});
