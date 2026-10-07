import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import type { LeaveBalanceRow } from "../../domain/entities/absences.ts";

const numCls = "w-16 rounded-md border border-stone-300 px-2 py-1 text-right text-sm";

function BalanceRow({ row, year }: { row: LeaveBalanceRow; year: number }) {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const [entitled, setEntitled] = useState(String(row.daysEntitled));
  const [carried, setCarried] = useState(String(row.daysCarriedOver));
  const changed = !row.defined || entitled !== String(row.daysEntitled) || carried !== String(row.daysCarriedOver);
  const save = useMutation({
    mutationFn: () => api.setLeaveBalance(row.employeeId, year, Number(entitled), Number(carried || 0)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["hr-leave-balances", year] }),
  });
  const available = Number(entitled || 0) + Number(carried || 0) - row.taken - row.scheduled;

  return (
    <tr className="border-b border-stone-50 last:border-0">
      <td className="px-4 py-2.5">
        <p className="font-medium text-stone-800">{row.employeeName}</p>
        <p className="text-xs text-stone-400">{row.positionName ?? ""}</p>
      </td>
      <td className="px-4 py-2.5">
        <input aria-label={`Dias de direito de ${row.employeeName}`} type="number" min={0} max={60} value={entitled} onChange={(e) => setEntitled(e.target.value)} className={numCls} />
        {!row.defined && <span className="ml-2 text-xs text-amber-700">sugerido</span>}
      </td>
      <td className="px-4 py-2.5">
        <input aria-label={`Dias transitados de ${row.employeeName}`} type="number" min={0} max={60} value={carried} onChange={(e) => setCarried(e.target.value)} className={numCls} />
      </td>
      <td className="px-4 py-2.5 text-stone-600">{row.taken}</td>
      <td className="px-4 py-2.5 text-stone-600">{row.scheduled}</td>
      <td className={`px-4 py-2.5 font-semibold ${available < 0 ? "text-red-700" : "text-emerald-700"}`}>{available}</td>
      <td className="px-4 py-2.5">
        {changed && (
          <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className="rounded-lg bg-[#ED5C32] px-3 py-1 text-xs font-medium text-white disabled:opacity-50">
            {row.defined ? "Guardar" : "Confirmar"}
          </button>
        )}
        {save.isError && <p className="mt-1 text-xs text-red-700">{save.error instanceof Error ? save.error.message : "Erro"}</p>}
      </td>
    </tr>
  );
}

/**
 * Separador "Saldos" — direito do ano (ou sugestão pela data de admissão,
 * a confirmar), transitados, férias gozadas e marcadas, disponível.
 * Substitui a página antiga de Férias.
 */
export function LeaveBalancesTab({ search }: { search: string }) {
  const { api } = useHrModule();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const { data, isLoading, isError } = useQuery({ queryKey: ["hr-leave-balances", year], queryFn: () => api.listLeaveBalances(year) });
  const q = search.trim().toLowerCase();
  const rows = (data ?? []).filter((r) => !q || r.employeeName.toLowerCase().includes(q));
  const btn = "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Ano anterior" onClick={() => setYear(year - 1)} className={btn}>
          ‹
        </button>
        <span className="min-w-[60px] text-center text-sm font-medium text-stone-800">{year}</span>
        <button type="button" aria-label="Ano seguinte" onClick={() => setYear(year + 1)} className={btn}>
          ›
        </button>
        <p className="ml-2 text-xs text-stone-500">"Sugerido" = calculado pela data de admissão; confirme ou ajuste.</p>
      </div>
      {isLoading ? (
        <p className="text-sm text-stone-400">A carregar…</p>
      ) : isError ? (
        <p className="text-sm text-red-700">Não foi possível carregar os saldos.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase text-stone-400">
                <th className="px-4 py-2.5">Colaborador</th>
                <th className="px-4 py-2.5">Direito</th>
                <th className="px-4 py-2.5">Transitados</th>
                <th className="px-4 py-2.5">Gozados</th>
                <th className="px-4 py-2.5">Marcados</th>
                <th className="px-4 py-2.5">Disponível</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <BalanceRow key={`${r.employeeId}-${year}-${r.daysEntitled}-${r.daysCarriedOver}-${r.defined}`} row={r} year={year} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
