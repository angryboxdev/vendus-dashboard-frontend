import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../../../../lib/api.ts";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AlertBanner, Button, FIELD, LABEL, SECTION_TITLE, StatusBadge, SURFACE } from "../../../../../components/ui/index.ts";
import type { SegmentType } from "../../../domain/entities/attendance.ts";
import { formatDuration, nextActions, SEGMENTS, timeIn, zonedToUtc } from "../../../domain/services/attendance.service.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/**
 * O meu ponto (Novo RH, em teste): picar com fila offline (RE-9), o dia de
 * hoje, recusar correções da gestão no prazo (RE-11) e pedir correções.
 */
export function MyClockPanel() {
  const { t } = useI18n();
  const { myClock, punchQueue } = useNovoRh();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ["novo-rh", "my-clock"], queryFn: () => myClock.status(), retry: false });
  const [pending, setPending] = useState(() => punchQueue.pending().length);
  const breakTypes = useQuery({ queryKey: ["novo-rh", "my-clock", "break-types"], queryFn: () => myClock.breakTypes() });
  const breaks = breakTypes.data ?? [];
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const flush = useCallback(async () => {
    const r = await punchQueue.flush(
      async (p) => {
        await myClock.punch({ segmentType: p.segmentType, clientEventId: p.clientEventId, occurredAt: p.createdAt, breakTypeId: p.breakTypeId ?? null });
      },
      (e) => !(e instanceof ApiError),
    );
    setPending(punchQueue.pending().length);
    if (r.refused.length) setError(t("att.queue.refused", { message: message(r.refused[0]!.error, t("common.error")) }));
    if (r.sent || r.refused.length) await qc.invalidateQueries({ queryKey: ["novo-rh", "my-clock"] });
  }, [myClock, punchQueue, qc, t]);

  useEffect(() => {
    void flush();
    const online = () => void flush();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [flush]);

  const punch = async (segmentType: SegmentType, breakTypeId: string | null = null) => {
    setError(null);
    setBusy(true);
    punchQueue.add(segmentType, new Date().toISOString(), breakTypeId);
    setPending(punchQueue.pending().length);
    try {
      await flush();
    } finally {
      setBusy(false);
    }
  };

  if (status.isError) return <AlertBanner tone="warning" title={message(status.error, t("common.loadError"))} />;
  if (!status.data) return <p className="text-sm text-stone-500">{t("common.loading")}</p>;
  const s = status.data;
  const tz = s.timeZone;

  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-500">{t("att.myClock.hint")}</p>
      <section className={`${SURFACE} space-y-3 p-4`} aria-label={t("att.tab.myClock")}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={s.state === "off" ? "neutral" : "success"}>{t(`att.segment.${s.state}` as MessageKey)}</StatusBadge>
          {s.since && s.state !== "off" && <span className="text-sm text-stone-500">{t("att.since", { time: timeIn(s.since, tz) })}</span>}
        </div>
        <p className="text-sm font-semibold text-stone-900">{t("att.today", { worked: formatDuration(s.today.workedSeconds), theoretical: formatDuration(s.today.theoreticalSeconds) })}</p>
        <div className="flex flex-wrap gap-2">
          {nextActions(s.state)
            // FE-103: com catálogo de pausas, escolhe-se a pausa pelo nome (o servidor decide se é paga).
            .filter((a) => !(breaks.length && (a === "break_paid" || a === "break_unpaid")))
            .map((a, i) => (
              <Button key={a} variant={i === 0 ? "primary" : "secondary"} disabled={busy} onClick={() => void punch(a)}>
                {t(`att.action.${a}` as MessageKey)}
              </Button>
            ))}
          {breaks.length > 0 &&
            nextActions(s.state).some((a) => a === "break_paid" || a === "break_unpaid") &&
            breaks.map((b) => (
              <Button key={b.id} disabled={busy} onClick={() => void punch(b.remuneration === "unpaid" ? "break_unpaid" : "break_paid", b.id)}>
                {t("att.action.breakOf", { name: b.name })}
              </Button>
            ))}
        </div>
        {pending > 0 && <AlertBanner tone="info" title={t("att.queue.pending", { count: pending })} />}
        {error && <AlertBanner tone="danger" title={error} />}
      </section>

      {s.refusable.map((r) => (
        <RefusableRevision key={r.id} id={r.id} text={t("att.revision.refusable", { reason: r.reason, until: new Date(r.refusableUntil!).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short", timeZone: tz }) })} />
      ))}

      <RequestCorrection timeZone={tz} />
    </div>
  );
}

function RefusableRevision({ id, text }: { id: string; text: string }) {
  const { t } = useI18n();
  const { myClock } = useNovoRh();
  const qc = useQueryClient();
  const m = useMutation({ mutationFn: () => myClock.refuse(id, null), onSuccess: () => qc.invalidateQueries({ queryKey: ["novo-rh", "my-clock"] }) });
  return (
    <AlertBanner
      tone="warning"
      title={text}
      action={
        <Button size="sm" disabled={m.isPending} onClick={() => m.mutate()}>
          {t("att.revision.refuse")}
        </Button>
      }
    >
      {m.isError && <span className="text-red-700">{message(m.error, t("common.error"))}</span>}
    </AlertBanner>
  );
}

function RequestCorrection({ timeZone }: { timeZone: string }) {
  const { t } = useI18n();
  const { myClock } = useNovoRh();
  const qc = useQueryClient();
  const [when, setWhen] = useState(() => `${todayIn(timeZone)}T09:00`);
  const [type, setType] = useState<SegmentType>("work");
  const [reason, setReason] = useState("");
  const list = useQuery({ queryKey: ["novo-rh", "my-clock", "corrections"], queryFn: () => myClock.corrections() });
  const m = useMutation({
    mutationFn: () => myClock.requestCorrection({ operation: "add", targetEventId: null, occurredAt: zonedToUtc(when, timeZone), segmentType: type, reason }),
    onSuccess: async () => {
      setReason("");
      await qc.invalidateQueries({ queryKey: ["novo-rh", "my-clock", "corrections"] });
    },
  });
  return (
    <section className={`${SURFACE} space-y-3 p-4`} aria-label={t("att.myClock.request")}>
      <h3 className={SECTION_TITLE}>{t("att.myClock.request")}</h3>
      <div className="flex flex-wrap items-end gap-2">
        <label>
          <span className={LABEL}>{t("att.field.datetime")}</span>
          <input type="datetime-local" className={FIELD} value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        <label>
          <span className={LABEL}>{t("att.field.type")}</span>
          <select className={FIELD} value={type} onChange={(e) => setType(e.target.value as SegmentType)}>
            {SEGMENTS.map((x) => (
              <option key={x} value={x}>
                {t(`att.action.${x}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[240px] flex-1">
          <span className={LABEL}>{t("att.field.reason")}</span>
          <input className={`${FIELD} w-full`} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <Button variant="primary" disabled={!reason.trim() || m.isPending} onClick={() => m.mutate()}>
          {t("att.myClock.request")}
        </Button>
      </div>
      {m.isError && <p className="text-sm text-red-700">{message(m.error, t("common.error"))}</p>}
      {(list.data ?? []).length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t("att.myClock.requests")}</h4>
          <ul className="space-y-1 text-sm text-stone-700">
            {list.data!.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2">
                <span>{c.occurredAt ? new Date(c.occurredAt).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short", timeZone }) : "—"}</span>
                <span>{c.reason}</span>
                <StatusBadge tone={c.status === "approved" ? "success" : c.status === "rejected" ? "danger" : "warning"}>{t(`att.correctionStatus.${c.status}` as MessageKey)}</StatusBadge>
                {c.decisionComment && <span className="text-xs text-stone-500">{c.decisionComment}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
