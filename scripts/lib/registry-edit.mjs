// Pure helpers for scripts/new-supplier.mjs (tested in new-supplier.test.mjs).

export const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const HOST = /^(?!-)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

/** Inserts a supplier record, refusing duplicate ids or hosts, keeping the id order. */
export function insertSupplier(suppliers, record) {
  if (!ID.test(record.id)) {
    throw new Error(`Invalid id "${record.id}" (kebab-case)`);
  }
  for (const site of record.sites) {
    if (!HOST.test(site.host)) {
      throw new Error(`Invalid host "${site.host}" (bare lowercase hostname)`);
    }
  }
  if (suppliers.some((supplier) => supplier.id === record.id)) {
    throw new Error(`Supplier "${record.id}" already exists`);
  }
  const hosts = new Set(suppliers.flatMap((supplier) => supplier.sites.map((site) => site.host)));
  const taken = record.sites.find((site) => hosts.has(site.host));
  if (taken !== undefined) {
    throw new Error(`Host "${taken.host}" already belongs to another supplier`);
  }
  return [...suppliers, record].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function buildRecord({
  id,
  name,
  host,
  segment,
  country = "FR",
  imageHosts = [],
  adapter = false,
}) {
  if (segment !== "pro" && segment !== "retail") {
    throw new Error('--segment must be "pro" or "retail"');
  }
  return {
    id,
    name,
    country,
    segment,
    sites: [{ host }],
    imageHosts: [...new Set(imageHosts)].sort(),
    defaultPriceBasis: segment === "pro" ? "HT" : "TTC",
    support: adapter ? "verified" : "generic",
  };
}

const camel = (id) =>
  id.replace(/-([a-z0-9])/g, (_match, letter) => letter.toUpperCase()).replace(/^(\d)/, "s$1");

export function adapterExportName(id) {
  return `${camel(id)}Adapter`;
}

export function adapterSource({ id, name, host }) {
  return `import { type SupplierAdapter, textOf } from "./adapter";

/**
 * ${name} (${host}). Fill in what the generic chain (JSON-LD, microdata, meta)
 * gets wrong on this site, then capture a fixture: docs/adding-a-supplier.md.
 */
export const ${adapterExportName(id)}: SupplierAdapter = {
  supplierId: "${id}",
  version: 1,

  findAnchor(page) {
    const button = page.document.querySelector("[data-testid='add-to-cart'], .add-to-cart");
    return button === null ? null : { element: button, position: "afterend" };
  },

  refine(page) {
    const designation = textOf(page.document, "h1");
    return designation === null ? {} : { designation };
  },
};
`;
}

export function adapterTestSource({ id }) {
  return `import { describe, expect, it } from "vitest";

import { getAdapter } from ".";

describe("${id} adapter", () => {
  it("is registered", () => {
    expect(getAdapter("${id}")?.supplierId).toBe("${id}");
  });
});
`;
}

/** Adds the import and the list entry to adapters/index.ts. */
export function registerAdapter(indexSource, id) {
  const name = adapterExportName(id);
  if (indexSource.includes(`"./${id}"`)) {
    throw new Error(`Adapter ${id} is already registered`);
  }
  const withImport = indexSource.replace(
    /(import type \{ SupplierAdapter \} from "\.\/adapter";\n)/,
    `$1import { ${name} } from "./${id}";\n`,
  );
  return withImport.replace(/\[([^\]]*)\]\.map\(\(adapter\)/s, (_match, list) => {
    const names = list
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    names.push(name);
    names.sort();
    return `[\n    ${names.join(",\n    ")},\n  ].map((adapter)`;
  });
}
