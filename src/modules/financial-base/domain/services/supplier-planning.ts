const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export interface PricePoint {
  month: string;
  label: string;
  /** Preço médio do mês; `null` sem compras nesse mês (o gráfico liga os pontos à volta). */
  price: number | null;
}

/** Os últimos `months` meses até ao mês de `today` (inclusive), com o preço médio de cada um. */
export function priceSeries(monthly: { month: string; avgUnitPrice: number }[], months: number, today: Date): PricePoint[] {
  const byMonth = new Map(monthly.map((m) => [m.month, m.avgUnitPrice]));
  const out: PricePoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push({ month, label: MONTH_LABELS[d.getUTCMonth()]!, price: byMonth.get(month) ?? null });
  }
  return out;
}

/** «6,5 dias» / «1 dia»; sem frequência → «—». */
export function frequencyLabel(days: number | null): string {
  if (days === null) return "—";
  const n = days.toLocaleString("pt-PT", { maximumFractionDigits: 1 });
  return `${n} ${days === 1 ? "dia" : "dias"}`;
}
