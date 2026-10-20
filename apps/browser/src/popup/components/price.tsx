import type { PriceBasis } from "@artinova-software/extension-suppliers/registry";

import { formatPrice } from "../format";

export type PriceProps = { cents: number | null; basis: PriceBasis };

export function Price({ cents, basis }: PriceProps) {
  const unknown = cents !== null && basis === "UNKNOWN";
  return (
    <span
      className={`text-sm font-semibold ${cents === null ? "text-ink-muted" : unknown ? "text-warning" : "text-ink"}`}
    >
      {formatPrice(cents, basis)}
    </span>
  );
}
