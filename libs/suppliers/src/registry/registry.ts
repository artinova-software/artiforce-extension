import rawSuppliers from "./suppliers.json";
import {
  type SupplierRecord,
  supplierRegistrySchema,
  SupplierSupport,
} from "./supplier-record.schema";

/** Every supplier, validated once at module load. */
export const SUPPLIERS: readonly SupplierRecord[] = Object.freeze(
  supplierRegistrySchema.parse(rawSuppliers),
);

export type RegistryOptions = {
  /** Include `testOnly` suppliers (the e2e target). */
  includeTestOnly?: boolean;
};

/** Every supplier the manifest grants hosts for, disabled ones included (ADR-005). */
export function listedSuppliers(options: RegistryOptions = {}): SupplierRecord[] {
  return SUPPLIERS.filter(
    (supplier) => options.includeTestOnly === true || supplier.testOnly !== true,
  );
}

/** Suppliers the extension injects into: not disabled, test-only ones on demand. */
export function activeSuppliers(options: RegistryOptions = {}): SupplierRecord[] {
  return SUPPLIERS.filter(
    (supplier) =>
      supplier.support !== SupplierSupport.DISABLED &&
      (options.includeTestOnly === true || supplier.testOnly !== true),
  );
}

export function getSupplier(id: string): SupplierRecord | undefined {
  return SUPPLIERS.find((supplier) => supplier.id === id);
}

/** The supplier whose site covers `url`, or undefined. Only https is considered. */
export function findSupplierForUrl(
  url: string | URL,
  options: RegistryOptions = {},
): SupplierRecord | undefined {
  let parsed: URL;
  try {
    parsed = typeof url === "string" ? new URL(url) : url;
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:") {
    return undefined;
  }
  const host = parsed.hostname.toLowerCase();
  return activeSuppliers(options).find((supplier) =>
    supplier.sites.some(
      (site) =>
        site.host === host &&
        (site.pathPrefix === undefined || parsed.pathname.startsWith(site.pathPrefix)),
    ),
  );
}

/** True when `host` is one of the supplier's declared image hosts or site hosts. */
export function isAllowedImageHost(supplier: SupplierRecord, host: string): boolean {
  const lower = host.toLowerCase();
  return supplier.imageHosts.includes(lower) || supplier.sites.some((site) => site.host === lower);
}
