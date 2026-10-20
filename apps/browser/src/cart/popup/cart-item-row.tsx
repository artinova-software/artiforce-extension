import { ImageSquare, Trash } from "@phosphor-icons/react";

import { t } from "../../platform/i18n/t";
import { IconButton } from "../../popup/components/icon-button";
import { Price } from "../../popup/components/price";
import { formatDate, formatExpiry } from "../../popup/format";
import type { CartItem } from "../models/cart-item";

export type CartItemRowProps = { item: CartItem; onRemove(id: string): void };

export function CartItemRow({ item, onRemove }: CartItemRowProps) {
  const thumbnail = item.image.status === "ready" ? item.image.thumbnailDataUrl : null;
  return (
    <li className="flex gap-3 px-4 py-3" data-testid="cart-item">
      <div className="flex size-14 flex-none items-center justify-center overflow-hidden rounded-control border border-line bg-white">
        {thumbnail === null ? (
          <ImageSquare size={22} className="text-ink-muted" aria-label={t("popupImageMissing")} />
        ) : (
          <img src={thumbnail} alt="" className="size-full object-contain" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <a
          href={item.productUrl}
          target="_blank"
          rel="noreferrer"
          className="line-clamp-2 text-sm font-medium text-ink hover:text-primary hover:underline"
        >
          {item.designation}
        </a>
        <p className="truncate text-xs text-ink-muted">{item.supplierName}</p>
        <p className="truncate text-xs text-ink-muted">
          {t("popupSupplierCode", item.supplierCode ?? t("popupNotProvided"))}
        </p>
        <p className="mt-1">
          <Price cents={item.priceCents} basis={item.priceBasis} />
        </p>
        <p className="text-xs text-ink-muted">
          {t("popupObservedOn", formatDate(item.observedAt))} · {formatExpiry(item.expiresAt)}
        </p>
      </div>
      <IconButton
        icon={Trash}
        tone="danger"
        label={t("popupRemoveItem", item.designation)}
        onClick={() => onRemove(item.id)}
      />
    </li>
  );
}
