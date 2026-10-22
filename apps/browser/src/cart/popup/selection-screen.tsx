import { ArrowSquareOut, ShoppingCartSimple } from "@phosphor-icons/react";
import { useState } from "react";

import { BrowserApi } from "../../platform/browser/browser-api";
import { loadAppConfig, selectionUrl } from "../../platform/config/app-config";
import { t } from "../../platform/i18n/t";
import { sendCommand } from "../../platform/messaging/message-sender";
import { Button } from "../../popup/components/button";
import { ConfirmInline } from "../../popup/components/confirm-inline";
import { EmptyState } from "../../popup/components/empty-state";
import { Header } from "../../popup/components/header";
import { useGlobalState } from "../../popup/hooks/use-global-state";
import { navigate } from "../../popup/router";
import { cartClear, cartRemove } from "../cart.commands";
import { CART_KEY } from "../cart.state";
import { CartItemRow } from "./cart-item-row";

/** « Ma sélection »: the captured products, newest first. */
export function SelectionScreen() {
  const { value: cart, loaded } = useGlobalState(CART_KEY);
  const [error, setError] = useState(false);
  const run = (action: Promise<unknown>) => {
    setError(false);
    action.catch(() => setError(true));
  };
  const items = cart.items;

  return (
    <>
      <Header
        title={t("popupSelectionTitle")}
        aside={
          items.length > 0 ? (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
              {items.length === 1 ? t("popupItemCountOne") : t("popupItemCountMany", items.length)}
            </span>
          ) : null
        }
      />
      {error && (
        <p
          role="alert"
          className="mx-4 mt-3 rounded-control bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {t("popupError")}
        </p>
      )}
      {loaded && items.length === 0 ? (
        <EmptyState icon={ShoppingCartSimple} title={t("popupEmptyTitle")}>
          <p className="text-sm text-ink-muted">{t("popupEmptyBody")}</p>
          <Button variant="ghost" onClick={() => navigate("/suppliers")}>
            {t("popupEmptyLink")}
          </Button>
        </EmptyState>
      ) : (
        <ul className="max-h-[400px] divide-y divide-line overflow-y-auto bg-white">
          {items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              onRemove={(id) => run(sendCommand(cartRemove, { ids: [id] }))}
            />
          ))}
        </ul>
      )}
      <footer className="flex flex-col gap-3 border-t border-line bg-surface px-4 py-3">
        <Button onClick={() => void BrowserApi.createTab(selectionUrl(loadAppConfig()))}>
          <ArrowSquareOut size={16} weight="bold" aria-hidden="true" />
          {t("popupOpenArtiforce")}
        </Button>
        <p className="text-xs text-ink-muted">{t("popupImportHint")}</p>
        {items.length > 0 && (
          <div className="flex justify-end">
            <ConfirmInline
              label={t("popupClear")}
              question={t("popupClearConfirm")}
              confirmLabel={t("popupClearYes")}
              onConfirm={() => run(sendCommand(cartClear, {}))}
            />
          </div>
        )}
      </footer>
    </>
  );
}
