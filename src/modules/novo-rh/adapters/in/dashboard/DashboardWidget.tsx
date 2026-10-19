import { Component, type DragEvent, type ReactNode } from "react";
import { IconButton, IconEye, IconEyeOff, Skeleton } from "../../../../../components/ui/index.ts";
import type { WidgetDefinition } from "../../../domain/services/dashboard.service.ts";

/** Classes de coluna fixas (o Tailwind só gera as que aparecem no código). */
const SPAN: Record<number, string> = {
  4: "md:col-span-6 xl:col-span-4",
  5: "md:col-span-6 xl:col-span-5",
  6: "md:col-span-6 xl:col-span-6",
  7: "md:col-span-12 xl:col-span-7",
  12: "md:col-span-12 xl:col-span-12",
};
const spanClass = (span: number) => `col-span-12 ${SPAN[span] ?? SPAN[6]}`;

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
  span,
  icon,
  count,
  countTone = "neutral",
  subtitle,
  action,
  children,
  edit,
}: {
  def: WidgetDefinition;
  span: number;
  icon: ReactNode;
  count?: number;
  countTone?: "neutral" | "critical";
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  edit?: EditProps;
}) {
  const editing = !!edit?.editing;
  return (
    <section
      id={`widget-${def.id}`}
      aria-label={def.title}
      tabIndex={-1}
      onDragOver={edit?.onDragOver}
      onDrop={edit?.onDrop}
      onClick={editing ? edit!.onSelect : undefined}
      className={`${spanClass(span)} relative flex scroll-mt-24 flex-col rounded-2.5xl border bg-surface-card p-5 shadow-card transition duration-150 motion-safe:animate-motion-fade-up ${
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
            <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-navy-900">
              {def.title}
              {count !== undefined && count > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold normal-case tracking-normal tabular-nums ${countTone === "critical" ? "bg-red-50 text-red-700" : "bg-surface-soft text-ink-secondary"}`}>{count}</span>
              )}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-secondary">{subtitle}</p>}
          </div>
        </div>
        {editing ? (
          <IconButton label={edit!.hidden ? `Mostrar ${def.title}` : `Ocultar ${def.title}`} size="sm" onClick={(e) => (e.stopPropagation(), edit!.onToggleHidden())}>
            {edit!.hidden ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </IconButton>
        ) : (
          action
        )}
      </header>
      <div className={editing ? "pointer-events-none select-none" : ""} inert={editing || undefined}>
        <WidgetBoundary title={def.title}>{children}</WidgetBoundary>
      </div>
    </section>
  );
}
