import { NavLink } from "react-router-dom";

/** Tabs compactas: texto com sublinhado laranja (nunca "pills"). */
const tabClass = (active: boolean) =>
  `-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150 ${
    active ? "border-brand-600 text-brand-600" : "border-transparent text-ink-secondary hover:text-ink"
  }`;

const Count = ({ n }: { n: number }) => <span className="rounded-full bg-stone-100 px-1.5 text-xs font-medium text-stone-600">{n}</span>;

/** Tabs por estado (dentro da mesma página). */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: Array<{ key: K; label: string; count?: number }>;
  value: K;
  onChange: (key: K) => void;
  label?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto">
      {items.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)} className={tabClass(value === t.key)}>
          {t.label}
          {t.count !== undefined && <Count n={t.count} />}
        </button>
      ))}
    </div>
  );
}

/** Tabs por rota (cada aba é um endereço). */
export function TabNav({ items, label }: { items: Array<{ to: string; label: string; end?: boolean }>; label?: string }) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto">
      {items.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => tabClass(isActive)}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
