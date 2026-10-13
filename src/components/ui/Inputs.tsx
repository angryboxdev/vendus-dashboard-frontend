import type { InputHTMLAttributes, ReactNode } from "react";
import { IconSearch } from "./icons.tsx";
import { FIELD } from "./ui-classes.ts";

/** Pesquisa com ícone (placeholder discreto). O `aria-label` vem do `label`. */
export function SearchInput({ label, className = "", ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  return (
    <div className={`relative ${className}`.trim()}>
      <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      <input type="search" aria-label={label} placeholder={rest.placeholder ?? label} className={`${FIELD} w-full pl-9`} {...rest} />
    </div>
  );
}

/**
 * Controlo segmentado (ex.: Funcionários | Turnos | Cargos): um só
 * contentor; o ativo tem fundo branco e leve destaque.
 */
export function SegmentedControl<K extends string>({
  items,
  value,
  onChange,
  label,
  size = "md",
}: {
  items: Array<{ key: K; label: ReactNode }>;
  value: K;
  onChange: (key: K) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-surface-soft p-1">
      {items.map((i) => {
        const active = i.key === value;
        return (
          <button
            key={i.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(i.key)}
            className={`rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${
              active ? "bg-surface-card text-navy-900 shadow-card" : "text-ink-secondary hover:text-navy-900"
            }`}
          >
            {i.label}
          </button>
        );
      })}
    </div>
  );
}
