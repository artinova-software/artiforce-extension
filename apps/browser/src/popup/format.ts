import type { PriceBasis } from "@artinova-software/extension-suppliers/registry";

import { t } from "../platform/i18n/t";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const date = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const DAY_MS = 24 * 60 * 60 * 1000;

export function formatCents(cents: number): string {
  return currency.format(cents / 100);
}

/** « 24,90 € TTC », « 24,90 € HT », « 24,90 € (HT ou TTC à confirmer) », « Prix non relevé ». */
export function formatPrice(cents: number | null, basis: PriceBasis): string {
  if (cents === null) {
    return t("popupPriceMissing");
  }
  const amount = formatCents(cents);
  return basis === "HT"
    ? t("popupPriceHt", amount)
    : basis === "TTC"
      ? t("popupPriceTtc", amount)
      : t("popupPriceUnknown", amount);
}

export function formatDate(iso: string): string {
  return date.format(new Date(iso));
}

/** « Expire dans 2 jours », « Expire demain », « Expire aujourd'hui ». */
export function formatExpiry(expiresAt: string, now = Date.now()): string {
  const days = Math.ceil((Date.parse(expiresAt) - now) / DAY_MS);
  if (days <= 0) {
    return t("popupExpiresToday");
  }
  return days === 1 ? t("popupExpiresTomorrow") : t("popupExpiresInDays", days);
}
