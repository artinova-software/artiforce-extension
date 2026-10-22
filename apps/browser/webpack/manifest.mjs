import {
  activeSuppliers,
  contentScriptMatches,
  hostPermissions,
  listedSuppliers,
} from "./suppliers.mjs";
import { originMatchPattern } from "./app-config.mjs";

const BROWSER_PREFIX = /^__(chrome|edge|firefox)__(.+)$/;

/**
 * Flattens `__chrome__key` / `__firefox__key` / `__edge__key` entries for one
 * browser, recursively. Edge falls back to the Chrome keys.
 */
export function flattenBrowserKeys(value, browser) {
  if (Array.isArray(value)) {
    return value.map((entry) => flattenBrowserKeys(entry, browser));
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  const result = {};
  const specific = {};
  for (const [key, child] of Object.entries(value)) {
    const match = BROWSER_PREFIX.exec(key);
    if (match === null) {
      result[key] = flattenBrowserKeys(child, browser);
      continue;
    }
    const [, keyBrowser, name] = match;
    const applies = keyBrowser === browser || (browser === "edge" && keyBrowser === "chrome");
    if (applies && (keyBrowser === browser || !(name in specific))) {
      specific[name] = { browser: keyBrowser, value: flattenBrowserKeys(child, browser) };
    }
  }
  for (const [name, entry] of Object.entries(specific)) {
    result[name] = entry.value;
  }
  return result;
}

/**
 * The final manifest: browser keys flattened, version from the repository,
 * content scripts and host permissions generated from the supplier registry,
 * the bridge on the Artiforce origins at document_start, and a development key
 * (stable extension ID) for the development and e2e targets only.
 */
export function buildManifest(template, { browser, target, version, appConfig, devKey }) {
  const manifest = flattenBrowserKeys(template, browser);
  manifest.version = version;
  const includeTestOnly = target === "e2e";
  const suppliers = activeSuppliers({ includeTestOnly });
  const bridgeMatches = [...new Set(appConfig.artiforceOrigins.map(originMatchPattern))].sort();
  manifest.content_scripts = [
    {
      matches: contentScriptMatches(suppliers),
      js: ["content/supplier-button.js"],
      run_at: "document_idle",
      all_frames: false,
    },
    {
      matches: bridgeMatches,
      js: ["content/artiforce-bridge.js"],
      run_at: "document_start",
      all_frames: false,
    },
  ];
  // Disabled suppliers keep their hosts: re-enabling one later must not add a
  // permission, which would disable the extension until users accept it.
  manifest.host_permissions = hostPermissions(listedSuppliers({ includeTestOnly }));
  if ((target === "development" || target === "e2e") && browser !== "firefox" && devKey) {
    manifest.key = devKey;
  }
  return manifest;
}
