import { useEffect, useRef, type ReactNode } from "react";

import type { Tone } from "./sheet-format.ts";
const TONE: Record<Tone, string> = {
  ok: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-800",
  bad: "bg-red-50 text-red-700",
  neutral: "bg-surface-soft text-ink-secondary",
};

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[tone]}`}>{children}</span>;
}

/** Painel lateral com separadores (mesmo comportamento do painel do artigo): Esc fecha, foco volta. */
export function SheetDrawer<T extends string>({
  title,
  subtitle,
  actions,
  tabs,
  tab,
  onTab,
  onClose,
  toolbar,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Controlo comum a todos os separadores (ex.: variante do prato), por baixo do título. */
  toolbar?: ReactNode;
  tabs: { key: T; label: string }[];
  tab: T;
  onTab: (t: T) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="sheet-drawer-title">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-3xl flex-col bg-surface-card shadow-pop">
        <header className="border-b border-line px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="sheet-drawer-title" className="truncate text-base font-semibold text-ink">{title}</h2>
              {subtitle && <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">{subtitle}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {actions}
              <button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar" className="rounded-md px-2 py-1.5 text-sm text-ink-muted hover:bg-surface-soft">
                ✕
              </button>
            </div>
          </div>
          {toolbar && <div className="mt-3">{toolbar}</div>}
          <nav role="tablist" aria-label="Detalhe" className="mt-3 flex gap-1 overflow-x-auto overflow-y-hidden">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => onTab(t.key)}
                className={`-mb-px whitespace-nowrap border-b-2 px-2.5 py-1.5 text-xs font-medium ${tab === t.key ? "border-brand-600 text-brand-600" : "border-transparent text-ink-secondary hover:text-ink"}`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">{children}</div>
      </div>
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * Interruptor deslizante entre opções do mesmo tamanho (ex.: XS · Pequena · Grande). O destaque desliza para a
 * opção escolhida; setas ← → também mudam.
 */
export function VariantSwitch<T extends string>({ options, value, onChange, label }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const move = (delta: number) => onChange(options[(index + delta + options.length) % options.length]!.key);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") move(1);
        if (e.key === "ArrowLeft") move(-1);
      }}
      className="relative inline-flex rounded-full bg-surface-soft p-0.5 text-xs font-medium"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0.5 w-24 rounded-full bg-navy-900 shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={o.key === value}
          tabIndex={o.key === value ? 0 : -1}
          onClick={() => onChange(o.key)}
          className={`relative z-10 w-24 rounded-full py-1 text-center transition-colors ${o.key === value ? "text-white" : "text-ink-secondary hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
