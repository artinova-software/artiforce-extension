import { clickButton, buttonHost } from "./button";
import { expect, readCart, test } from "./fixtures";
import { SHOP } from "./routes";

test.describe("popup", () => {
  test("lists, removes and clears the selection", async ({
    context,
    extensionId,
    serviceWorker,
  }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await expect(popup.getByRole("heading", { name: "Votre sélection est vide" })).toBeVisible();

    const shop = await context.newPage();
    await shop.goto(`${SHOP}/produits/perceuse-visseuse-18v`);
    await clickButton(shop);
    await expect(buttonHost(shop)).toHaveAttribute("data-state", "added");

    // Live update through storage.onChanged, no reload needed.
    const row = popup.getByTestId("cart-item");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Perceuse visseuse sans fil 18 V");
    await expect(row).toContainText("Boutique de test");
    await expect(row).toContainText("Réf. fournisseur : PV-18");
    await expect(row).toContainText(/89,90\s€ TTC/);
    await expect(row).toContainText(/Prix relevé le \d{2}\/\d{2}\/\d{4}/);
    await expect(row).toContainText("Expire dans 7 jours");
    await popup.screenshot({ path: "test-results/popup-selection.png" });

    // « Ouvrir ma sélection dans Artinova » lands on the Stock page with the selection.
    const [stock] = await Promise.all([
      context.waitForEvent("page"),
      popup.getByRole("button", { name: "Ouvrir ma sélection dans Artinova" }).click(),
    ]);
    await expect(stock).toHaveURL("https://app.artinova.test/stock?selection=extension");
    await stock.close();

    await popup
      .getByRole("button", { name: "Retirer « Perceuse visseuse sans fil 18 V »" })
      .click();
    await expect(row).toHaveCount(0);
    expect((await readCart(serviceWorker)).items).toHaveLength(0);

    await shop.reload();
    await clickButton(shop);
    await expect(row).toHaveCount(1);
    await popup.getByRole("button", { name: "Vider la sélection" }).click();
    await popup.getByRole("button", { name: "Annuler" }).click();
    await expect(row).toHaveCount(1);
    await popup.getByRole("button", { name: "Vider la sélection" }).click();
    await popup.getByRole("button", { name: "Oui, vider" }).click();
    await expect(popup.getByRole("heading", { name: "Votre sélection est vide" })).toBeVisible();
  });

  test("searches suppliers without accents and shows help", async ({ context, extensionId }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/index.html#/suppliers`);
    await expect(popup.getByRole("heading", { name: "Fournisseurs supportés" })).toBeVisible();
    await popup.getByRole("searchbox").fill("LEROY merlin");
    const link = popup.getByRole("link", { name: /Leroy Merlin/ });
    await expect(link).toHaveAttribute("href", "https://www.leroymerlin.fr/");
    await expect(link).toHaveAttribute("target", "_blank");
    await popup.getByRole("searchbox").fill("zzzz");
    await expect(
      popup.getByText("Aucun fournisseur ne correspond à votre recherche."),
    ).toBeVisible();

    await popup.getByRole("button", { name: "Retour" }).click();
    await popup.getByRole("button", { name: "Aide" }).click();
    await expect(
      popup.getByText(
        "Vos produits restent dans votre navigateur jusqu'à leur import dans Artinova.",
      ),
    ).toBeVisible();
    await expect(popup.getByText(/^Version \d+\.\d+\.\d+$/)).toBeVisible();
  });
});
