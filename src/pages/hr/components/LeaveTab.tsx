import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createLeaveRequest,
  deleteLeaveRequest,
  fetchLeaveBalance,
  fetchLeaveRequests,
  updateLeaveBalance,
} from "../hrApi";
import { hrQueryKeys } from "../hrQueryKeys";
import type { HrEmployee, HrLeaveRequest, LeaveType } from "../hr.types";
import { LEAVE_TYPE_COLORS, LEAVE_TYPE_LABELS } from "../hr.types";
import { getTodayLisbon } from "../dates";

const LEAVE_TYPES: LeaveType[] = ["vacation", "sick_leave", "justified", "unjustified"];

// ---------- Balance widget ----------

function BalanceWidget({
  employeeId,
  year,
  onYearChange,
}: {
  employeeId: string;
  year: number;
  onYearChange: (y: number) => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [entitled, setEntitled] = useState("");
  const [carried, setCarried] = useState("");

  const { data: balance, isPending } = useQuery({
    queryKey: hrQueryKeys.leaveBalance(employeeId, year),
    queryFn: () => fetchLeaveBalance(employeeId, year),
  });

  const saveMut = useMutation({
    mutationFn: () =>
      updateLeaveBalance(employeeId, year, {
        ...(entitled !== "" ? { daysEntitled: Number(entitled) } : {}),
        ...(carried !== "" ? { daysCarriedOver: Number(carried) } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hrQueryKeys.leaveBalance(employeeId, year) });
      setEditing(false);
    },
  });

  function startEdit() {
    setEntitled(String(balance?.daysEntitled ?? 22));
    setCarried(String(balance?.daysCarriedOver ?? 0));
    setEditing(true);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">Saldo de férias</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onYearChange(year - 1)}
              className="rounded p-0.5 text-slate-400 hover:text-slate-700">
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-indigo-600">{year}</span>
            <button type="button" onClick={() => onYearChange(year + 1)}
              className="rounded p-0.5 text-slate-400 hover:text-slate-700">
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        {!editing && (
          <button type="button" onClick={startEdit}
            className="text-xs text-indigo-600 hover:underline">
            Editar
          </button>
        )}
      </div>

      {isPending ? (
        <p className="mt-3 text-sm text-slate-400">A carregar…</p>
      ) : balance ? (
        <>
          {/* Suggestion notice */}
          {balance.suggestedDaysEntitled !== balance.daysEntitled && (
            <p className="mt-2 text-xs text-amber-700">
              Sugestão automática: {balance.suggestedDaysEntitled} dias
              {balance.suggestedDaysEntitled < 22 ? " (1.º ano de contrato)" : ""}.
              Valor actual foi ajustado manualmente.
            </p>
          )}

          {editing ? (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Dias com direito</label>
                <input type="number" min={0} value={entitled} onChange={(e) => setEntitled(e.target.value)}
                  className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Transitados</label>
                <input type="number" min={0} value={carried} onChange={(e) => setCarried(e.target.value)}
                  className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="button" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                  {saveMut.isPending ? "…" : "Guardar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {[
                { label: "Com direito", value: balance.daysEntitled, color: "text-slate-900" },
                { label: "Transitados", value: balance.daysCarriedOver, color: "text-slate-600" },
                { label: "Utilizados", value: balance.daysUsed, color: "text-orange-600" },
                {
                  label: "Restantes",
                  value: balance.daysRemaining,
                  color: balance.daysRemaining < 0 ? "text-red-600" : "text-emerald-600",
                },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}

      {/* Legal note */}
      <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <strong>Regras legais (CT):</strong>{" "}
        1.º ano → 2 dias/mês completo, máx. 20 (só após 6 meses).
        2.º ano em diante → 22 dias úteis.
        Férias não gozadas transitam até 30 de abril do ano seguinte.
      </div>
    </div>
  );
}

// ---------- Leave form ----------

function LeaveFormModal({
  employeeId,
  onClose,
}: {
  employeeId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const today = getTodayLisbon();
  const [type, setType] = useState<LeaveType>("vacation");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createLeaveRequest(employeeId, { type, startDate, endDate, notes: notes || null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: hrQueryKeys.root });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Erro"),
  });

  // Extra legal hint when registering sick leave
  const showSickNote = type === "sick_leave";
  const showUnjustifiedNote = type === "unjustified";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">Registar ausência</h3>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value as LeaveType)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              {LEAVE_TYPES.map((t) => <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>)}
            </select>
          </div>

          {showSickNote && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <strong>Baixa médica:</strong> Primeiros 3 dias pagos pelo empregador.
              A partir do 4.º dia a Seg. Social paga 65% da remuneração de referência.
            </div>
          )}
          {showUnjustifiedNote && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <strong>Falta injustificada:</strong> Desconta no salário e pode implicar perda de
              antiguidade (até 30 dias/ano).
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Início</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Fim</label>
              <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Notas</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {mutation.isPending ? "A guardar…" : "Registar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Main tab ----------

export function LeaveTab({
  employeeId,
  employee: _employee,
}: {
  employeeId: string;
  employee: HrEmployee | null;
}) {
  const today = getTodayLisbon();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();

  const { data: leaves = [], isPending } = useQuery({
    queryKey: hrQueryKeys.leaveRequests(employeeId, year),
    queryFn: () => fetchLeaveRequests({ employeeId, year }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteLeaveRequest(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: hrQueryKeys.root }),
  });

  const vacationDays = leaves
    .filter((l) => l.type === "vacation")
    .reduce((s, l) => s + l.workingDays, 0);

  return (
    <div className="mt-6 max-w-3xl space-y-5">
      {/* Balance */}
      <BalanceWidget employeeId={employeeId} year={year} onYearChange={setYear} />

      {/* Leave history */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          Registos de {year}
          {vacationDays > 0 && (
            <span className="ml-2 text-xs font-normal text-slate-400">
              ({vacationDays} dias de férias utilizados)
            </span>
          )}
        </h3>
        <button type="button" onClick={() => setCreating(true)}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700">
          Registar ausência
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {isPending ? (
          <p className="p-4 text-sm text-slate-400">A carregar…</p>
        ) : leaves.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            Sem registos de ausência em {year}.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3">Dias úteis</th>
                <th className="px-4 py-3">Notas</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(leaves as HrLeaveRequest[]).map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${LEAVE_TYPE_COLORS[l.type]}`}>
                      {LEAVE_TYPE_LABELS[l.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">
                    {l.startDate === l.endDate ? l.startDate : `${l.startDate} → ${l.endDate}`}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{l.workingDays}</td>
                  <td className="px-4 py-3 text-slate-500">{l.notes ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={deleteMut.isPending}
                      onClick={() => {
                        if (confirm("Remover este registo?")) deleteMut.mutate(l.id);
                      }}
                      className="text-red-500 hover:underline disabled:opacity-50"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <LeaveFormModal employeeId={employeeId} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}
