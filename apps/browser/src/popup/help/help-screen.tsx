import { ArrowSquareOut, ShieldCheck } from "@phosphor-icons/react";

import { BrowserApi } from "../../platform/browser/browser-api";
import { loadAppConfig } from "../../platform/config/app-config";
import { t } from "../../platform/i18n/t";
import { Header } from "../components/header";

export function HelpScreen() {
  return (
    <>
      <Header title={t("popupHelpTitle")} back />
      <div className="flex flex-col gap-4 bg-white px-4 py-4">
        <a
          href={loadAppConfig().helpUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowSquareOut size={16} weight="bold" aria-hidden="true" />
          {t("popupHelpCenter")}
        </a>
        <p className="flex gap-2 text-sm text-ink">
          <ShieldCheck
            size={18}
            weight="bold"
            className="flex-none text-success"
            aria-hidden="true"
          />
          {t("popupPrivacy")}
        </p>
        <p className="text-xs text-ink-muted">{t("popupVersion", BrowserApi.getVersion())}</p>
      </div>
    </>
  );
}
