/**
 * Variação vs período anterior: «+10%» / «−32%». `goodWhenDown` pinta a descida a verde (saídas);
 * sem base de comparação não mostra nada.
 */
export function Delta({ pct, goodWhenDown = false, suffix }: { pct: number | null; goodWhenDown?: boolean; suffix?: string }) {
  if (pct === null) return null;
  const good = goodWhenDown ? pct <= 0 : pct >= 0;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return (
    <span className="whitespace-nowrap text-xs tabular-nums">
      <span className={`font-semibold ${pct === 0 ? "text-ink-secondary" : good ? "text-emerald-700" : "text-rose-600"}`}>
        {sign}
        {Math.abs(pct)}%
      </span>
      {suffix && <span className="text-ink-secondary"> {suffix}</span>}
    </span>
  );
}
