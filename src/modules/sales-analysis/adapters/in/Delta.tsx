import { delta, pct } from "../../domain/services/periods.ts";

/** Variação ▲/▼ % face a um valor anterior (verde a subir, vermelho a descer). */
export function Delta({ cur, prev }: { cur: number; prev: number }) {
  const d = delta(cur, prev);
  const tone = d === null ? "text-ink-muted" : d >= 0 ? "text-emerald-700" : "text-red-700";
  return <span className={`tabular-nums ${tone}`}>{d === null ? "—" : `${d >= 0 ? "▲" : "▼"} ${pct(d).replace("+", "")}`}</span>;
}
