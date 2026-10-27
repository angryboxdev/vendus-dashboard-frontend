import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { Button, FIELD, LABEL, StatusBadge } from "../../../../../components/ui/index.ts";
import type { AttendanceDays } from "../../../domain/entities/attendance.ts";
import { timeIn } from "../../../domain/services/attendance.service.ts";
import { dayQuickActions } from "../../../domain/services/day-actions.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

type Choice = "fulfilled" | "confirm" | "justify";

/** Atraso ou falta num clique: «Cumpriu horário», confirmar ou justificar — com motivo pré-preenchido. */
export function DayQuickActions({ data, date }: { data: AttendanceDays; date: string }) {
  const { t } = useI18n();
  const { attendance } = useNovoRh();
  const qc = useQueryClient();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [text, setText] = useState("");
  const a = dayQuickActions(data, date, new Date().toISOString());
  const tz = data.timeZone;
  const run = useMutation({
    mutationFn: async () => {
      if (!a) return;
      if (choice === "fulfilled") {
        for (const c of a.fulfilled ?? []) await attendance.revise(data.employeeId, { ...c, reason: text.trim() });
      } else if (a.incident) {
        await attendance.resolveIncident(a.incident.id, choice === "justify" ? "validate" : "dismiss", text.trim());
      }
    },
    onSuccess: async () => {
      setChoice(null);
      await qc.invalidateQueries({ queryKey: ["novo-rh", "attendance"] });
    },
  });
  if (!a) return null;

  const planned = timeIn(a.plannedAt, tz);
  const plannedEnd = a.plannedEndAt ? timeIn(a.plannedEndAt, tz) : null;
  const shift = plannedEnd ? `${planned}–${plannedEnd}` : planned;
  const late = a.kind === "late";
  const open = a.incident?.status === "open";
  const resolved = a.incident && !open ? a.incident : null;

  const pick = (c: Choice) => {
    run.reset();
    setChoice(c);
    if (c === "fulfilled") setText(late ? t("att.quick.reason.fulfilledLate", { time: planned }) : t("att.quick.reason.fulfilledAbsent", { shift }));
    else if (c === "confirm") setText(late ? t("att.quick.reason.lateConfirmed", { minutes: a.lateMinutes }) : t("att.quick.reason.absentConfirmed"));
    else setText("");
  };
  const effect: Record<Choice, string> = {
    fulfilled: late ? t("att.quick.effect.fulfilledLate", { from: timeIn(a.entryAt!, tz), to: planned }) : t(a.fulfilled && a.fulfilled.length > 1 ? "att.quick.effect.fulfilledAbsent" : "att.quick.effect.fulfilledAbsentIn", { start: planned, end: plannedEnd ?? "" }),
    confirm: late ? t("att.quick.effect.lateConfirmed") : t("att.quick.effect.absentConfirmed"),
    justify: t("att.quick.effect.justified"),
  };

  return (
    <div className="space-y-2 rounded-lg border border-[#F5C992] bg-[#FDF8F5] p-3" role="region" aria-label={t("att.quick.title")}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={late ? "warning" : "danger"}>{late ? t("att.incident.late") : t("att.incident.missing_in")}</StatusBadge>
        <span className="text-sm text-stone-800">
          {late ? t("att.quick.lateSummary", { minutes: a.lateMinutes, planned, entry: timeIn(a.entryAt!, tz) }) : t("att.quick.absentSummary", { shift })}
        </span>
      </div>

      {resolved ? (
        <p className="text-sm text-stone-700">
          <StatusBadge tone="neutral">{t(`att.quick.outcome.${resolved.type === "late" ? "late" : "absent"}.${resolved.status}` as MessageKey)}</StatusBadge>
          {resolved.comment && <span className="ml-2">{resolved.comment}</span>}
          {resolved.resolvedBy && <span className="ml-2 text-xs text-stone-500">— {resolved.resolvedBy}</span>}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {a.fulfilled && (
              <Button size="sm" variant={choice === "fulfilled" ? "primary" : "secondary"} onClick={() => pick("fulfilled")}>
                {t("att.quick.fulfilled")}
              </Button>
            )}
            <Button size="sm" variant={choice === "confirm" ? "primary" : "secondary"} disabled={!open} onClick={() => pick("confirm")}>
              {late ? t("att.quick.lateConfirm") : t("att.quick.absentConfirm")}
            </Button>
            {late && (
              <Button size="sm" variant={choice === "justify" ? "primary" : "secondary"} disabled={!open} onClick={() => pick("justify")}>
                {t("att.quick.justify")}
              </Button>
            )}
          </div>
          {!a.incident && <p className="text-xs text-stone-500">{t("att.quick.noIncident")}</p>}
          {late && !a.fulfilled && <p className="text-xs text-stone-500">{t("att.quick.cannotFulfil")}</p>}
        </>
      )}

      {choice && !resolved && (
        <div className="space-y-2 border-t border-[#F5C992] pt-2">
          <p className="text-xs text-stone-600">{effect[choice]}</p>
          <label className="block">
            <span className={LABEL}>{choice === "fulfilled" ? t("att.field.reason") : choice === "justify" ? t("att.quick.justification") : t("att.field.comment")}</span>
            <input className={`${FIELD} w-full`} maxLength={500} value={text} placeholder={choice === "justify" ? t("att.quick.justifyPlaceholder") : undefined} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" disabled={!text.trim() || run.isPending} onClick={() => run.mutate()}>
              {t("att.quick.apply")}
            </Button>
            <Button size="sm" variant="tertiary" onClick={() => setChoice(null)}>
              {t("common.cancel")}
            </Button>
          </div>
          {run.isError && <p className="text-sm text-red-700">{run.error instanceof Error ? run.error.message : t("common.error")}</p>}
        </div>
      )}
    </div>
  );
}
