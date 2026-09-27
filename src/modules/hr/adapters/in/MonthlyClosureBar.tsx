import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";

/** Barra "Fecho mensal" (mockup, rodapé) — bloqueia com pendências (secção 21), exige motivo para reabrir (secção 23). */
export function MonthlyClosureBar({ year, month, onGoToConference }: { year: number; month: number; onGoToConference: () => void }) {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: status, isLoading, isError, error: queryError } = useQuery({
    queryKey: ["hr-attendance-closure", year, month],
    queryFn: () => api.getMonthlyClosureStatus(year, month),
  });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["hr-attendance-closure", year, month] });
    void qc.invalidateQueries({ queryKey: ["hr-attendance-issues"] });
  }

  const closeMutation = useMutation({
    mutationFn: () => api.closeMonthlyPeriod(year, month),
    onSuccess: invalidate,
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Não foi possível fechar o período"),
  });

  const reopenMutation = useMutation({
    mutationFn: () => api.reopenMonthlyPeriod(year, month, reopenReason),
    onSuccess: () => {
      setReopening(false);
      setReopenReason("");
      invalidate();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Não foi possível reabrir o período"),
  });

  if (isLoading) {
    return <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4 text-sm text-stone-400">A carregar fecho mensal…</div>;
  }

  if (isError || !status) {
    return (
      <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4 text-sm text-red-500" title={queryError instanceof Error ? queryError.message : undefined}>
        Não foi possível carregar o estado do fecho mensal.
      </div>
    );
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#F5C992]/40 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            status.status === "closed" ? "bg-emerald-50 text-emerald-600" : status.blockerCount > 0 ? "bg-red-50 text-red-600" : "bg-stone-100 text-stone-500"
          }`}
        >
          🔒
        </span>
        <div>
          <p className="text-sm font-semibold capitalize text-stone-800">
            Fecho mensal — {monthLabel}
          </p>
          {status.status === "closed" ? (
            <p className="text-xs text-emerald-600">Fechado por {status.closedBy} em {status.closedAt ? new Date(status.closedAt).toLocaleDateString("pt-PT") : "—"}</p>
          ) : status.blockerCount > 0 ? (
            <button type="button" onClick={onGoToConference} className="text-xs font-medium text-red-600 hover:underline">
              ⚠ {status.blockerCount} pendência{status.blockerCount === 1 ? "" : "s"} impede{status.blockerCount === 1 ? "" : "m"} o fecho
            </button>
          ) : (
            <p className="text-xs text-stone-400">
              {status.plannedShiftsCount} turnos planeados · {status.regularShiftsCount} regulares · {status.lateCount} atrasos · {status.leaveDaysCount} ausências
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {status.status === "open" ? (
          <>
            <button
              type="button"
              disabled={status.blockerCount > 0 || closeMutation.isPending}
              onClick={() => closeMutation.mutate()}
              className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {closeMutation.isPending ? "A fechar…" : "Fechar período"}
            </button>
            {status.blockerCount > 0 && (
              <button
                type="button"
                onClick={onGoToConference}
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
              >
                Ir para Conferência
              </button>
            )}
          </>
        ) : reopening ? (
          <div className="flex items-center gap-2">
            <input
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Motivo da reabertura…"
              className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
            />
            <button
              type="button"
              disabled={!reopenReason.trim() || reopenMutation.isPending}
              onClick={() => reopenMutation.mutate()}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
            >
              Confirmar reabertura
            </button>
            <button type="button" onClick={() => setReopening(false)} className="text-xs text-stone-400 hover:text-stone-600">
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setReopening(true)}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Reabrir período
          </button>
        )}
      </div>

      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
