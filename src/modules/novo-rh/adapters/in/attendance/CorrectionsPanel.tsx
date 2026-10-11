import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { Button, FIELD, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../../components/ui/index.ts";
import type { CorrectionRequest } from "../../../domain/entities/attendance.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "—");

/** Pedidos de correção pendentes: outra pessoa da gestão aprova (vira correção) ou recusa com motivo. */
export function CorrectionsPanel() {
  const { t } = useI18n();
  const { attendance, settings } = useNovoRh();
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const q = useQuery({ queryKey: ["novo-rh", "attendance", "corrections", "pending"], queryFn: () => attendance.corrections("pending") });
  const name = (id: string) => employees.data?.find((e) => e.id === id)?.label ?? id;

  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      {q.isError && <p className="text-sm text-red-700">{q.error instanceof Error ? q.error.message : t("common.loadError")}</p>}
      {q.data && q.data.length === 0 && <p className="text-sm text-stone-500">{t("att.corrections.none")}</p>}
      {q.data && q.data.length > 0 && (
        <table className={TABLE}>
          <thead className={THEAD}>
            <tr>
              <th className={TH}>{t("common.employee")}</th>
              <th className={TH}>{t("att.col.type")}</th>
              <th className={TH}>{t("att.col.time")}</th>
              <th className={TH}>{t("att.col.reason")}</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {q.data.map((c) => (
              <tr key={c.id} className={TR}>
                <td className={TD}>{name(c.employeeId)}</td>
                <td className={TD}>
                  {t(`att.revise.${c.operation}` as MessageKey)}
                  {c.segmentType && ` · ${t(`att.segment.${c.segmentType}` as MessageKey)}`}
                </td>
                <td className={TD}>{when(c.occurredAt)}</td>
                <td className={TD}>{c.reason}</td>
                <td className={TD}>
                  <Decide request={c} label={name(c.employeeId)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Decide({ request, label }: { request: CorrectionRequest; label: string }) {
  const { t } = useI18n();
  const { attendance } = useNovoRh();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const m = useMutation({
    mutationFn: (d: "approve" | "reject") => attendance.decide(request.id, d, comment.trim() || null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["novo-rh", "attendance"] }),
  });
  return (
    <div className="flex flex-wrap items-center gap-1">
      <input aria-label={`${t("att.field.comment")} ${label}`} className={`${FIELD} w-40`} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("att.field.comment")} />
      <Button size="sm" variant="primary" disabled={m.isPending} onClick={() => m.mutate("approve")}>
        {t("att.corrections.approve")}
      </Button>
      <Button size="sm" disabled={m.isPending || !comment.trim()} title={!comment.trim() ? t("att.corrections.rejectHint") : undefined} onClick={() => m.mutate("reject")}>
        {t("att.corrections.reject")}
      </Button>
      {m.isError && <span className="text-xs text-red-700">{m.error instanceof Error ? m.error.message : t("common.error")}</span>}
    </div>
  );
}
