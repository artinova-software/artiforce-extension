import { useState } from "react";

import { t } from "../../platform/i18n/t";
import { Button } from "./button";

export type ConfirmInlineProps = {
  label: string;
  question: string;
  confirmLabel: string;
  onConfirm(): void | Promise<void>;
  disabled?: boolean;
};

/** A destructive action confirmed in place, without a modal. */
export function ConfirmInline({
  label,
  question,
  confirmLabel,
  onConfirm,
  disabled,
}: ConfirmInlineProps) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button
        variant="ghost"
        className="text-danger hover:bg-danger/10"
        disabled={disabled}
        onClick={() => setAsking(true)}
      >
        {label}
      </Button>
    );
  }
  return (
    <div
      role="group"
      aria-label={question}
      className="flex flex-wrap items-center justify-end gap-2"
    >
      <span className="text-sm text-ink">{question}</span>
      <Button variant="secondary" onClick={() => setAsking(false)}>
        {t("popupCancel")}
      </Button>
      <Button
        variant="danger"
        onClick={() => {
          setAsking(false);
          void onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
    </div>
  );
}
