import type { ReactNode } from "react";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { StatusBadge, TABLE, TD, TH, THEAD, TR, type StatusTone } from "../../../../../components/ui/index.ts";
import type { AbsenceRequest } from "../../../domain/entities/absences.ts";
import { formatAmount, formatPeriod } from "../../../domain/services/absences.service.ts";

const TONE: Record<AbsenceRequest["status"], StatusTone> = { pending: "warning", approved: "success", rejected: "danger", cancelled: "neutral" };

/** Tabela de pedidos partilhada (gestão, aprovador, colaborador); `actions` por linha. */
export function RequestsTable({ rows, employeeName, actions }: { rows: AbsenceRequest[]; employeeName?: (id: string) => string; actions?: (r: AbsenceRequest) => ReactNode }) {
  const { t } = useI18n();
  return (
    <table className={TABLE}>
      <thead className={THEAD}>
        <tr>
          {employeeName && <th className={TH}>{t("common.employee")}</th>}
          <th className={TH}>{t("abs.col.type")}</th>
          <th className={TH}>{t("abs.col.period")}</th>
          <th className={TH}>{t("abs.col.amount")}</th>
          <th className={TH}>{t("abs.col.status")}</th>
          {actions && <th className={TH} />}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className={TR}>
            {employeeName && <td className={TD}>{employeeName(r.employeeId)}</td>}
            <td className={TD}>
              <span className="flex flex-wrap items-center gap-1">
                {r.typeColor && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.typeColor }} aria-hidden />}
                {r.typeName}
                {r.private && <StatusBadge tone="neutral">{t("abs.private")}</StatusBadge>}
              </span>
              {r.comment && <span className="block text-xs text-stone-500">{r.comment}</span>}
            </td>
            <td className={TD}>{formatPeriod(r)}</td>
            <td className={TD}>{formatAmount(r.amount, r.unit)}</td>
            <td className={TD}>
              <span className="flex flex-wrap items-center gap-1">
                <StatusBadge tone={TONE[r.status]}>{t(`abs.status.${r.status}` as MessageKey)}</StatusBadge>
                {r.status === "pending" && r.levels.length > 1 && <span className="text-xs text-stone-500">{`${t("abs.col.level")} ${r.currentLevel + 1}/${r.levels.length}`}</span>}
                {r.status === "pending" && r.levels[r.currentLevel]?.escalated && <StatusBadge tone="warning">{t("abs.escalated")}</StatusBadge>}
              </span>
              {r.cancelReason && <span className="block text-xs text-stone-500">{r.cancelReason}</span>}
            </td>
            {actions && <td className={TD}>{actions(r)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
