import { useState } from "react";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Button, FIELD, LABEL } from "../../../../../components/ui/index.ts";
import type { AbsenceType, RequestInput } from "../../../domain/entities/absences.ts";

/** Formulário de pedido/atribuição: horas num só dia, dias com meio dia opcional. */
export function RequestForm({ types, submitLabel, busy, onSubmit }: { types: AbsenceType[]; submitLabel: string; busy: boolean; onSubmit: (input: RequestInput) => void }) {
  const { t } = useI18n();
  const [typeId, setTypeId] = useState("");
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [halfDay, setHalfDay] = useState(false);
  const [comment, setComment] = useState("");
  const type = types.find((x) => x.id === typeId);
  const hours = type?.unit === "hours";
  const ready = !!type && !!startDate && (hours || !!endDate || halfDay);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label>
        <span className={LABEL}>{t("abs.field.type")}</span>
        <select className={`${FIELD} min-w-[200px]`} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">{t("common.choose")}…</option>
          {types.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className={LABEL}>{t("abs.field.start")}</span>
        <input type="date" className={FIELD} value={startDate} onChange={(e) => setStart(e.target.value)} />
      </label>
      {hours ? (
        <>
          <label>
            <span className={LABEL}>{t("abs.field.startTime")}</span>
            <input type="time" className={FIELD} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label>
            <span className={LABEL}>{t("abs.field.endTime")}</span>
            <input type="time" className={FIELD} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </>
      ) : (
        <>
          {!halfDay && (
            <label>
              <span className={LABEL}>{t("abs.field.end")}</span>
              <input type="date" className={FIELD} value={endDate} min={startDate} onChange={(e) => setEnd(e.target.value)} />
            </label>
          )}
          {type?.halfDay && (
            <label className="flex items-center gap-1 pb-2 text-sm text-stone-700">
              <input type="checkbox" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} />
              {t("abs.field.halfDay")}
            </label>
          )}
        </>
      )}
      <label className="min-w-[200px] flex-1">
        <span className={LABEL}>{t("abs.field.comment")}</span>
        <input className={`${FIELD} w-full`} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      <Button
        variant="primary"
        disabled={!ready || busy}
        onClick={() =>
          onSubmit({
            typeId,
            startDate,
            endDate: hours || halfDay ? startDate : endDate,
            startTime: hours ? startTime : null,
            endTime: hours ? endTime : null,
            halfDay: !hours && halfDay,
            comment: comment.trim() || null,
          })
        }
      >
        {submitLabel}
      </Button>
    </div>
  );
}
