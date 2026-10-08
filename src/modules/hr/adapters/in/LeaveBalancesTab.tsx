import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import type { LeaveBalanceRow } from "../../domain/entities/absences.ts";
import { Button, IconChevronLeft, IconChevronRight, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../components/ui/index.ts";

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
    <tr className={TR}>
      <td className={TD}>
        <p className="font-medium text-stone-800">{row.employeeName}</p>
        <p className="text-xs text-stone-400">{row.positionName ?? ""}</p>
      </td>
      <td className={TD}>
        <input aria-label={`Dias de direito de ${row.employeeName}`} type="number" min={0} max={60} value={entitled} onChange={(e) => setEntitled(e.target.value)} className={numCls} />
        {!row.defined && <span className="ml-2 text-xs text-amber-700">sugerido</span>}
      </td>
      <td className={TD}>
        <input aria-label={`Dias transitados de ${row.employeeName}`} type="number" min={0} max={60} value={carried} onChange={(e) => setCarried(e.target.value)} className={numCls} />
      </td>
      <td className={TD}>{row.taken}</td>
      <td className={TD}>{row.scheduled}</td>
      <td className={`${TD} font-semibold ${available < 0 ? "text-red-700" : "text-stone-900"}`}>{available}</td>
      <td className={TD}>
        {changed && (
          <Button variant="primary" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
            {row.defined ? "Guardar" : "Confirmar"}
          </Button>
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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button aria-label="Ano anterior" onClick={() => setYear(year - 1)} icon={<IconChevronLeft />} />
        <span className="min-w-[60px] text-center text-sm font-medium text-stone-800">{year}</span>
        <Button aria-label="Ano seguinte" onClick={() => setYear(year + 1)} icon={<IconChevronRight />} />
        <p className="ml-2 text-xs text-stone-500">"Sugerido" = calculado pela data de admissão; confirme ou ajuste.</p>
      </div>
      {isLoading ? (
        <p className="text-sm text-stone-400">A carregar…</p>
      ) : isError ? (
        <p className="text-sm text-red-700">Não foi possível carregar os saldos.</p>
      ) : (
        <div className={`overflow-x-auto ${SURFACE}`}>
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Colaborador</th>
                <th className={TH}>Direito</th>
                <th className={TH}>Transitados</th>
                <th className={TH}>Gozados</th>
                <th className={TH}>Marcados</th>
                <th className={TH}>Disponível</th>
                <th className={TH}>
                  <span className="sr-only">Ação</span>
                </th>
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
