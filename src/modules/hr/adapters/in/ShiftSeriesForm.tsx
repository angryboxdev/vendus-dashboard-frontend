import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import {
  WEEKDAY_LABELS,
  type CreateWorkShiftSeriesResult,
  type PlannedOccurrence,
  type PreviewWorkShiftSeriesResult,
  type RepeatMode,
  type ShiftSegment,
  type Weekday,
  type WeeklyDayRule,
} from "../../domain/entities/schedule.ts";

const inputCls =
  "w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30";

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

const STATUS_LABELS: Record<PlannedOccurrence["status"], string> = {
  available: "Disponível",
  conflict: "Conflito",
  skipped_leave: "Ausência/férias",
  skipped_holiday: "Feriado",
};
const STATUS_DOT: Record<PlannedOccurrence["status"], string> = {
  available: "bg-emerald-500",
  conflict: "bg-red-500",
  skipped_leave: "bg-sky-400",
  skipped_holiday: "bg-amber-500",
};

interface RuleForm {
  id: string;
  weekdays: Weekday[];
  kind: "direct" | "split";
  seg1Start: string;
  seg1End: string;
  seg2Start: string;
  seg2End: string;
  endsNextDay: boolean;
}

function newRule(seed: Partial<RuleForm> = {}): RuleForm {
  return {
    id: crypto.randomUUID(),
    weekdays: [],
    kind: "direct",
    seg1Start: "09:00",
    seg1End: "17:00",
    seg2Start: "19:00",
    seg2End: "23:00",
    endsNextDay: false,
    ...seed,
  };
}

function ruleWeekdaysUsedElsewhere(rules: RuleForm[], currentId: string): Set<Weekday> {
  const used = new Set<Weekday>();
  for (const r of rules) {
    if (r.id === currentId) continue;
    for (const w of r.weekdays) used.add(w);
  }
  return used;
}

function validateRule(r: RuleForm): string | null {
  if (r.weekdays.length === 0) return "Escolhe pelo menos um dia da semana para cada horário";
  if (!r.endsNextDay && r.seg1Start >= r.seg1End) return "A hora final tem de ser depois da inicial";
  if (r.kind === "split") {
    if (r.seg2Start >= r.seg2End) return "No 2º período, a hora final tem de ser depois da inicial";
    if (r.seg2Start < r.seg1End) return "O 2º período não pode sobrepor o 1º";
  }
  return null;
}

function toRuleDTO(r: RuleForm): WeeklyDayRule {
  const segments: ShiftSegment[] = [{ startTime: r.seg1Start, endTime: r.seg1End }];
  if (r.kind === "split") segments.push({ startTime: r.seg2Start, endTime: r.seg2End });
  return { weekdays: r.weekdays, segments, ...(r.endsNextDay && { endsNextDay: true }) };
}

interface ShiftSeriesFormProps {
  employeeId: string;
  locationId: string | null;
  startDate: string;
  initialSegments: ShiftSegment[];
  initialEndsNextDay: boolean;
  onCancel: () => void;
  onCreated: (result: CreateWorkShiftSeriesResult) => void;
}

