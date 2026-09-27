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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Escala base — {employeeName}</h2>
            <p className="text-sm text-stone-500">Modelo semanal aplicável a qualquer semana</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 px-5 py-4">
          {WEEKDAYS.map((weekday) => {
            const cell = cellByWeekday.get(weekday);
            const isEditing = editingWeekday === weekday;
            return (
              <div key={weekday} className="rounded-lg border border-stone-200 p-2 text-center text-xs">
                <p className="mb-1 font-semibold text-stone-600">{WEEKDAY_LABELS[weekday]}</p>
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
                          className="w-full rounded border border-stone-300 px-1 py-0.5 text-xs"
                        />
                        <input
                          type="time"
                          value={form.endTime}
                          onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                          className="w-full rounded border border-stone-300 px-1 py-0.5 text-xs"
                        />
                        <LocationSelect value={form.locationId} onChange={(id) => setForm((f) => ({ ...f, locationId: id }))} />
                      </>
                    )}
                    <div className="flex gap-1">
                      <button
                        onClick={saveCell}
                        disabled={upsertMutation.isPending}
                        className="flex-1 rounded bg-[#ED5C32] px-1 py-0.5 text-white"
                      >
                        Ok
                      </button>
                      <button onClick={() => setEditingWeekday(null)} className="flex-1 rounded border border-stone-300">
                        X
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => startEdit(weekday)} className="block w-full rounded p-1 hover:bg-stone-50">
                    {!cell ? (
                      <span className="text-stone-300">—</span>
                    ) : cell.isDayOff ? (
                      <span className="text-stone-400">Folga</span>
                    ) : (
                      <span className="text-stone-700">
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

        <div className="space-y-2 border-t border-stone-100 px-5 py-4">
          <label className="flex items-center gap-2 text-xs text-stone-600">
            <input type="checkbox" checked={overrideExceptions} onChange={(e) => setOverrideExceptions(e.target.checked)} />
            Sobrepor turnos já editados manualmente nesta semana
          </label>
          {applyResult && <p className="text-xs text-emerald-700">{applyResult}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
              Fechar
            </button>
            <button
              onClick={() => applyMutation.mutate()}
              disabled={applyMutation.isPending}
              className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {applyMutation.isPending ? "A aplicar…" : "Aplicar esta escala à semana"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
