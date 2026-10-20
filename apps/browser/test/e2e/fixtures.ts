import { join } from "node:path";

import { type BrowserContext, chromium, test as base, type Worker } from "@playwright/test";

import { installRoutes } from "./routes";

const EXTENSION = join(import.meta.dirname, "..", "..", "build", "chrome-e2e");

type Fixtures = {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
};

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixtures need the destructuring
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    await installRoutes(context);
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
    await use(worker);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
});

export const expect = test.expect;

type StoredCart = {
  revision: number;
  items: {
    id: string;
    designation: string;
    priceCents: number | null;
    priceBasis: string;
    observedAt: string;
    image: { status: string };
  }[];
};

/** The cart as stored by the background. */
export async function readCart(worker: Worker): Promise<StoredCart> {
  return worker.evaluate(async () => {
    const stored = await chrome.storage.local.get("global_cart_state");
    return (stored["global_cart_state"] ?? { revision: 0, items: [] }) as StoredCart;
  });
}

export async function readBadge(worker: Worker): Promise<string> {
  return worker.evaluate(() => chrome.action.getBadgeText({}));
}
