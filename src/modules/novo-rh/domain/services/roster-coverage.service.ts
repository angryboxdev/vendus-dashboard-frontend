import type { CoverageReport, CoverageWindow } from "../entities/rosters.ts";

/** Intervalo de cobertura legível: «13:00–17:00», «22:00–02:00 (+1)», «01:00–06:00 (dia seguinte)». */
export function windowLabel(w: Pick<CoverageWindow, "start" | "end" | "startsNextDay" | "endsNextDay">): string {
  const base = `${w.start}–${w.end}`;
  if (w.startsNextDay) return `${base} (dia seguinte)`;
  return w.endsNextDay ? `${base} (+1)` : base;
}

export interface CoverageDeficit {
  date: string;
  areaId: string | null;
  window: CoverageWindow;
  /** Pessoas em falta no planeado. */
  missing: number;
}

/** Intervalos em défice (planeado abaixo do mínimo), por dia e com o centro inteiro antes das áreas. */
export function coverageDeficits(report: CoverageReport | undefined | null): CoverageDeficit[] {
  if (!report?.enabled) return [];
  return report.days
    .flatMap((d) => d.windows.filter((w) => w.planned < w.required).map((w) => ({ date: d.date, areaId: d.areaId, window: w, missing: w.required - w.planned })))
    .sort((a, b) => a.date.localeCompare(b.date) || Number(a.areaId !== null) - Number(b.areaId !== null) || a.window.start.localeCompare(b.window.start));
}

/** Há regras para alguma combinação dia/âmbito do período (senão, «Não configurado»). */
export const coverageConfigured = (report: CoverageReport | undefined | null) => !!report?.days.some((d) => d.status !== "not_configured");

const WD = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
/** «seg 02/11». */
export function shortDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  return `${WD[(d.getUTCDay() + 6) % 7]} ${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
}
