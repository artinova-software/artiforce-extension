import { describe, expect, it } from "vitest";

import {
  adapterExportName,
  buildRecord,
  insertSupplier,
  registerAdapter,
} from "./lib/registry-edit.mjs";

const existing = [
  { id: "alpha", sites: [{ host: "www.alpha.fr" }] },
  { id: "gamma", sites: [{ host: "www.gamma.fr" }] },
];

describe("supplier:new helpers", () => {
  it("inserts a record in id order with the segment's default basis", () => {
    const record = buildRecord({ id: "beta", name: "Beta", host: "www.beta.fr", segment: "pro" });
    expect(record).toMatchObject({ defaultPriceBasis: "HT", support: "generic", country: "FR" });
    expect(insertSupplier(existing, record).map((supplier) => supplier.id)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });

  it("refuses duplicates and malformed values", () => {
    const record = (overrides) => ({
      ...buildRecord({ id: "beta", name: "B", host: "www.beta.fr", segment: "retail" }),
      ...overrides,
    });
    expect(() => insertSupplier(existing, record({ id: "alpha" }))).toThrow(/already exists/);
    expect(() => insertSupplier(existing, record({ sites: [{ host: "www.gamma.fr" }] }))).toThrow(
      /another supplier/,
    );
    expect(() => insertSupplier(existing, record({ id: "Beta" }))).toThrow(/kebab-case/);
    expect(() => insertSupplier(existing, record({ sites: [{ host: "https://x.fr" }] }))).toThrow(
      /hostname/,
    );
    expect(() => buildRecord({ id: "x", name: "X", host: "x.fr", segment: "b2b" })).toThrow(
      /segment/,
    );
  });

  it("registers an adapter in adapters/index.ts", () => {
    const index = `import type { SupplierAdapter } from "./adapter";
import { leroyMerlinAdapter } from "./leroy-merlin";

const ADAPTERS: ReadonlyMap<string, SupplierAdapter> = new Map(
  [leroyMerlinAdapter].map((adapter) => [adapter.supplierId, adapter]),
);
`;
    const updated = registerAdapter(index, "point-p");
    expect(updated).toContain('import { pointPAdapter } from "./point-p";');
    expect(updated).toMatch(/\[\n {4}leroyMerlinAdapter,\n {4}pointPAdapter,\n {2}\]\.map/);
    expect(adapterExportName("123-elec")).toBe("s123ElecAdapter");
  });
});
