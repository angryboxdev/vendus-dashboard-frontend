import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import { LocationSelect } from "../../../../components/LocationSelect.tsx";
import { ShiftSeriesForm } from "./ShiftSeriesForm.tsx";
import type {
  CreateWorkShiftPayload,
  CreateWorkShiftSeriesResult,
  SeriesEditScope,
  UpdateWorkShiftPayload,
  UpdateWorkShiftSeriesScopePayload,
  WorkShift,
} from "../../domain/entities/schedule.ts";

const inputCls =
  "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30";
const labelCls = "mb-1.5 block text-sm font-medium text-stone-700";

const SCOPE_OPTIONS: Array<{ value: SeriesEditScope; label: string }> = [
  { value: "only_this", label: "Somente este turno" },
  { value: "this_and_following", label: "Este turno e os seguintes" },
  { value: "whole_series", label: "Toda a série" },
];

interface ShiftDrawerProps {
  open: boolean;
  editing: WorkShift | null;
  /** Pré-selecionado quando aberto a partir de um filtro de colaborador; ignorado em modo edição. */
  defaultEmployeeId?: string | null;
  defaultWorkDate?: string | null;
  onClose: () => void;
  onCreate: (payload: CreateWorkShiftPayload) => void;
  onUpdate: (id: string, payload: UpdateWorkShiftPayload) => void;
  onUpdateSeriesScope: (id: string, payload: UpdateWorkShiftSeriesScopePayload) => void;
  onSeriesCreated: (result: CreateWorkShiftSeriesResult) => void;
  onClearSeries: (seriesId: string) => void;
  onDuplicate: (id: string, targetDate: string) => void;
  onDelete: (id: string) => void;
  saving: boolean;
  error: string | null;
}

