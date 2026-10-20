// Content script: « Ajouter à Artinova » on supplier product pages.
// A classic script (IIFE): no dynamic import, no framework.
import "../../platform/config/zod-jitless";

import { findSupplierForUrl } from "@artinova-software/extension-suppliers";

import { BrowserApi } from "../../platform/browser/browser-api";
import { ButtonLifecycle } from "./lifecycle";

const GUARD = "__artinovaSupplierButton";

function main(): void {
  const scope = window as unknown as Record<string, unknown>;
  // Injected once per document, even if the manifest matches twice.
  if (scope[GUARD] === true || !BrowserApi.contextValid()) {
    return;
  }
  scope[GUARD] = true;
  const supplier = findSupplierForUrl(window.location.href, {
    includeTestOnly: __TARGET__ === "e2e",
  });
  if (supplier === undefined) {
    return;
  }
  new ButtonLifecycle(window, supplier).start();
}

main();
