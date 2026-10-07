import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import {
  buildReviewDays,
  initiallyCollapsed,
  reviewSummary,
  selectionState,
  type CheckState,
} from "../../domain/services/publish-review.service.ts";

/** Checkbox com estado indeterminado (seleção parcial de um dia / do total). */
function TriCheckbox({ state, onChange, label }: { state: CheckState; onChange: (checked: boolean) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === "some";
  }, [state]);
  return <input ref={ref} type="checkbox" aria-label={label} checked={state === "all"} onChange={(e) => onChange(e.target.checked)} />;
}

const yearsOf = (from: string, to: string) => [...new Set([Number(from.slice(0, 4)), Number(to.slice(0, 4))])];

/**
 * "Rever e publicar" — revisão antes de publicar. Rascunhos do período (e
 * do local filtrado) agrupados por dia, recolhíveis; seleção global, por
 * dia (com estado indeterminado) e por turno; alertas que já existem
 * (sobreposição do backend, ausências, feriados) em destaque; filtro Todos /
 * Com alertas; rodapé fixo com a contagem real. Publica só os selecionados
 * — os outros ficam em rascunho, intactos.
 */
export function PublishReviewModal({
  range,
  locationId,
  locationName,
  onClose,
  onPublished,
}: {
  range: { from: string; to: string };
  /** Mesmo filtro de local do alerta "Turnos por publicar" (a contagem e a revisão batem certo). */
  locationId?: string;
  locationName: (id: string) => string;
  onClose: () => void;
  onPublished: (count: number) => void;
}) {
  const { api } = useHrModule();
  const drafts = useQuery({
    queryKey: ["hr-work-shifts-drafts", range.from, range.to, locationId],
    queryFn: () => api.listWorkShifts({ from: range.from, to: range.to, status: "draft", ...(locationId && { locationId }) }),
  });
  // Alertas: a mesma lógica do backend usada em "Alertas e ações" (sem motor novo).
  const alerts = useQuery({
    queryKey: ["hr-schedule-alerts", range.from, range.to, locationId ?? ""],
    queryFn: () => api.getScheduleAlerts(range.from, range.to, locationId),
  });
  const years = yearsOf(range.from, range.to);
  const leaves = useQuery({
    queryKey: ["hr-leave-overview-years", ...years],
    queryFn: async () => (await Promise.all(years.map((y) => api.listLeaveOverview(y)))).flat(),
  });
  const holidays = useQuery({
    queryKey: ["hr-public-holidays-years", ...years],
    queryFn: async () => (await Promise.all(years.map((y) => api.listPublicHolidays(y)))).flat(),
  });

  const days = useMemo(
    () =>
      buildReviewDays(drafts.data ?? [], {
        overlapShiftIds: new Set((alerts.data?.overlaps ?? []).flatMap((o) => o.shiftIds)),
        leaves: leaves.data ?? [],
        holidays: holidays.data ?? [],
      }),
    [drafts.data, alerts.data, leaves.data, holidays.data],
  );
  const summary = reviewSummary(days);
  const allIds = useMemo(() => days.flatMap((d) => d.shifts.map((s) => s.shift.id)), [days]);

  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [collapsedOverride, setCollapsedOverride] = useState<Set<string> | null>(null);
  const collapsed = collapsedOverride ?? initiallyCollapsed(days);
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const selectedIds = allIds.filter((id) => !excluded.has(id));

  const publish = useMutation({
    mutationFn: (ids: string[]) => api.publishWorkShifts(ids),
    onSuccess: (_r, ids) => onPublished(ids.length),
  });

  const setChecked = (ids: string[], on: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  const toggleDay = (workDate: string) => {
    const next = new Set(collapsed);
    if (next.has(workDate)) next.delete(workDate);
    else next.add(workDate);
    setCollapsedOverride(next);
  };
  function confirm() {
    // Proteção contra duplo clique / reenvio: um pedido de cada vez; publicar é idempotente no backend.
    if (publish.isPending || selectedIds.length === 0) return;
    publish.mutate(selectedIds);
  }

  const loading = drafts.isLoading;
  const visibleDays = onlyAlerts ? days.filter((d) => d.alertCount > 0) : days;
  const notPublished = allIds.length - selectedIds.length;
  const tab = (active: boolean) => `rounded-full px-3 py-1 text-xs font-medium ${active ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Rever e publicar turnos">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
        {/* Cabeçalho fixo */}
        <div className="space-y-3 border-b border-stone-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-stone-900">Rever e publicar turnos</h2>
              <p className="text-xs text-stone-500" data-testid="review-summary">
                {summary.shifts} turnos · {summary.days} dias · {summary.employees} colaboradores
                {summary.alerts > 0 && <span className="font-medium text-amber-700"> · {summary.alerts} {summary.alerts === 1 ? "alerta" : "alertas"}</span>}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-md px-2 py-1 text-stone-400 hover:text-stone-700">
              ✕
            </button>
          </div>
          {allIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
                <TriCheckbox state={selectionState(allIds, excluded)} onChange={(on) => setChecked(allIds, on)} label="Selecionar todos" />
                Selecionar todos
              </label>
              <div className="flex gap-1" role="group" aria-label="Filtro">
                <button type="button" aria-pressed={!onlyAlerts} onClick={() => setOnlyAlerts(false)} className={tab(!onlyAlerts)}>
                  Todos
                </button>
                <button type="button" aria-pressed={onlyAlerts} onClick={() => setOnlyAlerts(true)} className={tab(onlyAlerts)}>
                  Com alertas
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lista por dia */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading && <p className="text-sm text-stone-500">A carregar…</p>}
          {drafts.isError && <p className="text-sm text-red-600">Não foi possível carregar os turnos por publicar.</p>}
          {!loading && !drafts.isError && days.length === 0 && <p className="text-sm text-stone-500">Não há turnos por publicar neste período.</p>}
          {onlyAlerts && visibleDays.length === 0 && days.length > 0 && <p className="text-sm text-stone-500">Nenhum turno com alertas.</p>}

          <div className="divide-y divide-stone-100">
            {visibleDays.map((day) => {
              const ids = day.shifts.map((s) => s.shift.id);
              const isCollapsed = collapsed.has(day.workDate);
              const rows = onlyAlerts ? day.shifts.filter((s) => s.alerts.length > 0) : day.shifts;
              return (
                <section key={day.workDate} aria-label={day.header} className="py-2">
                  <div className={`flex items-center gap-2 rounded-md px-1 py-1 ${day.alertCount > 0 ? "bg-amber-50" : ""}`}>
                    <button
                      type="button"
                      onClick={() => toggleDay(day.workDate)}
                      aria-expanded={!isCollapsed}
                      aria-label={`${isCollapsed ? "Expandir" : "Recolher"} ${day.header}`}
                      className="w-5 text-stone-500"
                    >
                      {isCollapsed ? "▶" : "▼"}
                    </button>
                    <TriCheckbox state={selectionState(ids, excluded)} onChange={(on) => setChecked(ids, on)} label={`Selecionar ${day.header}`} />
                    <span className="text-xs font-semibold tracking-wide text-stone-700">{day.header}</span>
                    <span className="ml-auto text-xs font-medium">
                      <span className="text-stone-500">
                        {day.shifts.length} {day.shifts.length === 1 ? "TURNO" : "TURNOS"} ·{" "}
                      </span>
                      {day.alertCount > 0 ? (
                        <span className="text-amber-700">
                          ⚠ {day.alertCount} {day.alertCount === 1 ? "ALERTA" : "ALERTAS"}
                        </span>
                      ) : (
                        <span className="text-emerald-700">✓ PRONTO</span>
                      )}
                    </span>
                  </div>
                  {!isCollapsed && (
                    <>
                      {day.commonLocationId && <p className="pl-14 text-xs text-stone-500">{locationName(day.commonLocationId)}</p>}
                      <ul className="mt-1">
                        {rows.map((r) => (
                          <li key={r.shift.id}>
                            <label className="flex flex-wrap items-start gap-x-3 gap-y-0.5 py-1.5 pl-7 text-sm sm:flex-nowrap">
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={!excluded.has(r.shift.id)}
                                onChange={(e) => setChecked([r.shift.id], e.target.checked)}
                                aria-label={`${r.shortName} ${day.header}`}
                              />
                              <span className="min-w-[9rem] flex-1 font-medium text-stone-800">{r.shortName}</span>
                              <span className="text-right">
                                <span className="whitespace-nowrap text-stone-700">{r.hours}</span>
                                {r.split && <span className="block text-xs text-stone-500">Repartido</span>}
                                {r.showLocation && <span className="block text-xs text-stone-500">{locationName(r.shift.locationId)}</span>}
                                {r.alerts.map((a) => (
                                  <span key={a} className="block text-xs font-medium text-amber-700">
                                    ⚠ {a}
                                  </span>
                                ))}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </section>
              );
            })}
          </div>
          {publish.isError && <p className="mt-3 text-sm text-red-600">Não foi possível publicar. Tente novamente.</p>}
        </div>

        {/* Rodapé fixo */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 px-5 py-3">
          <div className="text-xs text-stone-600" aria-live="polite">
            <p className="font-medium text-stone-800">
              {selectedIds.length} de {allIds.length} turnos selecionados
            </p>
            {notPublished > 0 && <p>{notPublished} não {notPublished === 1 ? "será publicado" : "serão publicados"} (ficam em rascunho)</p>}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={selectedIds.length === 0 || publish.isPending}
              className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {publish.isPending ? "A publicar…" : `Publicar ${selectedIds.length} ${selectedIds.length === 1 ? "turno" : "turnos"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
