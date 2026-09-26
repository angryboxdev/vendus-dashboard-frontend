import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import type { ShiftAttendanceStatus, ShiftToReview } from "../../domain/entities/overview.ts";
import { SeverityBadge } from "./components/SeverityBadge.tsx";

/** Mesmo valor documentado em `overview-shift-state.service.ts` no backend — só para exibição, não é autoritativo. */
const LATE_TOLERANCE_MINUTES = 10;

const STATUS_LABELS: Record<ShiftAttendanceStatus, string> = {
  worked_as_planned: "Cumpriu o planeado",
  late: "Atraso",
  left_early: "Saída antecipada",
  cancelled: "Cancelado",
};

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatMinutesDiff(diff: number): string {
  if (diff === 0) return "Pontual";
  const sign = diff > 0 ? "+" : "−";
  const abs = Math.abs(diff);
  return `${sign}${abs} min`;
}

function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function computeDisplayStatus(shift: ShiftToReview, nowMinutes: number, workDateIsToday: boolean): string {
  const hasArrived = shift.actualStartTime != null;
  const hasLeft = shift.actualEndTime != null;
  if (hasArrived && hasLeft) return "Finalizado";
  if (hasArrived && !hasLeft) return "Presente (sem saída)";
  const plannedEnd = parseTimeToMinutes(shift.plannedEndTime);
  if (!workDateIsToday || nowMinutes >= plannedEnd) return "Ausente operacional";
  const plannedStart = parseTimeToMinutes(shift.plannedStartTime);
  if (nowMinutes > plannedStart + LATE_TOLERANCE_MINUTES) return "Atrasado, aguardando entrada";
  return "Em tolerância";
}

export function ShiftReviewModal({
  shift,
  onClose,
  onConfirmed,
}: {
  shift: ShiftToReview;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const { api } = useHrModule();
  const [correcting, setCorrecting] = useState(false);
  const [actualStartTime, setActualStartTime] = useState(shift.actualStartTime ?? "");
  const [actualEndTime, setActualEndTime] = useState(shift.actualEndTime ?? "");
  const [status, setStatus] = useState<ShiftAttendanceStatus>("worked_as_planned");
  const [lateMinutes, setLateMinutes] = useState("");
  const [notes, setNotes] = useState("");

  const now = useMemo(() => new Date(), []);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayYmd = now.toISOString().slice(0, 10);
  const isToday = shift.workDate === todayYmd;

  const displayStatus = computeDisplayStatus(shift, nowMinutes, isToday);

  const plannedStart = parseTimeToMinutes(shift.plannedStartTime);
  const plannedEnd = parseTimeToMinutes(shift.plannedEndTime);
  const diffEntrada = shift.actualStartTime != null ? parseTimeToMinutes(shift.actualStartTime) - plannedStart : null;
  const diffSaida = shift.actualEndTime != null ? parseTimeToMinutes(shift.actualEndTime) - plannedEnd : null;
  const durationMinutes =
    shift.actualStartTime != null
      ? (shift.actualEndTime != null ? parseTimeToMinutes(shift.actualEndTime) : nowMinutes) -
        parseTimeToMinutes(shift.actualStartTime)
      : null;

  const occurrences: string[] = [];
  if (shift.actualStartTime) occurrences.push(`Entrada registada às ${shift.actualStartTime}`);
  if (!shift.actualStartTime && shift.actualEndTime) occurrences.push("Saída registada sem entrada correspondente");
  if (shift.actualStartTime && !shift.actualEndTime) occurrences.push("Sem marcação de saída — turno em aberto");
  occurrences.push(`Turno planeado ${shift.plannedStartTime} – ${shift.plannedEndTime}`);

  const confirmMutation = useMutation({
    mutationFn: () =>
      api.confirmShiftAttendance(shift.shiftId, {
        status,
        actualStartTime: (correcting ? actualStartTime : shift.actualStartTime) || null,
        actualEndTime: (correcting ? actualEndTime : shift.actualEndTime) || null,
        lateMinutes: status === "late" && lateMinutes ? Number(lateMinutes) : null,
        notes: notes || null,
        locationId: shift.locationId,
      }),
    onSuccess: onConfirmed,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Conferência do turno</h2>
            <p className="text-sm text-stone-500">{shift.employeeName}</p>
          </div>
          <SeverityBadge severity={shift.priority} />
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-stone-100 bg-stone-50 p-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-stone-400">Horário planeado</p>
              <p className="text-sm font-medium text-stone-700">
                {shift.plannedStartTime} – {shift.plannedEndTime}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-400">Exceção</p>
              <p className="text-sm font-medium text-red-600">{shift.exceptionLabel}</p>
            </div>
          </div>

          <div className="rounded-lg border border-stone-100 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Marcações reais</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-stone-400">Entrada</p>
                <p className="font-medium text-stone-700">{shift.actualStartTime ?? "—"}</p>
              </div>
              <div>
                <p className="text-stone-400">Saída</p>
                <p className="font-medium text-stone-700">{shift.actualEndTime ?? "—"}</p>
              </div>
            </div>
            {shift.actualStartTime && !shift.actualEndTime && durationMinutes != null && (
              <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-600">
                Turno em aberto há {formatDuration(durationMinutes)}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-stone-100 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Análise</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">Diferença entrada</span>
                <span className="font-medium text-stone-700">{diffEntrada != null ? formatMinutesDiff(diffEntrada) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Diferença saída</span>
                <span className="font-medium text-stone-700">{diffSaida != null ? formatMinutesDiff(diffSaida) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Duração atual</span>
                <span className="font-medium text-stone-700">{durationMinutes != null ? formatDuration(durationMinutes) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Tolerância de atraso</span>
                <span className="font-medium text-stone-700">{LATE_TOLERANCE_MINUTES} min</span>
              </div>
              <div className="col-span-2 flex justify-between">
                <span className="text-stone-500">Status</span>
                <span className="font-medium text-stone-700">{displayStatus}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-stone-100 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Histórico e ocorrências</p>
            <ul className="space-y-1 text-sm text-stone-600">
              {occurrences.map((o, i) => (
                <li key={i}>• {o}</li>
              ))}
            </ul>
          </div>

          {correcting && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-600">Entrada real</label>
                <input
                  type="time"
                  value={actualStartTime}
                  onChange={(e) => setActualStartTime(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-600">Saída real</label>
                <input
                  type="time"
                  value={actualEndTime}
                  onChange={(e) => setActualEndTime(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Estado da conferência</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ShiftAttendanceStatus)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
              >
                {(Object.entries(STATUS_LABELS) as [ShiftAttendanceStatus, string][]).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {status === "late" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-600">Minutos de atraso</label>
                <input
                  type="number"
                  min={0}
                  value={lateMinutes}
                  onChange={(e) => setLateMinutes(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Observação (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicionar observação sobre a conferência deste turno..."
              className="min-h-[64px] w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-stone-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={confirmMutation.isPending}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => setCorrecting((c) => !c)}
            disabled={confirmMutation.isPending}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Corrigir marcações
          </button>
          <button
            type="button"
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending}
            className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-60"
          >
            {confirmMutation.isPending ? "A confirmar…" : "Confirmar conferência"}
          </button>
        </div>
        {confirmMutation.isError && (
          <p className="px-5 pb-4 text-xs text-red-600">
            {confirmMutation.error instanceof Error ? confirmMutation.error.message : "Erro ao confirmar a conferência."}
          </p>
        )}
      </div>
    </div>
  );
}
