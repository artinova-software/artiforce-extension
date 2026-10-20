import type { SupplierRecord, SupplierSite } from "./supplier-record.schema";

/** The WebExtension match pattern for one site, e.g. `https://www.leroymerlin.fr/*`. */
export function siteMatchPattern(site: SupplierSite): string {
  return `https://${site.host}${site.pathPrefix ?? "/"}*`;
}

/** Content-script `matches` for a list of suppliers, sorted and deduplicated. */
export function contentScriptMatches(suppliers: readonly SupplierRecord[]): string[] {
  return unique(suppliers.flatMap((supplier) => supplier.sites.map(siteMatchPattern)));
}

/**
 * Host permissions: every site host (the content script needs no permission, but
 * the image download from the site itself does) plus every image host.
 */
export function hostPermissions(suppliers: readonly SupplierRecord[]): string[] {
  return unique(
    suppliers.flatMap((supplier) => [
      ...supplier.sites.map((site) => `https://${site.host}/*`),
      ...supplier.imageHosts.map((host) => `https://${host}/*`),
    ]),
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}
