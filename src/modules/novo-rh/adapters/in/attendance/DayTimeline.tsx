import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { pct, placeSegments, plannedBand, type TimelineSegment } from "../../../domain/services/timeline.service.ts";

const SEG_COLOR: Record<string, string> = { work: "bg-emerald-500", remote: "bg-sky-500", break_paid: "bg-amber-300", break_unpaid: "bg-amber-400" };

/**
 * Linha do dia 0–24 h com as faixas apuradas pelo motor de ponto e, se houver,
 * o previsto a tracejado. Faixa em curso ou fechada automaticamente fica
 * listrada; uma faixa que cruza a meia-noite é cortada com «‹»/«›».
 */
export function DayTimeline({
  segments,
  date,
  timeZone,
  planned,
  label,
  size = "md",
}: {
  segments: TimelineSegment[];
  date: string;
  timeZone: string;
  planned?: { start: string; end: string | null } | null;
  label: string;
  size?: "sm" | "md";
}) {
  const { t } = useI18n();
  const placed = placeSegments(segments, date, timeZone);
  const band = planned?.start ? plannedBand(planned.start, planned.end) : null;
  return (
    <div className={`relative ${size === "sm" ? "h-3" : "h-6"}`} role="img" aria-label={label}>
      <div className="absolute inset-0 overflow-hidden rounded bg-stone-100">
      {band && (
        <div
          className="absolute inset-y-0 rounded border-2 border-dashed border-stone-400"
          style={{ left: pct(band.start), width: `calc(${pct(band.end - band.start)})` }}
          title={`${planned!.start}–${planned!.end ?? "?"}`}
        />
      )}
      {placed.map((s, i) => (
        <div
          key={`${s.start}-${i}`}
          className={`absolute inset-y-0.5 rounded-sm ${SEG_COLOR[s.type] ?? "bg-stone-400"} ${s.open || s.autoClosed ? "bg-[repeating-linear-gradient(45deg,transparent_0_3px,rgba(255,255,255,.55)_3px_6px)]" : ""}`}
          style={{ left: pct(s.left), width: pct(s.width) }}
          title={[t(`att.segment.${s.type}` as MessageKey), s.open ? t("att.timeline.open") : null, s.autoClosed ? t("att.timeline.autoClosed") : null].filter(Boolean).join(" · ")}
          data-segment={s.type}
        />
      ))}
      </div>
      {placed.some((s) => s.fromPreviousDay) && <span className="absolute -left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-stone-500" aria-hidden="true">‹</span>}
      {placed.some((s) => s.toNextDay) && <span className="absolute -right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-stone-500" aria-hidden="true">›</span>}
    </div>
  );
}

/** Legenda das cores (uma vez por tabela). */
export function TimelineLegend({ withPlanned = false }: { withPlanned?: boolean }) {
  const { t } = useI18n();
  const item = (cls: string, key: MessageKey) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-4 rounded-sm ${cls}`} aria-hidden="true" />
      {t(key)}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
      {item(SEG_COLOR.work!, "att.segment.work")}
      {item(SEG_COLOR.remote!, "att.segment.remote")}
      {item(SEG_COLOR.break_unpaid!, "att.team.legend.break")}
      {item("bg-emerald-500 bg-[repeating-linear-gradient(45deg,transparent_0_3px,rgba(255,255,255,.55)_3px_6px)]", "att.timeline.openOrAuto")}
      {withPlanned && item("border-2 border-dashed border-stone-400 bg-transparent", "att.team.legend.planned")}
    </div>
  );
}
