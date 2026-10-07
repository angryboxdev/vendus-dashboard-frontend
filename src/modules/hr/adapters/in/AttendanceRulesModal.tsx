import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import type { AttendanceToleranceField, UpdateAttendanceRulesPayload } from "../../domain/entities/attendance-rules.ts";
import { workdayRulesError, workdayRulesSummary } from "../../domain/services/workday.service.ts";

type Tab = "gerais" | "aplicacao" | "historico";

const FIELDS: { key: AttendanceToleranceField; label: string; help: string }[] = [
  { key: "entryToleranceMinutes", label: "Tolerância de entrada", help: "Tempo permitido após o início do turno sem considerar atraso." },
  { key: "earlyExitToleranceMinutes", label: "Tolerância de saída antecipada", help: "Tempo permitido antes do fim do turno sem considerar saída antecipada." },
  { key: "absenceThresholdMinutes", label: "Limite para considerar ausência", help: "Tempo após o início do turno sem entrada para ser marcado como ausência." },
  { key: "preShiftWindowMinutes", label: "Janela de marcação antes do turno", help: "Permitir marcação de entrada até X minutos antes do turno." },
  { key: "postShiftWindowMinutes", label: "Janela de marcação após o turno", help: "Permitir marcação de saída até X minutos após o fim do turno." },
];

/** Jornada (1 turno / 1,5 / dupla) — o utilizador escreve horas; guarda-se em minutos. */
const WORKDAY_FIELDS: { key: AttendanceToleranceField; label: string; help: string; unit: "horas" | "minutos" }[] = [
  { key: "standardShiftMinutes", label: "Duração de 1 turno", help: "Horas de um turno normal.", unit: "horas" },
  { key: "closingToleranceMinutes", label: "Tolerância de fecho", help: "Tempo a mais (ex.: limpeza depois da meia-noite) que ainda conta como 1 turno.", unit: "minutos" },
  { key: "doubleShiftFromMinutes", label: "Dupla a partir de", help: "Total de horas no dia a partir do qual conta como 2 turnos. Entre o turno + tolerância e este valor conta 1,5.", unit: "horas" },
];

