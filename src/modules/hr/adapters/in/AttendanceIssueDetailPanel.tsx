import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import type { AttendanceCorrectionType, AttendanceIssueDetail } from "../../domain/entities/attendance-conference.ts";

function formatPeriod(p: { plannedStart: string | null; plannedEnd: string | null; actualStart: string | null; actualEnd: string | null }) {
  const planned = p.plannedStart && p.plannedEnd ? `${p.plannedStart}–${p.plannedEnd}` : "—";
  const actual = p.actualStart && p.actualEnd ? `${p.actualStart}–${p.actualEnd}` : p.actualStart ? `${p.actualStart}–` : "—";
  return { planned, actual };
}

function formatMinutes(mins: number): string {
  const sign = mins < 0 ? "-" : "";
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}h${m > 0 ? `${String(m).padStart(2, "0")}` : ""}`;
}

const ACTIONS: { type: AttendanceCorrectionType; label: string; icon: string }[] = [
  { type: "add_entry", label: "Adicionar entrada", icon: "👤" },
  { type: "add_exit", label: "Adicionar saída", icon: "📄" },
  { type: "fix_entry", label: "Corrigir horário", icon: "✏️" },
  { type: "mark_absence", label: "Marcar ausência", icon: "📅" },
  { type: "confirm", label: "Confirmar", icon: "✓" },
  { type: "observation", label: "Adicionar observação", icon: "📝" },
];

/**
 * "Detalhe da ocorrência" (mockup) — Planeado/Registado/Resultado +
 * "Ações do gestor". Motivo é sempre obrigatório antes de qualquer
 * submissão (task, secção 12) — o botão de ação fica desativado até o
 * motivo ter texto.
 */
export function AttendanceIssueDetailPanel({
  issue,
  onCorrected,
}: {
  issue: AttendanceIssueDetail;
  onCorrected: () => void;
}) {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const [pendingAction, setPendingAction] = useState<AttendanceCorrectionType | null>(null);
  const [actualStartTime, setActualStartTime] = useState("");
  const [actualEndTime, setActualEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const correctMutation = useMutation({
    mutationFn: () =>
      api.correctShiftAttendance({
        workShiftId: issue.shiftId,
        attendanceId: issue.attendanceId,
        employeeId: issue.employeeId,
        workDate: issue.workDate,
        locationId: issue.locationId ?? "",
        correctionType: pendingAction!,
        ...(pendingAction === "add_entry" || pendingAction === "fix_entry" ? { actualStartTime } : {}),
        ...(pendingAction === "add_exit" || pendingAction === "fix_exit" ? { actualEndTime } : {}),
        reason,
        notes: notes || null,
      }),
    onSuccess: () => {
      setPendingAction(null);
      setActualStartTime("");
      setActualEndTime("");
      setReason("");
      setNotes("");
      void qc.invalidateQueries({ queryKey: ["hr-attendance-issues"] });
      void qc.invalidateQueries({ queryKey: ["hr-attendance-closure"] });
      onCorrected();
    },
  });

  const needsTimeInput = pendingAction === "add_entry" || pendingAction === "fix_entry" || pendingAction === "add_exit" || pendingAction === "fix_exit";
  const timeValue = pendingAction === "add_exit" || pendingAction === "fix_exit" ? actualEndTime : actualStartTime;
  const canSubmit = reason.trim().length > 0 && (!needsTimeInput || timeValue.length > 0);

  return (
    <div className="space-y-4 rounded-xl border border-[#F5C992]/40 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-stone-800">Detalhe da ocorrência</h3>
        <p className="text-xs text-stone-500">Revise a informação e aplique as correções necessárias.</p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-stone-100 p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
          {issue.employeeName
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div>
          <p className="text-sm font-semibold text-stone-800">{issue.employeeName}</p>
          <p className="text-xs text-stone-400">{new Date(`${issue.workDate}T00:00:00`).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs font-medium text-stone-400">Planeado</p>
          <p className="text-sm text-stone-700">{issue.periods.map((p) => formatPeriod(p).planned).join(" | ") || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-stone-400">Registado</p>
          <p className="text-sm text-stone-700">{issue.periods.map((p) => formatPeriod(p).actual).join(" | ")}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-stone-400">Resultado</p>
          <p className="text-sm font-medium text-amber-700">⚠ {issue.occurrenceLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 border-t border-stone-100 pt-3 text-sm">
        <div>
          <p className="text-xs text-stone-400">Local</p>
          <p className="text-stone-700">{issue.locationName ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-stone-400">Duração planeada</p>
          <p className="text-stone-700">{formatMinutes(issue.plannedMinutes)}</p>
        </div>
        <div>
          <p className="text-xs text-stone-400">Duração realizada</p>
          <p className="text-stone-700">{formatMinutes(issue.actualMinutes)}</p>
        </div>
        <div>
          <p className="text-xs text-stone-400">Diferença</p>
          <p className={issue.diffMinutes < 0 ? "font-medium text-red-600" : "text-emerald-600"}>{formatMinutes(issue.diffMinutes)}</p>
        </div>
      </div>

      <div className="border-t border-stone-100 pt-3">
        <h4 className="mb-2 text-sm font-semibold text-stone-800">Ações do gestor</h4>
        <p className="mb-3 text-xs text-stone-400">Apenas o gestor pode corrigir, validar e fechar as ocorrências.</p>
        <div className="grid grid-cols-3 gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a.type}
              type="button"
              onClick={() => setPendingAction(a.type)}
              className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                pendingAction === a.type ? "border-[#ED5C32] bg-orange-50 text-[#ED5C32]" : "border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              <span className="mr-1">{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>

        {pendingAction && (
          <div className="mt-3 space-y-2 rounded-lg border border-stone-100 bg-stone-50/60 p-3">
            {needsTimeInput && (
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-600">
                  {pendingAction === "add_exit" || pendingAction === "fix_exit" ? "Hora de saída" : "Hora de entrada"}
                </label>
                <input
                  type="time"
                  value={timeValue}
                  onChange={(e) =>
                    pendingAction === "add_exit" || pendingAction === "fix_exit" ? setActualEndTime(e.target.value) : setActualStartTime(e.target.value)
                  }
                  className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">
                Motivo da correção <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                placeholder="Descreve o motivo da correção..."
                rows={2}
                className="w-full rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
              />
              <p className="mt-0.5 text-right text-xs text-stone-400">{reason.length}/500</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Observação (opcional)</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!canSubmit || correctMutation.isPending}
                onClick={() => correctMutation.mutate()}
                className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {correctMutation.isPending ? "A guardar…" : "Guardar correção"}
              </button>
            </div>
            {correctMutation.isError && (
              <p className="text-xs text-red-600">{correctMutation.error instanceof Error ? correctMutation.error.message : "Erro ao guardar"}</p>
            )}
          </div>
        )}
      </div>

      {issue.corrections.length > 0 && (
        <div className="border-t border-stone-100 pt-3">
          <h4 className="mb-2 text-sm font-semibold text-stone-800">Histórico de correções</h4>
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
        </div>
      )}
    </div>
  );
}
