import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import type { ClearWorkShiftsResult } from "../../domain/entities/schedule.ts";

interface ClearShiftsModalProps {
  /** null = limpar para TODOS os colaboradores (só disponível para o âmbito "semana"). */
  employeeId: string | null;
  employeeName: string;
  defaultWeekStartDate: string;
  locationId?: string;
  onClose: () => void;
  onCleared: (result: ClearWorkShiftsResult) => void;
}

/** "Limpar turnos" — âmbito explícito, nunca um "limpar tudo" implícito, sempre com confirmação. */
export function ClearShiftsModal({ employeeId, employeeName, defaultWeekStartDate, locationId, onClose, onCleared }: ClearShiftsModalProps) {
  const { api } = useHrModule();
  const [scopeKind, setScopeKind] = useState<"day" | "week">(employeeId ? "day" : "week");
  const [date, setDate] = useState(defaultWeekStartDate);
  const [weekStartDate, setWeekStartDate] = useState(defaultWeekStartDate);
  const [confirming, setConfirming] = useState(false);

  const clearMutation = useMutation({
    mutationFn: () =>
      api.clearWorkShifts(
        !employeeId
          ? { kind: "week_all", weekStartDate, ...(locationId && { locationId }) }
          : scopeKind === "day"
            ? { kind: "day", employeeId, workDate: date }
            : { kind: "week", employeeId, weekStartDate },
      ),
    onSuccess: (result) => onCleared(result),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Limpar turnos</h2>
            <p className="text-sm text-stone-500">{employeeId ? employeeName : "Todos os colaboradores desta semana"}</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {employeeId && (
            <div className="flex rounded-md border border-stone-200 bg-stone-50 p-0.5 text-sm">
              <button
                type="button"
                onClick={() => setScopeKind("day")}
                className={`flex-1 rounded px-2 py-1.5 ${scopeKind === "day" ? "bg-white shadow-sm" : "text-stone-500"}`}
              >
                Um dia
              </button>
              <button
                type="button"
                onClick={() => setScopeKind("week")}
                className={`flex-1 rounded px-2 py-1.5 ${scopeKind === "week" ? "bg-white shadow-sm" : "text-stone-500"}`}
              >
                Uma semana
              </button>
            </div>
          )}

          {employeeId && scopeKind === "day" ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">Dia</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">Semana a partir de</label>
              <input
                type="date"
                value={weekStartDate}
                onChange={(e) => setWeekStartDate(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </div>
          )}

          <p className="text-xs text-stone-500">
            Apaga os turnos planeados de {employeeId ? employeeName : "todos os colaboradores"} no âmbito escolhido. Turnos com
            presença já registada nunca são apagados — ficam preservados e reportados à parte.
          </p>

          {confirming && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">Tens a certeza que queres limpar a escala?</p>
              <p className="mt-0.5 text-red-700">Os turnos serão apagados permanentemente. Queres continuar?</p>
            </div>
          )}

          {clearMutation.isError && (
            <p className="text-xs text-red-600">
              {clearMutation.error instanceof Error ? clearMutation.error.message : "Erro ao limpar turnos"}
            </p>
          )}
        </div>

        <div className="flex gap-2 border-t border-stone-100 px-5 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancelar
          </button>
          {confirming ? (
            <button
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {clearMutation.isPending ? "A limpar…" : "Sim, limpar permanentemente"}
            </button>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Limpar turnos
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
