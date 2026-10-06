import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import { groupDraftsByDay, reviewShiftHours } from "../../domain/services/publish-review.service.ts";

/**
 * "Rever e publicar" — passo de revisão antes de publicar: lista os turnos
 * em rascunho do período (por dia), todos selecionados por omissão; o
 * gestor desmarca o que ainda não quer publicar e confirma. Só depois de
 * publicados os turnos aparecem ao colaborador (Portal).
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
  const { data: shifts = [], isLoading, isError } = useQuery({
    queryKey: ["hr-work-shifts-drafts", range.from, range.to, locationId],
    queryFn: () => api.listWorkShifts({ from: range.from, to: range.to, status: "draft", ...(locationId && { locationId }) }),
  });
  const days = groupDraftsByDay(shifts);
  const allIds = days.flatMap((d) => d.shifts.map((s) => s.id));
  // Por omissão todos selecionados; guarda só os que o gestor desmarcou.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const selected = allIds.filter((id) => !excluded.has(id));

  const publish = useMutation({
    mutationFn: (ids: string[]) => api.publishWorkShifts(ids),
    onSuccess: (_r, ids) => onPublished(ids.length),
  });

  const toggle = (ids: string[], on: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Rever e publicar turnos">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Rever e publicar turnos</h2>
            <p className="text-xs text-stone-500">Depois de publicados, os colaboradores passam a vê-los no Portal. Desmarque o que ainda não quer publicar.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-md px-2 py-1 text-stone-400 hover:text-stone-700">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && <p className="text-sm text-stone-500">A carregar…</p>}
          {isError && <p className="text-sm text-red-600">Não foi possível carregar os turnos por publicar.</p>}
          {!isLoading && !isError && days.length === 0 && <p className="text-sm text-stone-500">Não há turnos por publicar neste período.</p>}
          {days.length > 0 && (
            <label className="mb-3 flex items-center gap-2 text-sm font-medium text-stone-700">
              <input type="checkbox" checked={selected.length === allIds.length} onChange={(e) => toggle(allIds, e.target.checked)} />
              Selecionar todos ({allIds.length})
            </label>
          )}
          <div className="space-y-4">
            {days.map((day) => {
              const ids = day.shifts.map((s) => s.id);
              const dayAll = ids.every((id) => !excluded.has(id));
              return (
                <section key={day.workDate} aria-label={day.label}>
                  <label className="flex items-center gap-2 border-b border-stone-100 pb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
                    <input type="checkbox" checked={dayAll} onChange={(e) => toggle(ids, e.target.checked)} aria-label={`Selecionar ${day.label}`} />
                    {day.label} · {day.shifts.length}
                  </label>
                  <ul className="divide-y divide-stone-100">
                    {day.shifts.map((s) => (
                      <li key={s.id}>
                        <label className="flex items-center gap-3 py-2 text-sm">
                          <input type="checkbox" checked={!excluded.has(s.id)} onChange={(e) => toggle([s.id], e.target.checked)} aria-label={`${s.employeeName} ${day.label}`} />
                          <span className="min-w-0 flex-1 font-medium text-stone-800">{s.employeeName}</span>
                          <span className="whitespace-nowrap text-stone-600">{reviewShiftHours(s)}</span>
                          <span className="hidden w-40 truncate text-right text-xs text-stone-500 sm:block">{locationName(s.locationId)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
          {publish.isError && <p className="mt-3 text-sm text-red-600">Não foi possível publicar. Tente novamente.</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-stone-100 px-6 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => publish.mutate(selected)}
            disabled={selected.length === 0 || publish.isPending}
            className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {publish.isPending ? "A publicar…" : `Publicar ${selected.length} turno(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
