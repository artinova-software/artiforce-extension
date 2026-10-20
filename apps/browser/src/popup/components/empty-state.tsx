import type { Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

export type EmptyStateProps = { icon: Icon; title: string; children?: ReactNode };

export function EmptyState({ icon: IconComponent, title, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-primary">
        <IconComponent size={24} weight="bold" aria-hidden="true" />
      </span>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {children}
    </div>
  );
}
