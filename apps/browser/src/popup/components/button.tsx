import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-brand-700",
  secondary: "border border-line bg-white text-ink hover:bg-surface",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "text-primary hover:bg-brand-50",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
