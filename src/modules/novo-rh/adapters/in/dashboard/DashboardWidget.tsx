import { Component, type DragEvent, type ReactNode } from "react";
import { IconButton, IconChevronDown, IconEye, IconEyeOff, Skeleton } from "../../../../../components/ui/index.ts";
import type { WidgetDefinition } from "../../../domain/services/dashboard.service.ts";


/** Falha de um widget não derruba o Dashboard. */
export class WidgetBoundary extends Component<{ title: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return <WidgetMessage text={`${this.props.title}: não foi possível mostrar agora.`} />;
    return this.props.children;
  }
}

export function WidgetMessage({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 py-3 text-sm text-ink-secondary">
      <p>{text}</p>
      {action}
    </div>
  );
}

export function WidgetSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 py-1" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${i % 2 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

export interface EditProps {
  editing: boolean;
  hidden: boolean;
  dragging: boolean;
  dropTarget: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  onToggleHidden: () => void;
  onSelect: () => void;
  selected: boolean;
}

/**
 * Moldura de um widget: título, contagem, ação de cabeçalho, conteúdo. Em
 * "Personalizar": pega para arrastar, ocultar/mostrar e o conteúdo fica
 * inerte (sem navegar nem aprovar; as consultas não recomeçam).
 */
export function DashboardWidget({
  def,
  full,
  className = "",
  icon,
  count,
  countTone = "neutral",
  subtitle,
  action,
  children,
  edit,
  expand,
  detail,
  compact,
}: {
  def: WidgetDefinition;
  /** Ocupa as duas colunas («Largo»). */
  full: boolean;
  /** Posição na linha (ordem em telemóvel vs. desktop). */
  className?: string;
  icon: ReactNode;
  count?: number;
  countTone?: "neutral" | "critical";
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  edit?: EditProps;
  /**
   * Expansão horizontal na própria linha (estado visual transitório):
   * «expanded» mostra o detalhe dentro deste cartão; «compact» é o vizinho
   * encolhido (só o essencial; clicar expande-o). Ausente = não expande.
   */
  expand?: { state: "normal" | "expanded" | "compact"; onToggle: () => void; canExpand: boolean };
  /** Conteúdo completo quando expandido (substitui o resumo, no mesmo cartão). */
  detail?: ReactNode;
  /** O essencial quando o vizinho está expandido (só em desktop; abaixo mostra o resumo). */
  compact?: ReactNode;
}) {
  const editing = !!edit?.editing;
  const state = editing ? "normal" : (expand?.state ?? "normal");
  const bodyId = `widget-body-${def.id}`;
  // Vizinho compacto: clicar no cartão (em desktop) troca a expansão para ele.
  const compactClick = () => {
    if (state !== "compact" || !expand?.canExpand) return;
    if (typeof window !== "undefined" && window.matchMedia && !window.matchMedia("(min-width: 1024px)").matches) return;
    expand.onToggle();
  };
  return (
    <section
      id={`widget-${def.id}`}
      aria-label={def.title}
      tabIndex={-1}
      onDragOver={edit?.onDragOver}
      onDrop={edit?.onDrop}
      data-state={state}
      onClick={editing ? edit!.onSelect : state === "compact" ? compactClick : undefined}
      className={`${full ? "lg:col-span-2" : ""} ${className} relative flex h-full min-w-0 scroll-mt-24 flex-col rounded-2.5xl border bg-surface-card p-5 shadow-card transition duration-150 motion-safe:animate-motion-fade-up ${state === "expanded" ? "ring-2 ring-brand-500/20" : ""} ${state === "compact" && expand?.canExpand ? "lg:cursor-pointer lg:hover:border-brand-500/40" : ""} ${
        editing ? `cursor-default ${edit!.selected ? "border-brand-500 ring-2 ring-brand-500/20" : "border-line"} ${edit!.hidden ? "opacity-50" : ""}` : "border-line"
      } ${edit?.dragging ? "scale-[0.99] opacity-40" : ""} ${edit?.dropTarget ? "outline-dashed outline-2 outline-offset-2 outline-brand-500" : ""}`}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-start gap-2.5">
          {editing && (
            <button
              type="button"
              draggable
              onDragStart={edit!.onDragStart}
              onDragEnd={edit!.onDragEnd}
              aria-label={`Arrastar ${def.title}`}
              title="Arrastar para mudar de posição"
              className="-ml-1 mt-0.5 cursor-grab rounded-md px-1 text-ink-muted hover:bg-surface-soft hover:text-navy-900 active:cursor-grabbing"
            >
              <span aria-hidden="true" className="grid grid-cols-2 gap-0.5">
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i} className="h-1 w-1 rounded-full bg-current" />
                ))}
              </span>
            </button>
          )}
          <span className="mt-0.5 text-navy-900">{icon}</span>
          <div className="min-w-0">
            <h2 className="flex min-w-0 items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-navy-900" title={def.title}>
              <span className={state === "compact" ? "lg:truncate" : ""}>{def.title}</span>
              {count !== undefined && count > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold normal-case tracking-normal tabular-nums ${countTone === "critical" ? "bg-red-50 text-red-700" : "bg-surface-soft text-ink-secondary"}`}>{count}</span>
              )}
            </h2>
            {subtitle && <p className={`mt-0.5 text-xs text-ink-secondary ${state === "compact" ? "lg:hidden" : ""}`}>{subtitle}</p>}
          </div>
        </div>
        {editing ? (
          <IconButton label={edit!.hidden ? `Mostrar ${def.title}` : `Ocultar ${def.title}`} size="sm" onClick={(e) => (e.stopPropagation(), edit!.onToggleHidden())}>
            {edit!.hidden ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </IconButton>
        ) : (
          <span className="flex shrink-0 items-center gap-2">
            {action && <span className={state === "compact" ? "lg:hidden" : ""}>{action}</span>}
            {expand?.canExpand && (
              <button
                type="button"
                data-expand={def.id}
                aria-expanded={state === "expanded"}
                aria-controls={bodyId}
                aria-label={state === "expanded" ? `Recolher ${def.title}` : `Expandir ${def.title}`}
                onClick={(e) => (e.stopPropagation(), expand.onToggle())}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                <span className={state === "compact" ? "lg:sr-only" : ""}>{state === "expanded" ? "Recolher" : "Expandir"}</span>
                <IconChevronDown size={14} className={`transition-transform duration-150 motion-reduce:transition-none ${state === "expanded" ? "rotate-180" : state === "compact" ? "lg:-rotate-90" : ""}`} />
              </button>
            )}
          </span>
        )}
      </header>
      <div id={bodyId} className={`min-w-0 flex-1 ${editing ? "pointer-events-none select-none" : ""}`} inert={editing || undefined}>
        <WidgetBoundary title={def.title}>
          {state === "expanded" && detail ? (
            <div className="motion-safe:animate-motion-fade-up">{detail}</div>
          ) : state === "compact" && compact ? (
            <>
              <div className="hidden lg:block">{compact}</div>
              <div className="lg:hidden">{children}</div>
            </>
          ) : (
            children
          )}
        </WidgetBoundary>
      </div>
    </section>
  );
}
