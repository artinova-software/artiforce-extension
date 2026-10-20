import { ArrowLeft, Info, Storefront } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { t } from "../../platform/i18n/t";
import { navigate } from "../router";
import { IconButton } from "./icon-button";

export type HeaderProps = { title: string; back?: boolean; aside?: ReactNode };

export function Header({ title, back = false, aside }: HeaderProps) {
  return (
    <header className="flex items-center gap-2 border-b border-line bg-white px-3 py-2">
      {back ? (
        <IconButton icon={ArrowLeft} label={t("popupBack")} onClick={() => navigate("/")} />
      ) : (
        <img src="/images/icon-32.png" alt="" width={24} height={24} className="ml-1 rounded-md" />
      )}
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{title}</h1>
      {aside}
      {!back && (
        <>
          <IconButton
            icon={Storefront}
            label={t("popupSuppliersTitle")}
            onClick={() => navigate("/suppliers")}
          />
          <IconButton icon={Info} label={t("popupHelpTitle")} onClick={() => navigate("/help")} />
        </>
      )}
    </header>
  );
}
