import { Fragment, type ReactNode } from "react";
import { IconChevronLeft, IconChevronRight } from "./icons.tsx";
import { PAGE_TITLE } from "./ui-classes.ts";

/**
 * Cabeçalho de página: breadcrumb discreto, título grande, descrição e
 * ações globais à direita — sem contentor à volta do título.
 */
export function PageHeader({ breadcrumb, title, description, actions }: { breadcrumb?: string[]; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 motion-safe:animate-motion-fade-up">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Localização" className="mb-4 flex items-center gap-2.5 text-[13px] text-ink-secondary">
            {breadcrumb.map((b, i) => (
              <Fragment key={b}>
                {i > 0 && <IconChevronRight size={12} className="text-ink-muted" />}
                <span className={i === breadcrumb.length - 1 ? "text-navy-900" : ""}>{b}</span>
              </Fragment>
            ))}
          </nav>
        )}
        <h1 className={PAGE_TITLE}>{title}</h1>
        {description && <p className="mt-2 text-[17px] text-ink-secondary">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Barra de ferramentas: um só contentor suave que concentra as ações da vista. */
export function Toolbar({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="toolbar" aria-label={label} className="flex flex-wrap items-center gap-1.5 rounded-2.5xl bg-surface-soft/80 p-2 xl:flex-nowrap motion-safe:animate-motion-fade-up [animation-delay:60ms]">
      {children}
    </div>
  );
}

/** Grupo de botões dentro da barra (fundo branco, cantos arredondados). */
export function ToolbarGroup({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex items-center gap-0.5 rounded-xl bg-surface-card p-1 shadow-card ${className}`}>{children}</div>;
}

/** Separador vertical discreto entre grupos da barra. */
export function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-0.5 hidden h-6 w-px bg-line sm:block" />;
}

/** Navegação de período: ‹ 12/10/2026 - 18/10/2026 ›. */
export function DateNavigator({ label, onPrev, onNext, prevLabel = "Período anterior", nextLabel = "Período seguinte" }: { label: string; onPrev: () => void; onNext: () => void; prevLabel?: string; nextLabel?: string }) {
  const btn = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-navy-900 transition-colors duration-150 hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40";
  return (
    <div className="flex h-10 items-center gap-1 rounded-xl bg-surface-card px-1 shadow-card">
      <button type="button" onClick={onPrev} aria-label={prevLabel} className={btn}>
        <IconChevronLeft size={16} />
      </button>
      <span aria-live="polite" className="min-w-[11rem] whitespace-nowrap px-1 text-center text-sm font-medium text-navy-900 tabular-nums first-letter:uppercase">
        {label}
      </span>
      <button type="button" onClick={onNext} aria-label={nextLabel} className={btn}>
        <IconChevronRight size={16} />
      </button>
    </div>
  );
}

/** Esqueleto com a forma do conteúdo real (em vez de um spinner central). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-lg bg-surface-soft motion-reduce:animate-none ${className}`} />;
}

/** Estado vazio: mensagem curta e, opcionalmente, a ação seguinte. */
export function EmptyState({ title, description, action, icon }: { title: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center motion-safe:animate-motion-fade">
      {icon && <span className="mb-1 text-ink-muted">{icon}</span>}
      <p className="text-sm font-medium text-navy-900">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-secondary">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
