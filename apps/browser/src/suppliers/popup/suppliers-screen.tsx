import {
  activeSuppliers,
  foldForSearch,
  type SupplierRecord,
} from "@artinova-software/extension-suppliers/registry";
import { ArrowSquareOut, MagnifyingGlass } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { t } from "../../platform/i18n/t";
import { EmptyState } from "../../popup/components/empty-state";
import { Header } from "../../popup/components/header";
import { SearchInput } from "../../popup/components/search-input";

/** The supplier's home page (its first site, with its path prefix). */
function siteUrl(supplier: SupplierRecord): string {
  const site = supplier.sites[0];
  return site === undefined ? "#" : `https://${site.host}${site.pathPrefix ?? "/"}`;
}

const SUPPLIERS = activeSuppliers({ includeTestOnly: __TARGET__ === "e2e" });

function SupplierGroup({ title, suppliers }: { title: string; suppliers: SupplierRecord[] }) {
  if (suppliers.length === 0) {
    return null;
  }
  return (
    <section aria-label={title}>
      <h2 className="sticky top-0 bg-surface px-4 py-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
        {title} ({suppliers.length})
      </h2>
      <ul className="divide-y divide-line bg-white">
        {suppliers.map((supplier) => (
          <li key={supplier.id}>
            <a
              href={siteUrl(supplier)}
              target="_blank"
              rel="noreferrer"
              className="group flex items-baseline justify-between gap-3 px-4 py-2 hover:bg-surface"
            >
              <span className="text-sm text-ink group-hover:text-primary">{supplier.name}</span>
              <span className="flex min-w-0 items-center gap-1 text-xs text-ink-muted">
                <span className="truncate">{supplier.sites[0]?.host.replace(/^www\./, "")}</span>
                <ArrowSquareOut size={12} weight="bold" aria-hidden="true" className="flex-none" />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** « Fournisseurs supportés », accent-insensitive search, pro trade first. */
export function SuppliersScreen() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = foldForSearch(query.trim());
    const sorted = [...SUPPLIERS].sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return needle === ""
      ? sorted
      : sorted.filter((supplier) =>
          foldForSearch(
            `${supplier.name} ${supplier.sites.map((site) => site.host).join(" ")}`,
          ).includes(needle),
        );
  }, [query]);
  const pro = filtered.filter((supplier) => supplier.segment === "pro");
  const retail = filtered.filter((supplier) => supplier.segment === "retail");

  return (
    <>
      <Header title={t("popupSuppliersTitle")} back />
      <div className="border-b border-line bg-white px-4 py-3">
        <SearchInput label={t("popupSearchSuppliers")} value={query} onChange={setQuery} />
      </div>
      <div className="max-h-[440px] overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState icon={MagnifyingGlass} title={t("popupNoSupplierFound")} />
        ) : (
          <>
            <SupplierGroup title={t("popupSuppliersPro")} suppliers={pro} />
            <SupplierGroup title={t("popupSuppliersRetail")} suppliers={retail} />
          </>
        )}
      </div>
    </>
  );
}
