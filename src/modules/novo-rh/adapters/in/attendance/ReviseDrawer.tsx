import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { Button, Drawer, FIELD, LABEL } from "../../../../../components/ui/index.ts";
import type { RevisionOperation, SegmentType } from "../../../domain/entities/attendance.ts";
import { SEGMENTS, utcToZoned, zonedToUtc } from "../../../domain/services/attendance.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

export interface ReviseTarget {
  operation: RevisionOperation;
  /** Marcação a mudar/anular (id original ou `rev:<id>`). */
  event: { id: string; occurredAt: string; segmentType: SegmentType } | null;
  /** Data sugerida para uma marcação nova. */
  date: string;
}

/** Correção feita pela gestão: motivo obrigatório (RE-10); a original nunca é apagada. */
export function ReviseDrawer({ employeeId, timeZone, target, onClose }: { employeeId: string; timeZone: string; target: ReviseTarget | null; onClose: () => void }) {
  const { t } = useI18n();
  const { attendance } = useNovoRh();
  const qc = useQueryClient();
  const [when, setWhen] = useState(() => (target?.event ? utcToZoned(target.event.occurredAt, timeZone) : `${target?.date ?? ""}T09:00`));
  const [type, setType] = useState<SegmentType>(target?.event?.segmentType ?? "work");
  const [reason, setReason] = useState("");
  const op = target?.operation ?? "add";
  const save = useMutation({
    mutationFn: () =>
      attendance.revise(employeeId, {
        operation: op,
        targetEventId: target?.event?.id ?? null,
        occurredAt: op === "void" ? null : zonedToUtc(when, timeZone),
        segmentType: op === "void" ? null : op === "update" && type === target?.event?.segmentType ? null : type,
        reason,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["novo-rh", "attendance"] });
      onClose();
    },
  });
  const title = op === "add" ? t("att.revise.add") : op === "void" ? t("att.revise.void") : t("att.revise.title");
  return (
    <Drawer
      open={!!target}
      title={title}
      description={t("att.revise.hint")}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" disabled={!reason.trim() || save.isPending} onClick={() => save.mutate()}>
            {t("att.revise.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {op !== "void" && (
          <>
            <label className="block">
              <span className={LABEL}>{t("att.field.datetime")}</span>
              <input type="datetime-local" className={`${FIELD} w-full`} value={when} onChange={(e) => setWhen(e.target.value)} />
            </label>
            <label className="block">
              <span className={LABEL}>{t("att.field.type")}</span>
              <select className={`${FIELD} w-full`} value={type} onChange={(e) => setType(e.target.value as SegmentType)}>
                {SEGMENTS.map((s) => (
                  <option key={s} value={s}>
                    {t(`att.action.${s}` as MessageKey)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className="block">
          <span className={LABEL}>{t("att.field.reason")}</span>
          <textarea className={`${FIELD} w-full`} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        {save.isError && <p className="text-sm text-red-700">{save.error instanceof Error ? save.error.message : t("common.error")}</p>}
      </div>
    </Drawer>
  );
}