export function ShiftSeriesForm({
  employeeId,
  locationId,
  startDate,
  initialSegments,
  initialEndsNextDay,
  onCancel,
  onCreated,
}: ShiftSeriesFormProps) {
  const { api } = useHrModule();

  const [rules, setRules] = useState<RuleForm[]>(() => [
    newRule({
      seg1Start: initialSegments[0]?.startTime ?? "09:00",
      seg1End: initialSegments[0]?.endTime ?? "17:00",
      kind: initialSegments[1] ? "split" : "direct",
      seg2Start: initialSegments[1]?.startTime ?? "19:00",
      seg2End: initialSegments[1]?.endTime ?? "23:00",
      endsNextDay: initialEndsNextDay,
    }),
  ]);
  const [repeatKind, setRepeatKind] = useState<"none" | "weeks" | "until_date">("weeks");
  const [weeksValue, setWeeksValue] = useState("4");
  const [untilDateValue, setUntilDateValue] = useState("");
  const [notes, setNotes] = useState("");
  const [force, setForce] = useState(false);
  const [preview, setPreview] = useState<PreviewWorkShiftSeriesResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const repeat: RepeatMode = useMemo(() => {
    if (repeatKind === "weeks") return { kind: "weeks", weeks: Number(weeksValue) || 1 };
    if (repeatKind === "until_date") return { kind: "until_date", untilDate: untilDateValue };
    return { kind: "none" };
  }, [repeatKind, weeksValue, untilDateValue]);

  function markDirty() {
    setPreview(null);
  }

  function updateRule(id: string, patch: Partial<RuleForm>) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    markDirty();
  }

  function toggleWeekday(ruleId: string, weekday: Weekday) {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id !== ruleId) return r;
        const has = r.weekdays.includes(weekday);
        return { ...r, weekdays: has ? r.weekdays.filter((w) => w !== weekday) : [...r.weekdays, weekday] };
      }),
    );
    markDirty();
  }

  function addRule() {
    setRules((prev) => [...prev, newRule()]);
    markDirty();
  }

  function removeRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    markDirty();
  }

  function buildValidationError(): string | null {
    if (!locationId) return "Escolhe uma loja";
    if (rules.length === 0) return "Adiciona pelo menos um horário";
    for (const r of rules) {
      const err = validateRule(r);
      if (err) return err;
    }
    if (repeatKind === "until_date" && !untilDateValue) return "Escolhe a data final da repetição";
    if (repeatKind === "weeks" && (Number(weeksValue) < 1 || Number(weeksValue) > 52)) return "Número de semanas tem de estar entre 1 e 52";
    return null;
  }

  const previewMutation = useMutation({
    mutationFn: () =>
      api.previewWorkShiftSeries({
        employeeId,
        locationId: locationId!,
        startDate,
        rules: rules.map(toRuleDTO),
        repeat,
      }),
    onSuccess: (result) => {
      setPreview(result);
      setFormError(null);
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Erro ao pré-visualizar o padrão"),
  });

  const createMutation = useMutation({
    mutationFn: (publish: boolean) =>
      api.createWorkShiftSeries({
        employeeId,
        locationId: locationId!,
        startDate,
        rules: rules.map(toRuleDTO),
        repeat,
        publish,
        ...(force && { force: true }),
        notes: notes || null,
      }),
    onSuccess: (result) => onCreated(result),
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Erro ao criar os turnos"),
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
      setFormError("Pré-visualiza o padrão antes de criar os turnos");
      return;
    }
    createMutation.mutate(publish);
  }

  const totalToCreate = preview ? (force ? preview.availableCount + preview.conflictCount : preview.availableCount) : 0;
  const submitting = createMutation.isPending;

  return (
    <div className="space-y-4 rounded-lg border border-[#F5C992]/50 bg-[#FFFBF6] p-3">
      <div>
        <p className="mb-2 text-sm font-medium text-stone-700">Horários da semana</p>
        <div className="space-y-3">
          {rules.map((r, idx) => {
            const usedElsewhere = ruleWeekdaysUsedElsewhere(rules, r.id);
            return (
              <div key={r.id} className="rounded-md border border-stone-200 bg-white p-2.5">
                <div className="mb-2 flex flex-wrap gap-1">
                  {WEEKDAYS.map((w) => {
                    const active = r.weekdays.includes(w);
                    const disabled = !active && usedElsewhere.has(w);
                    return (
                      <button
                        key={w}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleWeekday(r.id, w)}
                        title={disabled ? "Já usado noutro horário desta semana" : undefined}
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          active
                            ? "border-[#ED5C32] bg-[#ED5C32] text-white"
                            : disabled
                              ? "border-stone-100 bg-stone-50 text-stone-300"
                              : "border-stone-300 text-stone-600 hover:bg-stone-50"
                        }`}
                      >
                        {WEEKDAY_LABELS[w]}
                      </button>
                    );
                  })}
                  {rules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRule(r.id)}
                      className="ml-auto text-xs text-stone-400 hover:text-red-600"
                    >
                      Remover
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-md border border-stone-200 bg-stone-50 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => updateRule(r.id, { kind: "direct" })}
                      className={`rounded px-2 py-1 ${r.kind === "direct" ? "bg-white shadow-sm" : "text-stone-500"}`}
                    >
                      Turno direto
                    </button>
                    <button
                      type="button"
                      onClick={() => updateRule(r.id, { kind: "split" })}
                      className={`rounded px-2 py-1 ${r.kind === "split" ? "bg-white shadow-sm" : "text-stone-500"}`}
                    >
                      Turno repartido
                    </button>
                  </div>
                  <label className="flex items-center gap-1 text-xs text-stone-600">
                    <input
                      type="checkbox"
                      checked={r.endsNextDay}
                      disabled={r.kind === "split"}
                      onChange={(e) => updateRule(r.id, { endsNextDay: e.target.checked })}
                    />
                    Termina no dia seguinte
                  </label>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input type="time" value={r.seg1Start} onChange={(e) => updateRule(r.id, { seg1Start: e.target.value })} className={inputCls} />
                  <input type="time" value={r.seg1End} onChange={(e) => updateRule(r.id, { seg1End: e.target.value })} className={inputCls} />
                </div>
                {r.kind === "split" && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input type="time" value={r.seg2Start} onChange={(e) => updateRule(r.id, { seg2Start: e.target.value })} className={inputCls} />
                    <input type="time" value={r.seg2End} onChange={(e) => updateRule(r.id, { seg2End: e.target.value })} className={inputCls} />
                  </div>
                )}
                {validateRule(r) && r.weekdays.length > 0 && (
                  <p className="mt-1 text-[11px] text-red-600">{validateRule(r)}</p>
                )}
                <p className="mt-1 text-[11px] text-stone-400">Horário {idx + 1}</p>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={addRule} className="mt-2 text-xs font-medium text-[#ED5C32] hover:underline">
          + Adicionar outro horário
        </button>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-stone-700">Repetição</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={repeatKind}
            onChange={(e) => {
              setRepeatKind(e.target.value as typeof repeatKind);
              markDirty();
            }}
            className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
          >
            <option value="none">Só esta semana</option>
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
            {preview.availableCount} disponíveis
            {preview.conflictCount > 0 && ` · ${preview.conflictCount} conflito(s)`}
            {preview.skippedCount > 0 && ` · ${preview.skippedCount} ignorado(s) (férias/feriado)`}
          </span>
        )}
      </div>

      {preview && (
        <div className="max-h-48 overflow-y-auto rounded-md border border-stone-100">
          <ul className="divide-y divide-stone-50 text-xs">
            {preview.occurrences.map((o) => (
              <li key={o.workDate} className="flex items-center gap-2 px-2 py-1">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[o.status]}`} />
                <span className="w-24 shrink-0 text-stone-600">{o.workDate}</span>
                <span className="text-stone-500">
                  {o.segments.map((s) => `${s.startTime}–${s.endTime}`).join(" + ")}
                  {o.endsNextDay && " (+1 dia)"}
                </span>
                <span className="ml-auto text-stone-400">{STATUS_LABELS[o.status]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview && preview.conflictCount > 0 && (
        <label className="flex items-center gap-2 text-xs text-stone-600">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
          Criar também os {preview.conflictCount} turno(s) em conflito
        </label>
      )}

      {formError && <p className="text-xs text-red-600">{formError}</p>}

      <div className="flex gap-2 border-t border-stone-100 pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={submitting || !preview}
          onClick={() => handleCreate(false)}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          Guardar rascunho
        </button>
        <button
          type="button"
          disabled={submitting || !preview || totalToCreate === 0}
          onClick={() => handleCreate(true)}
          className="flex-1 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "A criar…" : `Criar ${totalToCreate} turno(s)`}
        </button>
      </div>
    </div>
  );
}
