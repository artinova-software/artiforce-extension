// The registry is TypeScript in libs/suppliers; the build reads the same JSON
// and applies the same rules (kept in sync by manifest.test.mjs).
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ROOT_DIR } from "./build-config.mjs";

const REGISTRY = join(ROOT_DIR, "libs", "suppliers", "src", "registry", "suppliers.json");

export function readSuppliers() {
  return JSON.parse(readFileSync(REGISTRY, "utf8"));
}

export function activeSuppliers({ includeTestOnly = false } = {}, suppliers = readSuppliers()) {
  return suppliers.filter(
    (supplier) =>
      supplier.support !== "disabled" && (includeTestOnly || supplier.testOnly !== true),
  );
}

export function listedSuppliers({ includeTestOnly = false } = {}, suppliers = readSuppliers()) {
  return suppliers.filter((supplier) => includeTestOnly || supplier.testOnly !== true);
}

const unique = (values) => [...new Set(values)].sort();

export function contentScriptMatches(suppliers) {
  return unique(
    suppliers.flatMap((supplier) =>
      supplier.sites.map((site) => `https://${site.host}${site.pathPrefix ?? "/"}*`),
    ),
  );
}

export function hostPermissions(suppliers) {
  return unique(
    suppliers.flatMap((supplier) => [
      ...supplier.sites.map((site) => `https://${site.host}/*`),
      ...supplier.imageHosts.map((host) => `https://${host}/*`),
    ]),
  );
}
