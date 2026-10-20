// Manual check (not part of the suite): the whole chain on live supplier pages
// without bot protection: button, extraction, cart, image download.
import { buttonHost, clickButton } from "../button";
import { expect, readCart, test } from "../fixtures";

const PAGES = [
  [
    "castorama",
    "https://www.castorama.fr/ciment-allcem-cem-ii-b-m-32-5r-25-kg/3596700102689_CAFR.prd",
  ],
  [
    "cedeo",
    "https://www.cedeo.fr/p/droguerie-et-fixations/filtre-magnetique-magmax-solutech-1%22-special-pac-chaudieres-debit-6-m%C2%B3-h-ref-125688578-A4988574",
  ],
  ["ikea", "https://www.ikea.com/fr/fr/p/kallax-etagere-blanc-80275887/"],
  [
    "point-p",
    "https://www.pointp.fr/p/gros-oeuvre-bpe-voirie-tp/bloc-beton-creux-classe-b40-500x200x200-mm-A6271676",
  ],
] as const;

for (const [supplier, url] of PAGES) {
  test(`live ${supplier}`, async ({ context, serviceWorker }) => {
    await context.unrouteAll({ behavior: "ignoreErrors" });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await expect(buttonHost(page)).toHaveCount(1, { timeout: 20_000 });
    await clickButton(page);
    await expect(buttonHost(page)).toHaveAttribute("data-state", /added|updated/);
    const item = (await readCart(serviceWorker)).items[0];
    await expect
      .poll(async () => (await readCart(serviceWorker)).items[0]?.image.status, { timeout: 20_000 })
      .toMatch(/ready|failed/);
    const final = (await readCart(serviceWorker)).items[0];
    test.info().annotations.push({
      type: "item",
      description: JSON.stringify({
        designation: item?.designation,
        priceCents: item?.priceCents,
        basis: item?.priceBasis,
        image: final?.image.status,
      }),
    });
    await page.screenshot({ path: `test-results/live-${supplier}.png` });
  });
}
