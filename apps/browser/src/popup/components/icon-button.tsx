import type { Icon } from "@phosphor-icons/react";
import type { ButtonHTMLAttributes } from "react";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: Icon;
  /** Accessible name: the button shows only the icon. */
  label: string;
  tone?: "default" | "danger";
};

export function IconButton({
  icon: IconComponent,
  label,
  tone = "default",
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-9 flex-none items-center justify-center rounded-control transition-colors focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-ring ${
        tone === "danger"
          ? "text-ink-muted hover:bg-danger/10 hover:text-danger"
          : "text-ink-muted hover:bg-surface hover:text-ink"
      } ${className}`}
      {...props}
    >
      <IconComponent size={18} weight="bold" aria-hidden="true" />
    </button>
  );
}
