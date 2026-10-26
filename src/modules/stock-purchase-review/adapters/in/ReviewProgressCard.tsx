import type { CompactFilter, ReviewProgress } from "../../domain/services/compact-review.ts";

type Segment = { key: "resolved" | "pending" | "out"; filter: CompactFilter; count: number; label: string; detail?: string; bar: string; dot: string };

const pct = (n: number, total: number) => (total > 0 ? (n / total) * 100 : 0);

/**
 * Resumo do topo da conciliação: «40/44 resolvidas» + barra segmentada (resolvidas · por resolver ·
 * fora do Stock). Conta linhas da fatura. Cada legenda filtra a lista por baixo (outra vez = todas).
 */
export function ReviewProgressCard({ progress, filter, onFilter }: { progress: ReviewProgress; filter: CompactFilter; onFilter: (f: CompactFilter) => void }) {
  const { total, resolved, pending, withProposal, out } = progress;
  const done = total > 0 && pending === 0;
  const segments: Segment[] = [
    { key: "resolved", filter: "stock", count: resolved, label: resolved === 1 ? "Resolvida" : "Resolvidas", bar: "bg-emerald-500", dot: "bg-emerald-500" },
    {
      key: "pending",
      filter: "pending",
      count: pending,
      label: "Por resolver",
      detail: withProposal > 0 ? `${withProposal} com proposta` : undefined,
      bar: "bg-amber-400",
      dot: "bg-amber-400",
    },
    { key: "out", filter: "out", count: out, label: "Fora do Stock", bar: "bg-stone-300", dot: "bg-stone-300" },
  ];

  return (
    <section aria-label="Progresso da conciliação" className="rounded-xl border border-stone-200 bg-white px-5 py-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Conciliação</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums text-stone-900">{resolved}</span>
            <span className="text-lg tabular-nums text-stone-400">/ {total}</span>
            <span className="text-sm text-stone-500">{resolved === 1 ? "linha resolvida" : "linhas resolvidas"}</span>
          </p>
        </div>
        {done ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
            </svg>
            Tudo conciliado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Falta{pending === 1 ? "" : "m"} {pending} {pending === 1 ? "linha" : "linhas"}
          </span>
        )}
      </div>

      <div
        role="img"
        aria-label={`${resolved} resolvidas, ${pending} por resolver e ${out} fora do Stock, num total de ${total} linhas`}
        className="mt-3 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-stone-100"
      >
        {segments
          .filter((s) => s.count > 0)
          .map((s) => (
            <div
              key={s.key}
              title={`${s.count} ${s.label.toLowerCase()} (${Math.round(pct(s.count, total))}%)`}
              className={`${s.bar} h-full transition-[width] duration-500 ease-out first:rounded-l-full last:rounded-r-full`}
              style={{ width: `${pct(s.count, total)}%` }}
            />
          ))}
      </div>

      <div role="group" aria-label="Filtrar linhas pelo estado" className="mt-3 flex flex-wrap gap-x-1 gap-y-1">
        {segments.map((s) => {
          const active = filter === s.filter;
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={active}
              aria-label={`${s.count} ${s.label}${s.detail ? `, ${s.detail}` : ""}`}
              disabled={s.count === 0}
              onClick={() => onFilter(active ? "all" : s.filter)}
              className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors disabled:cursor-default disabled:opacity-50 ${
                active ? "bg-stone-800 text-white" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${s.dot}`} />
              <span className="font-semibold tabular-nums">{s.count}</span>
              <span>{s.label}</span>
              {s.detail && <span className={active ? "text-stone-300" : "text-stone-400"}>· {s.detail}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
