// Manual check (not part of the suite): build/chrome-production (pnpm build:chrome)
// loads in Chromium with no error from the service worker or the popup.
import { join } from "node:path";

import { chromium, expect, test } from "@playwright/test";

const EXTENSION = join(import.meta.dirname, "..", "..", "..", "build", "chrome-production");

test("production build loads cleanly", async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  const errors: string[] = [];
  context.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      errors.push(`${message.type()}: ${message.text()}`);
    }
  });
  context.on("weberror", (error) => errors.push(`weberror: ${error.error().message}`));
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).host;
  const state = await worker.evaluate(async () => {
    const manifest = chrome.runtime.getManifest();
    return {
      version: manifest.version,
      name: chrome.i18n.getMessage("extName"),
      hostPermissions: manifest.host_permissions?.length,
      contentMatches: manifest.content_scripts?.[0]?.matches?.length,
    };
  });
  // Bootstrap (re)creates the hourly purge alarm.
  await expect
    .poll(() =>
      worker.evaluate(async () => (await chrome.alarms.get("cart-purge"))?.periodInMinutes),
    )
    .toBe(60);
  const popup = await context.newPage();
  popup.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  await popup.goto(`chrome-extension://${id}/popup/index.html`);
  await expect(popup.getByRole("heading", { name: "Votre sélection est vide" })).toBeVisible();
  await popup.goto(`chrome-extension://${id}/popup/index.html#/suppliers`);
  await expect(popup.getByRole("heading", { name: /Négoces professionnels/ })).toBeVisible();
  await popup.getByRole("searchbox").focus();
  await popup.getByRole("link", { name: /Acadia/ }).hover();
  await popup.screenshot({ path: "test-results/production-popup-suppliers.png" });
  test.info().annotations.push({ type: "state", description: JSON.stringify(state) });
  test.info().annotations.push({ type: "errors", description: JSON.stringify(errors) });
  expect(state).toMatchObject({ name: "Artinova, produits fournisseurs" });
  expect(errors).toEqual([]);
  await context.close();
});
