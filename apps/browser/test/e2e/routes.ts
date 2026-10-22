import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { BrowserContext, Route } from "@playwright/test";

export const SHOP = "https://shop.artiforce.test";
export const IMAGES = "https://img.artiforce.test";
export const APP = "https://app.artiforce.test";
/** An origin outside the bridge allow-list, with the same fake web app page. */
export const FOREIGN_APP = "https://evil.artiforce-test.example";

const HERE = import.meta.dirname;
const BUILD = join(HERE, "..", "..", "build", "chrome-e2e");

const page = (name: string) => readFileSync(join(HERE, "pages", name));

function fulfill(route: Route, body: Buffer | string, contentType: string, status = 200) {
  return route.fulfill({ status, body, contentType, headers: { "cache-control": "no-store" } });
}

/** Fake supplier shop, image CDN and Artiforce web app. */
export async function installRoutes(context: BrowserContext): Promise<void> {
  await context.route(`${SHOP}/**`, (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.startsWith("/produits/")) {
      return fulfill(route, page("shop-product.html"), "text/html; charset=utf-8");
    }
    if (pathname.startsWith("/spa")) {
      return fulfill(route, page("shop-spa.html"), "text/html; charset=utf-8");
    }
    return fulfill(route, page("shop-category.html"), "text/html; charset=utf-8");
  });
  await context.route(`${IMAGES}/**`, (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/perceuse.jpg") {
      return fulfill(route, readFileSync(join(HERE, "assets", "perceuse.jpg")), "image/jpeg");
    }
    if (pathname === "/fake.jpg") {
      return fulfill(route, "<html>not an image</html>", "image/jpeg");
    }
    return fulfill(route, "Not found", "text/plain", 404);
  });
  for (const origin of [APP, FOREIGN_APP]) {
    await context.route(`${origin}/**`, (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname === "/bridge-client.js") {
        return fulfill(
          route,
          readFileSync(join(BUILD, "e2e", "bridge-client.js")),
          "text/javascript",
        );
      }
      return fulfill(route, page("app.html"), "text/html; charset=utf-8");
    });
  }
}
