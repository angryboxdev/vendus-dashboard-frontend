import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import { formatMinutes } from "../../../../lib/format-minutes.ts";
import type { AttendanceCorrectionType, AttendanceIssueDetail } from "../../domain/entities/attendance-conference.ts";

type InnerTab = "acao" | "observacoes" | "historico";

function formatPeriod(p: { plannedStart: string | null; plannedEnd: string | null; actualStart: string | null; actualEnd: string | null }) {
  const planned = p.plannedStart && p.plannedEnd ? `${p.plannedStart}–${p.plannedEnd}` : "—";
  const actual = p.actualStart && p.actualEnd ? `${p.actualStart}–${p.actualEnd}` : p.actualStart ? `${p.actualStart}–` : "—";
  return { planned, actual };
}

/**
 * Fase 2.1 — o conjunto de ações substitui o anterior (add/fix entry-exit
 * separados) por um único fluxo de correção (`fix_times`) + as 2 ações
 * novas do mockup (`justify_no_impact`/`remove_marking`). Cada ação tem um
 * aviso curto explicando a consequência, mostrado assim que selecionada.
 */
const ACTIONS: { type: AttendanceCorrectionType; label: string; warning: string }[] = [
  { type: "keep_as_is", label: "Manter como está (atraso)", warning: "Este turno será mantido como atraso. Será considerado na contabilização de horas e dias em atraso." },
  { type: "fix_times", label: "Corrigir entrada/saída", warning: "A entrada e/ou saída registadas serão substituídas pelos horários indicados abaixo." },
  { type: "justify_no_impact", label: "Justificar (sem impacto)", warning: "A ocorrência fica justificada e deixa de contar para os KPIs de atraso/ausência." },
  { type: "mark_absence", label: "Marcar ausência", warning: "O dia passa a ser registado como ausência para este colaborador." },
  { type: "remove_marking", label: "Remover marcação", warning: "A marcação registada é apagada — o turno volta a ficar sem entrada/saída." },
];

/**
 * "Resolver ocorrência de assiduidade" (mockup Fase 2.1) — substitui o
 * antigo `AttendanceIssueDetailPanel` (painel lateral fixo) por um modal,
 * seguindo o mockup anexado. Motivo continua obrigatório antes de
 * qualquer submissão (task, secção 12) — só validação de UX, o backend
 * (`CorrectShiftAttendanceUseCase`) recusa de qualquer forma sem motivo.
 */
