import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import { LocationSelect } from "../../../../components/LocationSelect.tsx";
import { WEEKDAY_LABELS, type Weekday } from "../../domain/entities/schedule.ts";

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

function emptyCellForm() {
  return { isDayOff: false, startTime: "09:00", endTime: "17:00", locationId: null as string | null };
}

export function BaseScheduleModal({
  employeeId,
  employeeName,
  weekStartDate,
  onClose,
  onApplied,
}: {
  employeeId: string;
  employeeName: string;
  weekStartDate: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const [editingWeekday, setEditingWeekday] = useState<Weekday | null>(null);
  const [form, setForm] = useState(emptyCellForm());
  const [applyResult, setApplyResult] = useState<string | null>(null);
  const [overrideExceptions, setOverrideExceptions] = useState(false);

  const { data: cells = [] } = useQuery({
    queryKey: ["hr-base-schedule", employeeId],
    queryFn: () => api.getBaseSchedule(employeeId),
  });
  const cellByWeekday = new Map(cells.map((c) => [c.weekday, c]));

  const upsertMutation = useMutation({
    mutationFn: (payload: Parameters<typeof api.upsertBaseScheduleCell>[1]) =>
      api.upsertBaseScheduleCell(employeeId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-base-schedule", employeeId] });
      setEditingWeekday(null);
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => api.applyBaseSchedule(employeeId, weekStartDate, overrideExceptions),
    onSuccess: (result) => {
      setApplyResult(
        `${result.created.length} criado(s), ${result.updated.length} atualizado(s), ${result.skippedDates.length} dia(s) preservado(s)/salto(s).`,
      );
      onApplied();
    },
  });

  function startEdit(weekday: Weekday) {
    const existing = cellByWeekday.get(weekday);
    setForm(
      existing
        ? {
            isDayOff: existing.isDayOff,
            startTime: existing.startTime ?? "09:00",
            endTime: existing.endTime ?? "17:00",
            locationId: existing.locationId,
          }
        : emptyCellForm(),
    );
    setEditingWeekday(weekday);
  }

  function saveCell() {
    if (editingWeekday === null) return;
    upsertMutation.mutate({
      weekday: editingWeekday,
      isDayOff: form.isDayOff,
      ...(!form.isDayOff && { startTime: form.startTime, endTime: form.endTime, locationId: form.locationId ?? undefined }),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/30 p-4 motion-safe:animate-motion-fade" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2.5xl border border-line bg-surface-card shadow-pop motion-safe:animate-motion-pop-in">
        <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-navy-900">Escala base — {employeeName}</h2>
            <p className="text-sm text-ink-secondary">Modelo semanal aplicável a qualquer semana</p>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-secondary">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 px-5 py-4">
          {WEEKDAYS.map((weekday) => {
            const cell = cellByWeekday.get(weekday);
            const isEditing = editingWeekday === weekday;
            return (
              <div key={weekday} className="rounded-xl border border-line p-2 text-center text-xs">
                <p className="mb-1 font-semibold text-ink-secondary">{WEEKDAY_LABELS[weekday]}</p>
                {isEditing ? (
                  <div className="space-y-1 text-left">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={form.isDayOff}
                        onChange={(e) => setForm((f) => ({ ...f, isDayOff: e.target.checked }))}
                      />
                      Folga
                    </label>
                    {!form.isDayOff && (
                      <>
                        <input
                          type="time"
                          value={form.startTime}
                          onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                          className="w-full rounded border border-line px-1 py-0.5 text-xs"
                        />
                        <input
                          type="time"
                          value={form.endTime}
                          onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                          className="w-full rounded border border-line px-1 py-0.5 text-xs"
                        />
                        <LocationSelect value={form.locationId} onChange={(id) => setForm((f) => ({ ...f, locationId: id }))} />
                      </>
                    )}
                    <div className="flex gap-1">
                      <button
                        onClick={saveCell}
                        disabled={upsertMutation.isPending}
                        className="flex-1 rounded bg-brand-600 px-1 py-0.5 text-white"
                      >
                        Ok
                      </button>
                      <button onClick={() => setEditingWeekday(null)} className="flex-1 rounded border border-line">
                        X
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => startEdit(weekday)} className="block w-full rounded p-1 hover:bg-surface-soft">
                    {!cell ? (
                      <span className="text-stone-300">—</span>
                    ) : cell.isDayOff ? (
                      <span className="text-ink-muted">Folga</span>
                    ) : (
                      <span className="text-ink">
                        {cell.startTime}
                        <br />
                        {cell.endTime}
                      </span>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-2 border-t border-line-subtle px-5 py-4">
          <label className="flex items-center gap-2 text-xs text-ink-secondary">
            <input type="checkbox" checked={overrideExceptions} onChange={(e) => setOverrideExceptions(e.target.checked)} />
            Sobrepor turnos já editados manualmente nesta semana
          </label>
          {applyResult && <p className="text-xs text-emerald-700">{applyResult}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-soft">
              Fechar
            </button>
            <button
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending}
              className="rounded-xl bg-brand-600 hover:bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {applyMutation.isPending ? "A aplicar…" : "Aplicar esta escala à semana"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
