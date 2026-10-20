import { describe, expect, it } from "vitest";

import rawSuppliers from "./suppliers.json";
import { activeSuppliers, findSupplierForUrl, isAllowedImageHost, SUPPLIERS } from "./registry";
import { contentScriptMatches, hostPermissions } from "./match-patterns";

describe("suppliers.json", () => {
  it("is sorted by id", () => {
    const ids = SUPPLIERS.map((supplier) => supplier.id);
    expect(ids).toEqual([...ids].sort());
  });

  it("has unique ids and unique site hosts", () => {
    const ids = SUPPLIERS.map((supplier) => supplier.id);
    expect(new Set(ids).size).toBe(ids.length);
    const sites = SUPPLIERS.flatMap((supplier) =>
      supplier.sites.map((site) => `${site.host}${site.pathPrefix ?? ""}`),
    );
    expect(new Set(sites).size).toBe(sites.length);
  });

  it("declares bare hosts only: no scheme, no wildcard, no port", () => {
    const hosts = SUPPLIERS.flatMap((supplier) => [
      ...supplier.sites.map((site) => site.host),
      ...supplier.imageHosts,
    ]);
    for (const host of hosts) {
      expect(host).not.toMatch(/[*:/]/);
    }
  });

  it("keeps the raw JSON free of unknown keys", () => {
    expect(rawSuppliers.length).toBe(SUPPLIERS.length);
  });

  it("matches the price basis to the segment unless documented otherwise", () => {
    for (const supplier of SUPPLIERS) {
      const expected = supplier.segment === "pro" ? "HT" : "TTC";
      expect([expected, "UNKNOWN"]).toContain(supplier.defaultPriceBasis);
    }
  });

  it("has compilable product path patterns", () => {
    for (const supplier of SUPPLIERS) {
      if (supplier.productPath !== undefined) {
        expect(() => new RegExp(supplier.productPath ?? "")).not.toThrow();
      }
    }
  });

  it("keeps test-only suppliers on reserved .test hosts", () => {
    for (const supplier of SUPPLIERS.filter((entry) => entry.testOnly === true)) {
      for (const site of supplier.sites) {
        expect(site.host).toMatch(/\.test$/);
      }
    }
    for (const supplier of SUPPLIERS.filter((entry) => entry.testOnly !== true)) {
      for (const site of supplier.sites) {
        expect(site.host).not.toMatch(/\.test$|localhost/);
      }
    }
  });
});

describe("findSupplierForUrl", () => {
  it("finds a supplier by exact host", () => {
    expect(findSupplierForUrl("https://www.leroymerlin.fr/produits/x-1.html")?.id).toBe(
      "leroy-merlin",
    );
  });

  it("ignores other hosts, http and test suppliers by default", () => {
    expect(findSupplierForUrl("https://leroymerlin.fr.evil.example/")).toBeUndefined();
    expect(findSupplierForUrl("http://www.leroymerlin.fr/")).toBeUndefined();
    expect(findSupplierForUrl("https://shop.artinova.test/produits/1")).toBeUndefined();
    expect(
      findSupplierForUrl("https://shop.artinova.test/produits/1", { includeTestOnly: true })?.id,
    ).toBe("artinova-test-shop");
    expect(findSupplierForUrl("not a url")).toBeUndefined();
  });
});

describe("match patterns", () => {
  it("excludes test suppliers from the production list", () => {
    const matches = contentScriptMatches(activeSuppliers());
    expect(matches).toContain("https://www.leroymerlin.fr/*");
    expect(matches.some((pattern) => pattern.includes(".test"))).toBe(false);
  });

  it("grants every site and image host", () => {
    const permissions = hostPermissions(activeSuppliers());
    expect(permissions).toContain("https://media.adeo.com/*");
    expect(permissions).toContain("https://www.leroymerlin.fr/*");
  });

  it("allows image downloads from declared hosts only", () => {
    const supplier = findSupplierForUrl("https://www.leroymerlin.fr/");
    expect(supplier).toBeDefined();
    if (supplier !== undefined) {
      expect(isAllowedImageHost(supplier, "media.adeo.com")).toBe(true);
      expect(isAllowedImageHost(supplier, "evil.example")).toBe(false);
    }
  });
});
