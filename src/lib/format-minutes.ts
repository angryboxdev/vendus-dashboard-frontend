/** "3h42" (ou "-15min" para valores abaixo de 60 min) — formato compacto para KPIs/badges de tempo. */
export function formatMinutes(mins: number): string {
  const sign = mins < 0 ? "-" : "";
  const abs = Math.abs(Math.round(mins));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}min`;
  return `${sign}${h}h${m > 0 ? String(m).padStart(2, "0") : ""}`;
}

/** "462h" — arredondado a horas inteiras, sem sinal (KPIs de total acumulado, ex. "Horas realizadas"). */
export function formatMinutesAsWholeHours(mins: number): string {
  return `${Math.round(mins / 60)}h`;
}
