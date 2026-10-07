import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import { ABSENCE_TYPE_LABEL, type AbsenceDuration, type AbsenceType, type RegisterAbsencePayload } from "../../domain/entities/absences.ts";
import type { EmployeeListRow } from "../../domain/entities/employee.ts";

const TYPES = Object.keys(ABSENCE_TYPE_LABEL) as AbsenceType[];
const DURATIONS: Array<{ key: AbsenceDuration; label: string }> = [
  { key: "day", label: "Dia" },
  { key: "half_day", label: "Meio dia" },
  { key: "hours", label: "Horas" },
];

const labelCls = "mb-1 block text-sm font-medium text-stone-700";
const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#ED5C32]";

/** Espera que o utilizador pare de escrever antes de pedir o impacto ao servidor. */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Avatar({ e }: { e: Pick<EmployeeListRow, "fullName" | "photoUrl"> | undefined }) {
  if (e?.photoUrl) return <img src={e.photoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  const initials = (e?.fullName ?? "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
  return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-semibold text-stone-600">{initials}</span>;
}

/**
 * "Registar ausência" (mockup Férias & Ausências 2.0). O painel Impacto vem
 * do servidor (dias úteis, saldo de férias, turnos afetados, equipa). Os
 * turnos afetados ficam na escala e aparecem como conflito (decisão 2026-10-07).
 */
export function RegisterAbsenceDrawer({ employees, onClose, onSaved }: { employees: EmployeeListRow[]; onClose: () => void; onSaved: () => void }) {
  const { api } = useHrModule();
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<AbsenceType>("vacation");
  const [duration, setDuration] = useState<AbsenceDuration>("day");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");

  const partial = duration !== "day";
  const payload: RegisterAbsencePayload | null =
    employeeId && startDate
      ? {
          employeeId,
          type,
          duration,
          startDate,
          endDate: partial ? startDate : endDate || startDate,
          ...(duration === "hours" ? { startTime: startTime || null, endTime: endTime || null } : {}),
          notes: notes || null,
        }
      : null;
  const ready = payload && (duration !== "hours" || (startTime && endTime && endTime > startTime));
  const debounced = useDebounced(ready ? payload : null, 300);

  const { data: impact, error: impactError } = useQuery({
    queryKey: ["hr-absence-impact", debounced],
    queryFn: () => api.previewAbsence(debounced!),
    enabled: !!debounced,
    retry: false,
  });
  const save = useMutation({ mutationFn: () => api.registerAbsence(payload!), onSuccess: onSaved });

  const selected = employees.find((e) => e.id === employeeId);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ready && !impact?.overlapsExisting) save.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label="Registar ausência">
      <form onSubmit={submit} className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-stone-900">Registar ausência</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-stone-400 hover:text-stone-600">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <label className={labelCls} htmlFor="abs-employee">
              Colaborador
            </label>
            <div className="flex items-center gap-2">
              <Avatar e={selected} />
              <select id="abs-employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputCls}>
                <option value="">Escolha o colaborador…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="abs-type">
              Tipo de ausência
            </label>
            <select
              id="abs-type"
              value={type}
              onChange={(e) => {
                const t = e.target.value as AbsenceType;
                setType(t);
                if (t === "vacation") setDuration("day");
              }}
              className={inputCls}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {ABSENCE_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className={labelCls}>Período</span>
            <div className="flex items-center gap-2">
              <input aria-label="Início" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
              {!partial && (
                <>
                  <span className="text-stone-400">→</span>
                  <input aria-label="Fim" type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
                </>
              )}
            </div>
          </div>

          <div>
            <span className={labelCls}>Duração</span>
            <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-stone-300 text-sm">
              {DURATIONS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  disabled={type === "vacation" && d.key !== "day"}
                  onClick={() => setDuration(d.key)}
                  aria-pressed={duration === d.key}
                  className={`py-2 disabled:opacity-40 ${duration === d.key ? "bg-orange-50 font-medium text-[#ED5C32] ring-1 ring-inset ring-[#ED5C32]" : "text-stone-600"}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {type === "vacation" && <p className="mt-1 text-xs text-stone-500">Férias registam-se em dias inteiros.</p>}
            {duration === "hours" && (
              <div className="mt-2 flex items-center gap-2">
                <input aria-label="Hora de início" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
                <span className="text-stone-400">→</span>
                <input aria-label="Hora de fim" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
              </div>
            )}
          </div>

          <div>
            <label className={labelCls} htmlFor="abs-notes">
              Observação (opcional)
            </label>
            <textarea id="abs-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={500} placeholder="Adicionar uma observação…" className={inputCls} />
          </div>

          <section className="rounded-xl border border-stone-100 bg-stone-50/60 p-4" aria-label="Impacto">
            <p className="mb-2 text-sm font-semibold text-stone-800">Impacto</p>
            {!ready ? (
              <p className="text-xs text-stone-500">Escolha o colaborador e o período para ver o impacto.</p>
            ) : impactError ? (
              <p className="text-xs text-red-700">{impactError instanceof Error ? impactError.message : "Não foi possível calcular."}</p>
            ) : !impact ? (
              <p className="text-xs text-stone-500">A calcular…</p>
            ) : (
              <ul className="space-y-1.5 text-sm text-stone-700">
                <li>📅 {impact.duration}</li>
                {impact.balance && (
                  <li>
                    ⏱{" "}
                    {impact.balance.defined ? (
                      <>
                        Saldo: {impact.balance.available} →{" "}
                        <span className={(impact.balance.after ?? 0) < 0 ? "font-medium text-red-700" : "font-medium text-[#ED5C32]"}>{impact.balance.after} dias disponíveis</span>
                      </>
                    ) : (
                      <span className="text-stone-500">Saldo de férias deste ano ainda não definido</span>
                    )}
                  </li>
                )}
                <li>
                  👥 Turnos afetados: <span className={impact.affectedShifts.length > 0 ? "font-medium text-[#ED5C32]" : ""}>{impact.affectedShifts.length}</span>
                  {impact.affectedShifts.length > 0 && <span className="block text-xs text-stone-500">Ficam na escala e aparecem como conflito — ajuste-os nas Escalas.</span>}
                </li>
                <li>
                  👪 Equipa no período:{" "}
                  {impact.othersAbsent.length === 0 ? (
                    "ninguém mais ausente"
                  ) : (
                    <span className="font-medium text-[#ED5C32]" title={impact.othersAbsent.join(", ")}>
                      {impact.othersAbsent.length} {impact.othersAbsent.length === 1 ? "outro colaborador ausente" : "outros colaboradores ausentes"}
                    </span>
                  )}
                </li>
                <li className={impact.overlapsExisting ? "font-medium text-red-700" : "text-emerald-700"}>
                  {impact.overlapsExisting ? "✕ Já existe uma ausência neste período" : "✓ Sem sobreposição"}
                </li>
                {impact.balance?.defined && (
                  <li className={(impact.balance.after ?? 0) < 0 ? "font-medium text-red-700" : "text-emerald-700"}>
                    {(impact.balance.after ?? 0) < 0 ? "✕ Saldo insuficiente" : "✓ Saldo suficiente"}
                  </li>
                )}
              </ul>
            )}
          </section>
          {save.isError && (
            <p role="alert" className="text-sm text-red-700">
              {save.error instanceof Error ? save.error.message : "Não foi possível registar."}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-stone-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-300 py-2.5 text-sm font-medium text-stone-700">
            Cancelar
          </button>
          <button type="submit" disabled={!ready || !!impact?.overlapsExisting || save.isPending} className="rounded-lg bg-[#ED5C32] py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {save.isPending ? "A registar…" : "Registar ausência"}
          </button>
        </div>
      </form>
    </div>
  );
}