export function AttendanceIssueResolutionModal({
  issue,
  onClose,
  onCorrected,
}: {
  issue: AttendanceIssueDetail;
  onClose: () => void;
  onCorrected: () => void;
}) {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const [innerTab, setInnerTab] = useState<InnerTab>("acao");
  const [pendingAction, setPendingAction] = useState<AttendanceCorrectionType | null>(null);
  const [actualStartTime, setActualStartTime] = useState("");
  const [actualEndTime, setActualEndTime] = useState("");
  const [compliedSchedule, setCompliedSchedule] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const readOnly = issue.reviewStatus === "conferred" && !pendingAction;
  const plannedPeriod = issue.periods[0];

  function toggleCompliedSchedule(checked: boolean) {
    setCompliedSchedule(checked);
    if (checked) {
      setActualStartTime(plannedPeriod?.plannedStart ?? "");
      setActualEndTime(plannedPeriod?.plannedEnd ?? "");
    }
  }

  const correctMutation = useMutation({
    mutationFn: () =>
      api.correctShiftAttendance({
        workShiftId: issue.shiftId,
        attendanceId: issue.attendanceId,
        employeeId: issue.employeeId,
        workDate: issue.workDate,
        locationId: issue.locationId ?? "",
        correctionType: pendingAction!,
        ...(pendingAction === "fix_times" ? { actualStartTime: actualStartTime || null, actualEndTime: actualEndTime || null } : {}),
        reason,
        notes: notes || null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-attendance-issues"] });
      void qc.invalidateQueries({ queryKey: ["hr-attendance-closure"] });
      void qc.invalidateQueries({ queryKey: ["hr-attendance-summary"] });
      onCorrected();
    },
  });

  const canSubmit = reason.trim().length > 0;
  const selectedAction = ACTIONS.find((a) => a.type === pendingAction);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <h2 className="text-base font-semibold text-stone-900">Resolver ocorrência de assiduidade</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-100 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                {issue.employeeName
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-800">{issue.employeeName}</p>
                <p className="text-xs text-stone-400">{issue.locationName ?? "—"}</p>
              </div>
            </div>
            <p className="text-xs text-stone-400">
              {new Date(`${issue.workDate}T00:00:00`).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-800">⚠ {issue.occurrenceLabel}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-stone-400">Planeado</p>
              <p className="text-sm text-stone-700">{issue.periods.map((p) => formatPeriod(p).planned).join(" | ") || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-stone-400">Registado</p>
              <div className="flex items-center gap-2">
                <p className="text-sm text-stone-700">{issue.periods.map((p) => formatPeriod(p).actual).join(" | ")}</p>
                <span className={`text-xs font-medium ${issue.diffMinutes < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {formatMinutes(issue.diffMinutes)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-1 border-b border-stone-100">
            {(
              [
                { key: "acao", label: "Ação" },
                { key: "observacoes", label: "Observações" },
                { key: "historico", label: "Histórico" },
              ] as { key: InnerTab; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setInnerTab(key)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  innerTab === key ? "border-[#ED5C32] text-[#ED5C32]" : "border-transparent text-stone-500 hover:text-stone-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {innerTab === "acao" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                {ACTIONS.map((a) => (
                  <label
                    key={a.type}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      pendingAction === a.type ? "border-[#ED5C32] bg-orange-50" : "border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="attendance-action"
                      checked={pendingAction === a.type}
                      onChange={() => setPendingAction(a.type)}
                      className="accent-[#ED5C32]"
                    />
                    <span className="text-stone-700">{a.label}</span>
                  </label>
                ))}
              </div>

              {pendingAction === "fix_times" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-stone-600">Hora de entrada</label>
                      <input
                        type="time"
                        value={actualStartTime}
                        disabled={compliedSchedule}
                        onChange={(e) => setActualStartTime(e.target.value)}
                        className="w-full rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32] disabled:bg-stone-100 disabled:text-stone-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-stone-600">Hora de saída</label>
                      <input
                        type="time"
                        value={actualEndTime}
                        disabled={compliedSchedule}
                        onChange={(e) => setActualEndTime(e.target.value)}
                        className="w-full rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32] disabled:bg-stone-100 disabled:text-stone-500"
                      />
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={compliedSchedule}
                      onChange={(e) => toggleCompliedSchedule(e.target.checked)}
                      className="accent-[#ED5C32]"
                    />
                    Cumpriu horário
                  </label>
                  {compliedSchedule && (
                    <p className="text-xs text-stone-400">
                      Preenchido automaticamente com o horário planeado ({plannedPeriod?.plannedStart ?? "—"}–{plannedPeriod?.plannedEnd ?? "—"}). Desmarca para editar.
                    </p>
                  )}
                </div>
              )}

              {selectedAction && (
                <div className="rounded-lg border border-stone-100 bg-stone-50/60 p-3 text-xs text-stone-600">
                  <p className="mb-1 font-medium text-stone-700">ℹ {selectedAction.label}</p>
                  <p>{selectedAction.warning}</p>
                </div>
              )}

              {pendingAction && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-600">
                    Motivo <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value.slice(0, 500))}
                    placeholder="Descreve o motivo desta decisão..."
                    rows={2}
                    className="w-full rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
                  />
                  <p className="mt-0.5 text-right text-xs text-stone-400">{reason.length}/500</p>
                </div>
              )}

              {correctMutation.isError && (
                <p className="text-xs text-red-600">{correctMutation.error instanceof Error ? correctMutation.error.message : "Erro ao guardar"}</p>
              )}
            </div>
          )}

          {innerTab === "observacoes" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Observação (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Notas adicionais sobre esta ocorrência..."
                className="w-full rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
              />
            </div>
          )}

          {innerTab === "historico" &&
            (issue.corrections.length === 0 ? (
              <p className="py-6 text-center text-sm text-stone-400">Sem correções aplicadas a este turno.</p>
            ) : (
              <ul className="space-y-2">
                {issue.corrections.map((c) => (
                  <li key={c.id} className="rounded-lg border border-stone-100 p-2 text-xs">
                    <p className="font-medium text-stone-700">{c.reason}</p>
                    <p className="text-stone-400">
                      {c.actor} · {new Date(c.createdAt).toLocaleString("pt-PT")}
                    </p>
                  </li>
                ))}
              </ul>
            ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
            Cancelar
          </button>
          {!readOnly && (
            <button
              type="button"
              disabled={!pendingAction || !canSubmit || correctMutation.isPending}
              onClick={() => correctMutation.mutate()}
              className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {correctMutation.isPending ? "A guardar…" : "Confirmar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
