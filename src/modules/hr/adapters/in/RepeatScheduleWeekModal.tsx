import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import {
  WEEKDAY_LABELS,
  type PreviewRepeatCalendarWeekResult,
  type RepeatCalendarWeekResult,
  type RepeatMode,
  type Weekday,
} from "../../domain/entities/schedule.ts";

const inputCls =
  "w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30";

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

const STATUS_LABELS: Record<string, string> = {
  available: "Disponível",
  conflict: "Conflito",
  skipped_leave: "Ausência/férias",
  skipped_holiday: "Feriado",
};
const STATUS_DOT: Record<string, string> = {
  available: "bg-emerald-500",
  conflict: "bg-red-500",
  skipped_leave: "bg-sky-400",
  skipped_holiday: "bg-amber-500",
};

interface RepeatScheduleWeekModalProps {
  sourceWeekStartDate: string;
  sourceWeekLabel: string;
  sourceWeekEmployees: Array<{ id: string; fullName: string }>;
  defaultWeeks?: number;
  /** Pré-liga "Alternar turnos" — usado pelo atalho "Copiar semana" (que passou a servir para trocar horários entre colaboradores em vez de duplicar sem propósito). */
  defaultRotate?: boolean;
  onClose: () => void;
  onCompleted: (result: RepeatCalendarWeekResult) => void;
}

