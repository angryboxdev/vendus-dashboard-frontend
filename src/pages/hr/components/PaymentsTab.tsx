import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  fetchEmployeePayments,
  fetchShifts,
  patchPayment,
  type ListPaymentsParams,
} from "../hrApi";
import { hrQueryKeys } from "../hrQueryKeys";
import {
  formatSalaryPeriodLabel,
  type HrEmployee,
  type HrEmployeePayment,
} from "../hr.types";
import {
  formatYearMonth,
  getCivilMonthRangeIso,
  getCurrentYearMonthLisbon,
  parseTimeToMinutes,
} from "../dates";
import { formatEUR, formatIsoDatePt } from "../../../lib/format";

// ── helpers ──────────────────────────────────────────────────────────────────

const PAYMENT_TYPE_LABELS: Record<HrEmployeePayment["paymentType"], string> = {
  salary: "Salário",
  bonus: "Bónus",
  deduction: "Desconto",
  other: "Outro",
};

const PAYMENT_TYPE_COLORS: Record<HrEmployeePayment["paymentType"], string> = {
  salary: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  bonus: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  deduction: "bg-red-50 text-red-700 ring-red-200",
  other: "bg-slate-50 text-slate-600 ring-slate-200",
};

function prevYearMonth(year: number, month: number) {
  if (month <= 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

function nextYearMonth(year: number, month: number) {
  if (month >= 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

/** Calcula minutos extra: actualEndTime − endTime se positivo. */
function overtimeMinutes(
  plannedEnd: string,
  actualEnd: string | null,
): number {
  if (!actualEnd) return 0;
  const planned = parseTimeToMinutes(plannedEnd);
  const actual = parseTimeToMinutes(actualEnd);
  if (planned == null || actual == null) return 0;
  return Math.max(0, actual - planned);
}

function fmtMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCsv(payments: HrEmployeePayment[], employeeName: string, month: string) {
  const header = "Data,Tipo,Mês ref.,Valor (€),Pago,Notas";
  const rows = payments.map((p) => [
    p.paymentDate,
    PAYMENT_TYPE_LABELS[p.paymentType],
    formatSalaryPeriodLabel(p) !== "—" ? formatSalaryPeriodLabel(p) : "",
    p.amount.toFixed(2),
    p.isPaid ? "Sim" : "Não",
    p.notes ?? "",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pagamentos_${employeeName.replace(/\s+/g, "_")}_${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Summary cards ─────────────────────────────────────────────────────────────

function SummaryCards({
  payments,
  prevPayments,
  baseSalary,
  salaryType,
  hourlyRate,
  workedMins,
  overtimeMins,
}: {
  payments: HrEmployeePayment[];
  prevPayments: HrEmployeePayment[];
  baseSalary: number | null;
  salaryType: "fixed" | "hourly";
  hourlyRate: number | null;
  workedMins: number;
  overtimeMins: number;
}) {
  const salaryPaid = payments.filter((p) => p.paymentType === "salary").reduce((s, p) => s + p.amount, 0);
  const bonuses = payments.filter((p) => p.paymentType === "bonus").reduce((s, p) => s + p.amount, 0);
  const deductions = payments.filter((p) => p.paymentType === "deduction").reduce((s, p) => s + p.amount, 0);

  // For hourly: suggested salary = worked hours × rate
  const suggestedHourly = salaryType === "hourly" && hourlyRate != null
    ? Math.round((workedMins / 60) * hourlyRate * 100) / 100
    : null;

  // Use registered salary payment; fall back to configured value if none registered yet
  const salaryFallback = salaryType === "hourly" ? (suggestedHourly ?? 0) : (baseSalary ?? 0);
  const salaryDisplay = salaryPaid > 0 ? salaryPaid : salaryFallback;
  const total = salaryDisplay + bonuses - deductions;

  const prevSalaryPaid = prevPayments.filter((p) => p.paymentType === "salary").reduce((s, p) => s + p.amount, 0);
  const prevBonuses = prevPayments.filter((p) => p.paymentType === "bonus").reduce((s, p) => s + p.amount, 0);
  const prevDeductions = prevPayments.filter((p) => p.paymentType === "deduction").reduce((s, p) => s + p.amount, 0);
  const prevSalaryDisplay = prevSalaryPaid > 0 ? prevSalaryPaid : salaryFallback;
  const prevTotal = prevSalaryDisplay + prevBonuses - prevDeductions;
  const diff = total - prevTotal;

  const workedH = Math.floor(workedMins / 60);
  const workedM = workedMins % 60;
  const workedLabel = workedM > 0 ? `${workedH}h ${workedM}min` : `${workedH}h`;

  const cards = [
    {
      label: salaryType === "hourly" ? "Salário (estimado)" : "Salário",
      value: formatEUR(salaryDisplay),
      color: "text-slate-900",
      sub: salaryPaid === 0 && salaryType === "hourly" && suggestedHourly != null
        ? <span className="text-slate-400 text-[10px]">{workedLabel} × {formatEUR(hourlyRate!)} /h</span>
        : salaryPaid === 0 && salaryType === "fixed" && baseSalary != null
          ? <span className="text-slate-400 text-[10px]">salário base</span>
          : null,
    },
    { label: "Bónus", value: formatEUR(bonuses), color: "text-emerald-600", sub: null },
    { label: "Descontos", value: formatEUR(deductions), color: "text-red-600", sub: null },
    {
      label: "Total a pagar",
      value: formatEUR(total),
      color: "text-indigo-700",
      sub: prevPayments.length > 0 || prevTotal > 0
        ? diff === 0
          ? <span className="text-slate-400">= mês ant.</span>
          : diff > 0
            ? <span className="text-emerald-600">↑ {formatEUR(diff)} vs mês ant.</span>
            : <span className="text-red-500">↓ {formatEUR(Math.abs(diff))} vs mês ant.</span>
        : null,
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">{c.label}</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${c.color}`}>{c.value}</p>
          {c.sub && <p className="mt-0.5 text-xs">{c.sub}</p>}
        </div>
      ))}
      {salaryType === "hourly" && workedMins > 0 && (
        <div className="col-span-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 sm:col-span-4">
          <p className="text-xs font-medium text-indigo-800">
            Horas trabalhadas: <span className="font-bold">{workedLabel}</span>
            {hourlyRate != null && (
              <> × <span className="font-bold">{formatEUR(hourlyRate)}/h</span>
              {" "}= <span className="font-bold">{formatEUR(Math.round((workedMins / 60) * hourlyRate * 100) / 100)}</span>
              </>
            )}
            {" "}— verifique os turnos conferidos antes de processar o salário.
          </p>
        </div>
      )}
      {salaryType === "fixed" && overtimeMins > 0 && (
        <div className="col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:col-span-4">
          <p className="text-xs font-medium text-amber-800">
            Horas extra este mês: <span className="font-bold">{fmtMinutes(overtimeMins)}</span>
            {" "}— verifique se há bónus ou compensação a registar.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PaymentsTab({
  employeeId,
  employee,
  onCreatePayment,
  onEditPayment,
  onDeletePayment,
}: {
  employeeId: string;
  employee: HrEmployee | null;
  onCreatePayment: () => void;
  onEditPayment: (p: HrEmployeePayment) => void;
  onDeletePayment: (p: HrEmployeePayment) => void;
}) {
  const qc = useQueryClient();
  const initial = getCurrentYearMonthLisbon();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);

  function goBack() {
    const p = prevYearMonth(year, month);
    setYear(p.year);
    setMonth(p.month);
  }
  function goForward() {
    const p = nextYearMonth(year, month);
    setYear(p.year);
    setMonth(p.month);
  }

  const range = useMemo(() => getCivilMonthRangeIso(year, month), [year, month]);
  const payFilters = useMemo<ListPaymentsParams>(() => ({ year, month }), [year, month]);
  const prevPayFilters = useMemo<ListPaymentsParams>(() => {
    const p = prevYearMonth(year, month);
    return { year: p.year, month: p.month };
  }, [year, month]);

  const { data: payments = [], isPending } = useQuery({
    queryKey: hrQueryKeys.payments(employeeId, payFilters),
    queryFn: () => fetchEmployeePayments(employeeId, payFilters),
    enabled: Boolean(employeeId),
  });

  const { data: prevPayments = [] } = useQuery({
    queryKey: hrQueryKeys.payments(employeeId, prevPayFilters),
    queryFn: () => fetchEmployeePayments(employeeId, prevPayFilters),
    enabled: Boolean(employeeId),
  });

  // Shifts for overtime calculation
  const { data: shifts = [] } = useQuery({
    queryKey: hrQueryKeys.shifts({ employeeId, from: range.from, to: range.to }),
    queryFn: () => fetchShifts({ employeeId, from: range.from, to: range.to }),
    enabled: Boolean(employeeId),
  });

  // Estimativa baseada nas horas planeadas (não nas reais), excluindo turnos cancelados
  const totalWorkedMins = useMemo(
    () => shifts.reduce((sum, s) => {
      if (s.attendance?.status === "cancelled") return sum;
      const start = parseTimeToMinutes(s.startTime);
      const end = parseTimeToMinutes(s.endTime);
      if (start == null || end == null) return sum;
      return sum + Math.max(0, end - start);
    }, 0),
    [shifts],
  );

  const totalOvertimeMins = useMemo(
    () => shifts.reduce((sum, s) => {
      if (s.attendance?.status === "cancelled" || !s.attendance) return sum;
      return sum + overtimeMinutes(s.endTime, s.attendance.actualEndTime);
    }, 0),
    [shifts],
  );

  const togglePaidMut = useMutation({
    mutationFn: (p: HrEmployeePayment) =>
      patchPayment(p.id, { isPaid: !p.isPaid }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: hrQueryKeys.root }),
  });

  const monthLabel = formatYearMonth(year, month);

  return (
    <div className="mt-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={goBack}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
          ←
        </button>
        <span className="text-sm font-semibold text-slate-800">{monthLabel}</span>
        <button type="button" onClick={goForward}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
          →
        </button>
        <div className="ml-auto flex gap-2">
          {payments.length > 0 && (
            <button
              type="button"
              onClick={() => exportCsv(payments, employee?.fullName ?? "funcionario", `${year}-${String(month).padStart(2, "0")}`)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Exportar CSV
            </button>
          )}
          <button type="button" onClick={onCreatePayment}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Novo pagamento
          </button>
        </div>
      </div>

      {/* Summary */}
      <SummaryCards
        payments={payments}
        prevPayments={prevPayments}
        baseSalary={employee?.baseSalary ?? null}
        salaryType={employee?.salaryType ?? "fixed"}
        hourlyRate={employee?.hourlyRate ?? null}
        workedMins={totalWorkedMins}
        overtimeMins={totalOvertimeMins}
      />

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Mês ref.</th>
              <th className="px-3 py-2">Valor</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Notas</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-400">
                  A carregar…
                </td>
              </tr>
            ) : payments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">
                  Sem pagamentos em {monthLabel}.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3 py-2 text-slate-700">{formatIsoDatePt(p.paymentDate)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${PAYMENT_TYPE_COLORS[p.paymentType]}`}>
                      {PAYMENT_TYPE_LABELS[p.paymentType]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {formatSalaryPeriodLabel(p)}
                  </td>
                  <td className="px-3 py-2 font-medium tabular-nums">
                    <span className={p.paymentType === "deduction" ? "text-red-600" : "text-slate-900"}>
                      {p.paymentType === "deduction" ? "−" : ""}{formatEUR(p.amount)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={togglePaidMut.isPending}
                      onClick={() => togglePaidMut.mutate(p)}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 transition-colors ${
                        p.isPaid
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
                          : "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100"
                      }`}
                    >
                      {p.isPaid ? "✓ Pago" : "Pendente"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{p.notes ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" className="text-indigo-700 hover:underline"
                      onClick={() => onEditPayment(p)}>
                      Editar
                    </button>
                    {" · "}
                    <button type="button" className="text-red-700 hover:underline"
                      onClick={() => onDeletePayment(p)}>
                      Apagar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