/** "12:00" + 35min → "12:35"; negativo desloca para trás. Só para o exemplo prático (ilustrativo, nunca fonte de verdade — task, secção 16). */
function shiftTime(base: string, deltaMinutes: number): string {
  const [h, m] = base.split(":").map(Number);
  const total = (h * 60 + m + deltaMinutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const EXAMPLE_SHIFT_START = "12:00";
const EXAMPLE_SHIFT_END = "20:00";

/**
 * "Configurar regras" (Fase 2.1) — regras globais da organização, sem
 * CRUD por colaborador/função/local (task, secção 3: escopo fora desta
 * fase). Implementado no backend — depende de 2 migrações ainda
 * pendentes de aplicação manual (ver README), até lá mostra
 * "Indisponível".
 */
export function AttendanceRulesModal({ onClose }: { onClose: () => void }) {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("gerais");
  const [form, setForm] = useState<UpdateAttendanceRulesPayload | null>(null);

  const { data: rules, isLoading, isError } = useQuery({
    queryKey: ["hr-attendance-rules"],
    queryFn: () => api.getAttendanceRules(),
  });

  // Deriva o formulário do fetch em vez de sincronizar via efeito (evita
  // cascata de renders) — `form` só existe depois da 1ª edição do utilizador.
  const formValue: UpdateAttendanceRulesPayload | null =
    form ??
    (rules
      ? {
          entryToleranceMinutes: rules.entryToleranceMinutes,
          earlyExitToleranceMinutes: rules.earlyExitToleranceMinutes,
          absenceThresholdMinutes: rules.absenceThresholdMinutes,
          preShiftWindowMinutes: rules.preShiftWindowMinutes,
          postShiftWindowMinutes: rules.postShiftWindowMinutes,
          standardShiftMinutes: rules.standardShiftMinutes,
          closingToleranceMinutes: rules.closingToleranceMinutes,
          doubleShiftFromMinutes: rules.doubleShiftFromMinutes,
          controlStartDate: rules.controlStartDate,
        }
      : null);

  const { data: history, isLoading: historyLoading, isError: historyError } = useQuery({
    queryKey: ["hr-attendance-rules-history"],
    queryFn: () => api.listAttendanceRuleChanges(),
    enabled: tab === "historico",
  });

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateAttendanceRulesPayload) => api.updateAttendanceRules(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-attendance-rules"] });
      void qc.invalidateQueries({ queryKey: ["hr-attendance-rules-history"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h2 className="text-base font-semibold text-stone-900">Configurar regras de assiduidade</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            ✕
          </button>
        </div>

        <div className="flex gap-1 border-b border-stone-100 px-5">
          {(
            [
              { key: "gerais", label: "Regras gerais" },
              { key: "aplicacao", label: "Aplicação" },
              { key: "historico", label: "Histórico de alterações" },
            ] as { key: Tab; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === key ? "border-[#ED5C32] text-[#ED5C32]" : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "gerais" &&
            (isLoading ? (
              <p className="py-8 text-center text-sm text-stone-400">A carregar…</p>
            ) : isError || !formValue ? (
              <p className="py-8 text-center text-sm text-stone-400">
                Indisponível — o backend ainda não expõe regras de assiduidade configuráveis.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {FIELDS.map((f) => (
                    <div key={f.key}>
                      <label className="mb-1 flex items-center gap-1 text-sm font-medium text-stone-700">{f.label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={formValue[f.key]}
                          onChange={(e) => setForm({ ...formValue, [f.key]: Number(e.target.value) })}
                          className="w-24 rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
                        />
                        <span className="text-sm text-stone-500">minutos</span>
                      </div>
                      <p className="mt-1 text-xs text-stone-400">{f.help}</p>
                    </div>
                  ))}
                </div>

                <section className="rounded-lg border border-stone-200 p-3" aria-label="Jornada e dupla">
                  <p className="text-sm font-semibold text-stone-800">Jornada — 1 turno, 1,5 ou dupla</p>
                  <p className="mb-3 text-xs text-stone-500">
                    Conta o total do dia de cada colaborador, pelo dia em que o turno começa — passar da meia-noite nunca conta como outro dia.
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {WORKDAY_FIELDS.map((f) => (
                      <div key={f.key}>
                        <label htmlFor={`wd-${f.key}`} className="mb-1 block text-sm font-medium text-stone-700">
                          {f.label}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id={`wd-${f.key}`}
                            type="number"
                            min={0}
                            step={f.unit === "horas" ? 0.5 : 5}
                            value={f.unit === "horas" ? formValue[f.key] / 60 : formValue[f.key]}
                            onChange={(e) => setForm({ ...formValue, [f.key]: Math.round(Number(e.target.value) * (f.unit === "horas" ? 60 : 1)) })}
                            className="w-20 rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
                          />
                          <span className="text-sm text-stone-500">{f.unit}</span>
                        </div>
                        <p className="mt-1 text-xs text-stone-400">{f.help}</p>
                      </div>
                    ))}
                  </div>
                  {workdayRulesError(formValue) ? (
                    <p className="mt-2 text-xs text-red-600">{workdayRulesError(formValue)}</p>
                  ) : (
                    <p className="mt-2 text-xs font-medium text-stone-700">{workdayRulesSummary(formValue)}</p>
                  )}
                </section>

                <div>
                  <label className="mb-1 flex items-center gap-1 text-sm font-medium text-stone-700">Início do controlo de assiduidade</label>
                  <input
                    type="date"
                    value={formValue.controlStartDate ?? ""}
                    onChange={(e) => setForm({ ...formValue, controlStartDate: e.target.value || null })}
                    className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
                  />
                  <p className="mt-1 text-xs text-stone-400">
                    Turnos anteriores a esta data nunca geram pendência automática por falta de marcação. Vazio = sem limite.
                  </p>
                </div>

                <div className="rounded-lg border border-stone-100 bg-stone-50/60 p-3 text-xs text-stone-600">
                  <p className="mb-1 font-semibold text-stone-700">ℹ Exemplo prático</p>
                  <p>
                    Turno: {EXAMPLE_SHIFT_START} – {EXAMPLE_SHIFT_END}
                  </p>
                  <p>Janela antes: a partir das {shiftTime(EXAMPLE_SHIFT_START, -formValue.preShiftWindowMinutes)}</p>
                  <p>Tolerância entrada: até {shiftTime(EXAMPLE_SHIFT_START, formValue.entryToleranceMinutes)}</p>
                  <p>Tolerância saída antecipada: até {shiftTime(EXAMPLE_SHIFT_END, -formValue.earlyExitToleranceMinutes)}</p>
                  <p>Janela após: até {shiftTime(EXAMPLE_SHIFT_END, formValue.postShiftWindowMinutes)}</p>
                </div>

                {saveMutation.isError && (
                  <p className="text-xs text-red-600">{saveMutation.error instanceof Error ? saveMutation.error.message : "Erro ao guardar"}</p>
                )}
              </div>
            ))}

          {tab === "aplicacao" && (
            <p className="py-8 text-center text-sm text-stone-500">
              Estas regras aplicam-se globalmente à organização. Regras específicas por colaborador, função ou local ficam para uma fase futura.
            </p>
          )}

          {tab === "historico" &&
            (historyLoading ? (
              <p className="py-8 text-center text-sm text-stone-400">A carregar…</p>
            ) : historyError || !history ? (
              <p className="py-8 text-center text-sm text-stone-400">Indisponível.</p>
            ) : history.length === 0 ? (
              <p className="py-8 text-center text-sm text-stone-400">Sem alterações registadas.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="rounded-lg border border-stone-100 p-2.5 text-xs">
                    <p className="font-medium text-stone-700">
                      {[...FIELDS, ...WORKDAY_FIELDS].find((f) => f.key === h.field)?.label ?? h.field}: {h.previousValue} → {h.newValue} min
                    </p>
                    <p className="text-stone-400">
                      Vigente desde {new Date(`${h.effectiveFrom}T00:00:00`).toLocaleDateString("pt-PT")} · {h.changedBy} ·{" "}
                      {new Date(h.changedAt).toLocaleString("pt-PT")}
                    </p>
                  </li>
                ))}
              </ul>
            ))}
        </div>

        {tab === "gerais" && (
          <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
              Cancelar
            </button>
            <button
              type="button"
              disabled={!formValue || saveMutation.isPending || workdayRulesError(formValue) !== null}
              onClick={() => formValue && saveMutation.mutate(formValue)}
              className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saveMutation.isPending ? "A guardar…" : "Guardar alterações"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