export function RepeatScheduleWeekModal({
  sourceWeekStartDate,
  sourceWeekLabel,
  sourceWeekEmployees,
  defaultWeeks = 4,
  defaultRotate = false,
  onClose,
  onCompleted,
}: RepeatScheduleWeekModalProps) {
  const { api } = useHrModule();
  const [mode, setMode] = useState<"whole_week" | "selected_days">("whole_week");
  const [selectedWeekdays, setSelectedWeekdays] = useState<Weekday[]>([0, 1, 2, 3, 4, 5, 6]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    () => new Set(sourceWeekEmployees.map((e) => e.id)),
  );
  const [rotate, setRotate] = useState(defaultRotate);
  const [repeatKind, setRepeatKind] = useState<"weeks" | "until_date">("weeks");
  const [weeksValue, setWeeksValue] = useState(String(defaultWeeks));
  const [untilDateValue, setUntilDateValue] = useState("");
  const [notes, setNotes] = useState("");
  const [force, setForce] = useState(false);
  const [preview, setPreview] = useState<PreviewRepeatCalendarWeekResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const nameById = new Map(sourceWeekEmployees.map((e) => [e.id, e.fullName]));
  const rotationOrder = [...selectedEmployeeIds];

  const weekdays = mode === "whole_week" ? WEEKDAYS : selectedWeekdays;
  const repeat: RepeatMode =
    repeatKind === "weeks" ? { kind: "weeks", weeks: Number(weeksValue) || 1 } : { kind: "until_date", untilDate: untilDateValue };

  function markDirty() {
    setPreview(null);
  }

  function toggleWeekday(weekday: Weekday) {
    setSelectedWeekdays((prev) => (prev.includes(weekday) ? prev.filter((w) => w !== weekday) : [...prev, weekday]));
    markDirty();
  }

  function toggleEmployee(id: string) {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    markDirty();
  }

  function buildValidationError(): string | null {
    if (weekdays.length === 0) return "Escolhe pelo menos um dia da semana";
    if (selectedEmployeeIds.size === 0) return "Escolhe pelo menos um colaborador";
    if (rotate && selectedEmployeeIds.size < 2) return "Alternar turnos exige pelo menos 2 colaboradores selecionados";
    if (repeatKind === "until_date" && !untilDateValue) return "Escolhe a data final da repetição";
    if (repeatKind === "weeks" && (Number(weeksValue) < 1 || Number(weeksValue) > 52)) return "Número de semanas tem de estar entre 1 e 52";
    return null;
  }

  const previewMutation = useMutation({
    mutationFn: () =>
      api.previewRepeatCalendarWeek({
        sourceWeekStartDate,
        weekdays,
        employeeIds: rotationOrder,
        ...(rotate && { rotateEmployees: true }),
        repeat,
      }),
    onSuccess: (result) => {
      setPreview(result);
      setFormError(null);
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Erro ao pré-visualizar a repetição"),
  });

  const createMutation = useMutation({
    mutationFn: (publish: boolean) =>
      api.repeatCalendarWeek({
        sourceWeekStartDate,
        weekdays,
        employeeIds: rotationOrder,
        ...(rotate && { rotateEmployees: true }),
        repeat,
        publish,
        ...(force && { force: true }),
        notes: notes || null,
      }),
    onSuccess: (result) => onCompleted(result),
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Erro ao repetir a escala"),
  });

  function handlePreview() {
    const err = buildValidationError();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    previewMutation.mutate();
  }

  function handleCreate(publish: boolean) {
    const err = buildValidationError();
    if (err) {
      setFormError(err);
      return;
    }
    if (!preview) {
      setFormError("Pré-visualiza antes de criar os turnos");
      return;
    }
    createMutation.mutate(publish);
  }

  const totalToCreate = preview ? (force ? preview.totalAvailable + preview.totalConflicts : preview.totalAvailable) : 0;
  const submitting = createMutation.isPending;

  const allOccurrences = preview
    ? preview.employees
        .flatMap((emp) => emp.locations.flatMap((loc) => loc.occurrences.map((o) => ({ ...o, employeeName: emp.employeeName }))))
        .sort((a, b) => (a.workDate === b.workDate ? a.employeeName.localeCompare(b.employeeName) : a.workDate.localeCompare(b.workDate)))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">{rotate ? "Alternar turnos entre colaboradores" : "Repetir escala"}</h2>
            <p className="text-sm text-stone-500">Semana de origem: {sourceWeekLabel}</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-stone-700">O que repetir</p>
            <div className="flex rounded-md border border-stone-200 bg-stone-50 p-0.5 text-sm">
              <button
                type="button"
                onClick={() => {
                  setMode("whole_week");
                  markDirty();
                }}
                className={`flex-1 rounded px-2 py-1.5 ${mode === "whole_week" ? "bg-white shadow-sm" : "text-stone-500"}`}
              >
                Semana inteira
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("selected_days");
                  markDirty();
                }}
                className={`flex-1 rounded px-2 py-1.5 ${mode === "selected_days" ? "bg-white shadow-sm" : "text-stone-500"}`}
              >
                Dias selecionados
              </button>
            </div>
            {mode === "selected_days" && (
              <div className="mt-2 flex flex-wrap gap-1">
                {WEEKDAYS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => toggleWeekday(w)}
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      selectedWeekdays.includes(w) ? "border-[#ED5C32] bg-[#ED5C32] text-white" : "border-stone-300 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    {WEEKDAY_LABELS[w]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-stone-700">Colaboradores encontrados na semana</p>
            {sourceWeekEmployees.length === 0 ? (
              <p className="text-xs text-stone-400">Sem turnos nesta semana para repetir.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sourceWeekEmployees.map((emp) => (
                  <label key={emp.id} className="flex items-center gap-1.5 rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-700">
                    <input type="checkbox" checked={selectedEmployeeIds.has(emp.id)} onChange={() => toggleEmployee(emp.id)} />
                    {emp.fullName}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border border-stone-200 bg-stone-50 p-2.5">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={rotate}
                onChange={(e) => {
                  setRotate(e.target.checked);
                  markDirty();
                }}
              />
              Alternar turnos entre os colaboradores selecionados
            </label>
            <p className="mt-1 text-xs text-stone-500">
              Em vez de cada colaborador repetir o seu próprio horário, cada um passa a receber o horário do seguinte
              na lista (com 2 colaboradores, é uma troca simples).
            </p>
            {rotate && rotationOrder.length >= 2 && (
              <p className="mt-1 text-xs font-medium text-stone-600">
                Ordem da troca: {rotationOrder.map((id) => nameById.get(id) ?? id).join(" → ")} → {nameById.get(rotationOrder[0]!) ?? rotationOrder[0]}
              </p>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-stone-700">Repetir por</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={repeatKind}
                onChange={(e) => {
                  setRepeatKind(e.target.value as typeof repeatKind);
                  markDirty();
                }}
                className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
              >
                <option value="weeks">Por semanas</option>
                <option value="until_date">Até uma data</option>
              </select>
              {repeatKind === "weeks" && (
                <>
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setWeeksValue(String(n));
                        markDirty();
                      }}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        weeksValue === String(n) ? "border-[#ED5C32] bg-[#ED5C32]/10 text-[#ED5C32]" : "border-stone-300 text-stone-600"
                      }`}
                    >
                      {n} sem.
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={weeksValue}
                    onChange={(e) => {
                      setWeeksValue(e.target.value);
                      markDirty();
                    }}
                    className="w-16 rounded-md border border-stone-300 px-2 py-1 text-sm"
                  />
                </>
              )}
              {repeatKind === "until_date" && (
                <input
                  type="date"
                  value={untilDateValue}
                  onChange={(e) => {
                    setUntilDateValue(e.target.value);
                    markDirty();
                  }}
                  className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
                />
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Notas (opcional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewMutation.isPending}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              {previewMutation.isPending ? "A calcular…" : "Pré-visualizar"}
            </button>
            {preview && (
              <span className="text-xs text-stone-500">
                Destino: {preview.targetStartDate} → {preview.targetEndDate} · {preview.totalAvailable} previstos
                {preview.totalConflicts > 0 && ` · ${preview.totalConflicts} conflito(s)`}
                {preview.totalSkipped > 0 && ` · ${preview.totalSkipped} ignorado(s) (férias/feriado)`}
              </span>
            )}
          </div>

          {preview && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {preview.employees.map((emp) => (
                  <span key={emp.employeeId} className="rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-600">
                    {emp.employeeName}: {emp.availableCount} disponível(eis)
                    {emp.conflictCount > 0 && ` · ${emp.conflictCount} conflito(s)`}
                  </span>
                ))}
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border border-stone-100">
                <ul className="divide-y divide-stone-50 text-xs">
                  {allOccurrences.map((o, i) => (
                    <li key={i} className="flex items-center gap-2 px-2 py-1">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[o.status]}`} />
                      <span className="w-24 shrink-0 text-stone-600">{o.workDate}</span>
                      <span className="w-28 shrink-0 truncate text-stone-600">{o.employeeName}</span>
                      <span className="text-stone-500">
                        {o.segments.map((s) => `${s.startTime}–${s.endTime}`).join(" + ")}
                        {o.endsNextDay && " (+1 dia)"}
                      </span>
                      <span className="ml-auto shrink-0 text-stone-400">{STATUS_LABELS[o.status]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {preview && preview.totalConflicts > 0 && (
            <label className="flex items-center gap-2 text-xs text-stone-600">
              <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
              Criar também os {preview.totalConflicts} turno(s) em conflito
            </label>
          )}

          {formError && <p className="text-xs text-red-600">{formError}</p>}
        </div>

        <div className="flex gap-2 border-t border-stone-100 px-5 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => handleCreate(false)}
            disabled={submitting || !preview}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            Guardar rascunho
          </button>
          <button
            onClick={() => handleCreate(true)}
            disabled={submitting || !preview || totalToCreate === 0}
            className="flex-1 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "A criar…" : `Criar ${totalToCreate} turno(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
