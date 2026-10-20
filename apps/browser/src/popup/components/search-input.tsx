import { MagnifyingGlass } from "@phosphor-icons/react";

export type SearchInputProps = { label: string; value: string; onChange(value: string): void };

export function SearchInput({ label, value, onChange }: SearchInputProps) {
  return (
    <label className="flex items-center gap-2 rounded-control border border-line bg-white px-3 focus-within:outline-3 focus-within:outline-ring">
      <MagnifyingGlass size={16} weight="bold" className="text-ink-muted" aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        placeholder={label}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
      />
    </label>
  );
}
