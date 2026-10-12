import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { FIELD, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { formatMinutes } from "../../../domain/services/time-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const monthBounds = (today: string) => {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${today.slice(0, 7)}-01`, to: `${today.slice(0, 7)}-${String(last).padStart(2, "0")}` };
};

/** Tempo → Tempo teórico por colaborador (TK-11), com o motivo de cada dia. */
export function TheoreticalPanel({ fixedEmployeeId }: { fixedEmployeeId?: string } = {}) {
  const { t } = useI18n();
  const { time, settings } = useNovoRh();
  const [employeeId, setEmployeeId] = useState(fixedEmployeeId ?? "");
  const [range, setRange] = useState(() => monthBounds(todayIn()));
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const q = useQuery({ queryKey: ["novo-rh", "time", "theoretical", employeeId, range], queryFn: () => time.theoretical(employeeId, range.from, range.to), enabled: !!employeeId });

  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      <p className="text-xs text-stone-500">{t("time.theoretical.hint")}</p>
      <div className="flex flex-wrap gap-2">
        {!fixedEmployeeId && (
          <select aria-label={t("common.employee")} className={`${FIELD} min-w-[220px]`} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">{t("common.employee")}…</option>
            {(employees.data ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        <input aria-label={t("common.from")} type="date" className={FIELD} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <input aria-label={t("common.to")} type="date" className={FIELD} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
      </div>
      {q.isError && <p className="text-sm text-red-700">{q.error instanceof Error ? q.error.message : t("common.loadError")}</p>}
      {q.data && (
        <>
          <p className="text-sm font-semibold text-stone-900">{t("time.theoretical.total", { total: formatMinutes(q.data.totalMinutes) })}</p>
          <div className="max-h-[480px] overflow-auto">
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>{t("common.date")}</th>
                  <th className={TH}>{t("time.tab.theoretical")}</th>
                  <th className={TH}>{t("settings.effective.origin")}</th>
                </tr>
              </thead>
              <tbody>
                {q.data.days.map((d) => (
                  <tr key={d.date} className={TR}>
                    <td className={TD}>{d.date}</td>
                    <td className={`${TD} font-semibold`}>{formatMinutes(d.minutes)}</td>
                    <td className={TD}>
                      <span className="flex flex-wrap items-center gap-1">
                        {t(`time.reason.${d.reason}` as MessageKey)}
                        {d.holidayName && ` · ${d.holidayName}`}
                        {d.scheduleName && d.reason !== "holiday" && <span className="text-xs text-stone-400">{d.scheduleName}</span>}
                        {d.warnings.includes("holiday_to_confirm") && <StatusBadge tone="warning">{t("time.holidays.toConfirm")}</StatusBadge>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
