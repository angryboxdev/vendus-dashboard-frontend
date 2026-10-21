import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { IconButton, IconChevronLeft, IconChevronRight, SURFACE } from "../../../../../components/ui/index.ts";
import type { Balance } from "../../../domain/entities/absences.ts";
import { formatAmount } from "../../../domain/services/absences.service.ts";
import { absenceMarks, balanceSummary, isWeekend, monthWeeks, type CalendarMark } from "../../../domain/services/person-overview.service.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { BalancesPanel, RequestsPanel } from "../absences/RequestPanels.tsx";

const KEY = ["novo-rh", "absences"];
const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];
const monthName = (m: number) => new Intl.DateTimeFormat("pt-PT", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, m - 1, 1)));
const FALLBACK = "#2563EB";

/** Ficha → Ausências e férias: saldos, calendário do ano (aprovadas e pendentes) e pedidos da pessoa. */
export function PersonAbsencesTab({ personId }: { personId: string }) {
  const { t } = useI18n();
  const { absences } = useNovoRh();
  const today = todayIn();
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  // Mesma chave do painel de saldos: ajustes e pedidos invalidam os dois.
  const balances = useQuery({ queryKey: [...KEY, "balances", personId], queryFn: () => absences.balances(personId) });
  const requests = useQuery({ queryKey: [...KEY, "requests", "year", personId, year], queryFn: () => absences.listRequests({ employeeId: personId, from, to }) });
  const marks = absenceMarks(requests.data ?? [], from, to);

  return (
    <div className="space-y-4">
      <BalanceCards balances={balances.data} loading={balances.isLoading} error={balances.isError} />

      <section className={`${SURFACE} overflow-hidden`} aria-label={t("abs.person.calendar")}>
        <div className="flex flex-wrap items-center gap-3 border-b border-line-subtle bg-surface-soft/60 px-4 py-3">
          <div className="mx-auto flex items-center gap-1 rounded-xl border border-line bg-surface-card px-1 sm:mx-0">
            <IconButton label={t("abs.person.prevYear")} size="sm" onClick={() => setYear(year - 1)}>
              <IconChevronLeft size={16} />
            </IconButton>
            <span className="min-w-16 text-center text-base font-semibold tabular-nums text-navy-900">{year}</span>
            <IconButton label={t("abs.person.nextYear")} size="sm" onClick={() => setYear(year + 1)}>
              <IconChevronRight size={16} />
            </IconButton>
          </div>
          <Legend />
        </div>
        {requests.isError && <p className="px-4 pt-3 text-sm text-red-700">{t("common.loadError")}</p>}
        <div className="grid gap-x-6 gap-y-6 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 12 }, (_, i) => (
            <Month key={i} year={year} month={i + 1} marks={marks} today={today} />
          ))}
        </div>
      </section>

      <RequestsPanel fixedEmployeeId={personId} />
      <details className={`${SURFACE} group p-4`}>
        <summary className="cursor-pointer text-sm font-medium text-navy-900">{t("abs.person.manage")}</summary>
        <div className="mt-3">
          <BalancesPanel fixedEmployeeId={personId} />
        </div>
      </details>
    </div>
  );
}

function BalanceCards({ balances, loading, error }: { balances: Balance[] | undefined; loading: boolean; error: boolean }) {
  const { t } = useI18n();
  if (loading) return <p className="text-sm text-stone-400">{t("common.loading")}</p>;
  if (error) return <p className="text-sm text-red-700">{t("common.loadError")}</p>;
  if (!balances?.length) return <p className={`${SURFACE} p-4 text-sm text-ink-secondary`}>{t("abs.person.noBalances")}</p>;
  // Os saldos com limite (ex.: férias) primeiro.
  const sorted = [...balances].sort((a, b) => Number(b.limited) - Number(a.limited));
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {sorted.map((b) => {
        const s = balanceSummary(b);
        const cell = (label: string, value: string, tone = "text-navy-900") => (
          <div className="min-w-0 border-line-subtle px-4 first:pl-0 [&:not(:first-child)]:border-l">
            <p className="truncate text-xs text-ink-secondary">{label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
          </div>
        );
        return (
          <li key={b.typeId} className={`${SURFACE} p-4 sm:p-5`}>
            <p className="mb-3 flex items-baseline gap-2">
              <span className="text-base font-semibold text-navy-900">{b.typeName}</span>
              <span className="text-sm text-ink-muted">{b.period}</span>
            </p>
            <div className="grid grid-cols-4">
              {cell(t("abs.person.available"), b.limited ? formatAmount(s.available, b.unit) : t("abs.balance.unlimited"), s.available < 0 ? "text-red-700" : "text-emerald-700")}
              {cell(t("abs.person.used"), formatAmount(s.used, b.unit))}
              {cell(t("abs.person.pending"), formatAmount(s.pending, b.unit), s.pending > 0 ? "text-amber-700" : "text-navy-900")}
              {cell(t("abs.person.total"), b.limited ? formatAmount(s.total, b.unit) : "—")}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Legend() {
  const { t } = useI18n();
  const item = (swatch: string, label: string) => (
    <li className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`h-3.5 w-3.5 rounded ${swatch}`} />
      {label}
    </li>
  );
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-secondary sm:ml-auto">
      {item("bg-[#2563EB]", t("abs.person.approved"))}
      {item("border border-dashed border-amber-500 bg-amber-100", t("abs.person.pendingMark"))}
      {item("bg-surface-soft", t("abs.person.weekend"))}
      {item("ring-2 ring-inset ring-navy-900", t("abs.person.today"))}
    </ul>
  );
}

function Month({ year, month, marks, today }: { year: number; month: number; marks: Map<string, CalendarMark>; today: string }) {
  const { t } = useI18n();
  return (
    <div>
      <h3 className="mb-2 text-center text-sm font-semibold capitalize text-navy-900">{monthName(month)}</h3>
      <table className="w-full table-fixed text-center text-xs">
        <thead>
          <tr>
            {WEEKDAYS.map((d, i) => (
              <th key={i} scope="col" className="pb-1 font-medium text-ink-muted">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthWeeks(year, month).map((week, w) => (
            <tr key={w}>
              {week.map((d, i) => {
                if (!d) return <td key={i} />;
                const mark = marks.get(d);
                const status = mark ? (mark.status === "approved" ? t("abs.person.approved") : t("abs.person.pendingMark")) : null;
                const base = "mx-auto flex h-7 w-7 items-center justify-center rounded-md tabular-nums";
                const look = mark
                  ? mark.status === "approved"
                    ? "font-semibold text-white"
                    : "border border-dashed border-amber-500 bg-amber-100 font-semibold text-amber-900"
                  : isWeekend(d)
                    ? "bg-surface-soft text-ink-muted"
                    : "text-ink";
                return (
                  <td key={i} className="py-0.5">
                    <span
                      className={`${base} ${look} ${d === today ? "ring-2 ring-inset ring-navy-900" : ""}`}
                      style={mark?.status === "approved" ? { backgroundColor: mark.color ?? FALLBACK } : undefined}
                      title={mark ? t("abs.person.dayTitle", { date: `${d.slice(8)}/${d.slice(5, 7)}`, type: mark.typeName, status: status! }) : undefined}
                      aria-label={mark ? t("abs.person.dayTitle", { date: `${d.slice(8)}/${d.slice(5, 7)}`, type: mark.typeName, status: status! }) : undefined}
                    >
                      {Number(d.slice(8))}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