export function ShiftDrawer({
  open,
  editing,
  defaultEmployeeId,
  defaultWorkDate,
  onClose,
  onCreate,
  onUpdate,
  onUpdateSeriesScope,
  onSeriesCreated,
  onClearSeries,
  onDuplicate,
  onDelete,
  saving,
  error,
}: ShiftDrawerProps) {
  const { api } = useHrModule();
  const isEdit = editing !== null;

  const { data: employeesResult } = useQuery({
    queryKey: ["hr-people-list", { status: "active", page: 1, pageSize: 200 }],
    queryFn: () => api.listEmployees({ status: "active", page: 1, pageSize: 200 }),
    enabled: open && !isEdit,
  });
  const employees = employeesResult?.items ?? [];

  const [employeeId, setEmployeeId] = useState(editing?.employeeId ?? defaultEmployeeId ?? "");
  const [workDate, setWorkDate] = useState(editing?.workDate ?? defaultWorkDate ?? "");
  const [kind, setKind] = useState<"direct" | "split">(editing?.secondStartTime ? "split" : "direct");
  const [startTime, setStartTime] = useState(editing?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(editing?.endTime ?? "17:00");
  const [secondStartTime, setSecondStartTime] = useState(editing?.secondStartTime ?? "19:00");
  const [secondEndTime, setSecondEndTime] = useState(editing?.secondEndTime ?? "23:00");
  const [locationId, setLocationId] = useState<string | null>(editing?.locationId ?? null);
  const [breakMinutes, setBreakMinutes] = useState(String(editing?.breakMinutes ?? 0));
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [publishAfterSave, setPublishAfterSave] = useState(editing ? editing.status === "published" : true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearSeriesConfirm, setShowClearSeriesConfirm] = useState(false);
  const [duplicateDate, setDuplicateDate] = useState("");
  const [scope, setScope] = useState<SeriesEditScope>("only_this");

  useEffect(() => {
    if (!open) return;
    setEmployeeId(editing?.employeeId ?? defaultEmployeeId ?? "");
    setWorkDate(editing?.workDate ?? defaultWorkDate ?? "");
    setKind(editing?.secondStartTime ? "split" : "direct");
    setStartTime(editing?.startTime ?? "09:00");
    setEndTime(editing?.endTime ?? "17:00");
    setSecondStartTime(editing?.secondStartTime ?? "19:00");
    setSecondEndTime(editing?.secondEndTime ?? "23:00");
    setLocationId(editing?.locationId ?? null);
    setBreakMinutes(String(editing?.breakMinutes ?? 0));
    setNotes(editing?.notes ?? "");
    setRepeatEnabled(false);
    setPublishAfterSave(editing ? editing.status === "published" : true);
    setShowDeleteConfirm(false);
    setShowClearSeriesConfirm(false);
    setDuplicateDate("");
    setScope("only_this");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  if (!open) return null;

  // Fim antes do início = passa da meia-noite (ex.: 18:00–01:30) — automático, sem caixa para marcar.
  const endsNextDay = kind === "direct" && endTime < startTime;
  const timeOrderValid = endsNextDay || startTime < endTime;
  const secondSegmentValid = kind === "direct" || (secondStartTime < secondEndTime && secondStartTime >= endTime);
  const formValid = timeOrderValid && secondSegmentValid;
  const editingSeriesId = editing?.seriesId ?? null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formValid) return;
    const segmentFields = {
      endsNextDay,
      secondStartTime: kind === "split" ? secondStartTime : null,
      secondEndTime: kind === "split" ? secondEndTime : null,
    };
    if (isEdit) {
      if (editingSeriesId && scope !== "only_this") {
        onUpdateSeriesScope(editing!.id, {
          scope,
          startTime,
          endTime,
          ...segmentFields,
          ...(locationId && { locationId }),
          notes: notes || null,
        });
        return;
      }
      onUpdate(editing!.id, {
        workDate,
        startTime,
        endTime,
        ...segmentFields,
        ...(locationId && { locationId }),
        breakMinutes: Number(breakMinutes) || 0,
        notes: notes || null,
      });
    } else {
      if (!employeeId || !locationId) return;
      onCreate({
        employeeId,
        workDate,
        startTime,
        endTime,
        ...segmentFields,
        locationId,
        breakMinutes: Number(breakMinutes) || 0,
        notes: notes || null,
        publish: publishAfterSave,
      });
    }
  }

  const showSeriesForm = !isEdit && repeatEnabled && !!employeeId && !!locationId && !!workDate;
  const editingScopeAppliesToSeries = isEdit && editingSeriesId && scope !== "only_this";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-y-auto bg-white shadow-2xl ${
          showSeriesForm ? "max-w-xl" : "max-w-md"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#F5C992]/40 px-5 py-4">
          <h2 className="text-base font-semibold text-stone-900">{isEdit ? "Editar turno" : "Novo turno"}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-5 py-4">
          {!isEdit && (
            <div>
              <label className={labelCls}>Colaborador</label>
              <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required className={inputCls}>
                <option value="">— selecionar —</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Data</label>
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              required
              disabled={!!editingScopeAppliesToSeries}
              className={`${inputCls} disabled:bg-stone-50 disabled:text-stone-400`}
            />
            {editingScopeAppliesToSeries && (
              <p className="mt-1 text-[11px] text-stone-400">A data não pode ser alterada ao editar mais do que este turno.</p>
            )}
          </div>

          {!showSeriesForm && (
            <>
              <div className="flex rounded-md border border-stone-200 bg-stone-50 p-0.5 text-sm">
                <button
                  type="button"
                  onClick={() => setKind("direct")}
                  className={`flex-1 rounded px-2 py-1.5 ${kind === "direct" ? "bg-white shadow-sm" : "text-stone-500"}`}
                >
                  Turno direto
                </button>
                <button
                  type="button"
                  onClick={() => setKind("split")}
                  className={`flex-1 rounded px-2 py-1.5 ${kind === "split" ? "bg-white shadow-sm" : "text-stone-500"}`}
                >
                  Turno repartido
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Hora inicial</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Hora final</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required className={inputCls} />
                </div>
              </div>
              {endsNextDay && (
                <p className="-mt-2 text-xs text-stone-500">Termina no dia seguinte (+1 dia) — conta como um só turno, no dia em que começa.</p>
              )}
              {!timeOrderValid && (
                <p className="-mt-2 text-xs text-red-600">
                  {kind === "split" ? "A hora final tem de ser depois da inicial." : "A hora final tem de ser diferente da inicial."}
                </p>
              )}

              {kind === "split" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>2º período — início</label>
                      <input
                        type="time"
                        value={secondStartTime}
                        onChange={(e) => setSecondStartTime(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>2º período — fim</label>
                      <input type="time" value={secondEndTime} onChange={(e) => setSecondEndTime(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  {!secondSegmentValid && <p className="-mt-2 text-xs text-red-600">O 2º período tem de ser depois do 1º, sem sobreposição.</p>}
                </>
              )}

              <LocationSelect value={locationId} onChange={setLocationId} label="Local" />

              <div>
                <label className={labelCls}>Pausa (minutos)</label>
                <input
                  type="number"
                  min={0}
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Notas (opcional)</label>
                <textarea
                  value={notes ?? ""}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </>
          )}

          {!isEdit && (
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input type="checkbox" checked={repeatEnabled} onChange={(e) => setRepeatEnabled(e.target.checked)} />
              Repetir este horário
            </label>
          )}

          {showSeriesForm && (
            <ShiftSeriesForm
              employeeId={employeeId}
              locationId={locationId}
              startDate={workDate}
              initialSegments={kind === "split" ? [{ startTime, endTime }, { startTime: secondStartTime, endTime: secondEndTime }] : [{ startTime, endTime }]}
              initialEndsNextDay={endsNextDay}
              onCancel={() => setRepeatEnabled(false)}
              onCreated={onSeriesCreated}
            />
          )}

          {!showSeriesForm && (
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input type="checkbox" checked={publishAfterSave} onChange={(e) => setPublishAfterSave(e.target.checked)} />
              Publicar após guardar
            </label>
          )}

          {isEdit && editingSeriesId && (
            <div className="rounded-md border border-stone-200 bg-stone-50 p-2.5">
              <p className={labelCls}>Este turno faz parte de uma série. Aplicar a:</p>
              <div className="space-y-1">
                {SCOPE_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm text-stone-600">
                    <input
                      type="radio"
                      name="series-scope"
                      checked={scope === opt.value}
                      onChange={() => setScope(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          {!showSeriesForm && (
            <div className="mt-auto flex flex-col gap-2 border-t border-stone-100 pt-4">
              {isEdit && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={duplicateDate}
                    onChange={(e) => setDuplicateDate(e.target.value)}
                    className="flex-1 rounded-md border border-stone-300 px-2 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    disabled={!duplicateDate}
                    onClick={() => duplicateDate && onDuplicate(editing!.id, duplicateDate)}
                    className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                  >
                    Duplicar para…
                  </button>
                </div>
              )}
              {isEdit && editingSeriesId && (
                <div className="flex items-center gap-2">
                  {showClearSeriesConfirm ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onClearSeries(editingSeriesId)}
                        className="flex-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                      >
                        Confirmar: limpar toda a série
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowClearSeriesConfirm(false)}
                        className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowClearSeriesConfirm(true)}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Limpar toda a série
                    </button>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                {isEdit &&
                  (showDeleteConfirm ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onDelete(editing!.id)}
                        className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                      >
                        Confirmar exclusão
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Apagar turno
                    </button>
                  ))}
                {!showDeleteConfirm && (
                  <>
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !formValid}
                      className="flex-1 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {saving ? "A guardar…" : "Guardar turno"}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </form>
      </aside>
    </>
  );
}
