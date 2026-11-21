import type { CashClosing, CashClosingStatus } from "../entities/cash-closing.ts";

/**
 * Diferenças e agrupamento por dia dos fechos de caixa — regras puras.
 *
 * O Vendus só regista o canal próprio (TPA + Eatz + dinheiro); Uber, Glovo e
 * Bolt são faturados no AirMenu. Por isso cada diferença compara só o que é
 * comparável: canal próprio com o Vendus, apps com o AirMenu. Comparar o total
 * declarado (todos os canais) com o Vendus inflacionava a diferença com o valor
 * das apps de entregas.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Canal próprio declarado (TPA + Eatz + dinheiro) − Total Vendus; null sem referência Vendus. */
export function vendusDiff(c: CashClosing): number | null {
  return c.vendusTotal == null ? null : round2(c.vendusCalculated - c.vendusTotal);
}

/** Apps declaradas (Uber + Glovo + Bolt) − Total AirMenu; null sem referência AirMenu. */
export function airMenuDiff(c: CashClosing): number | null {
  return c.airMenuTotal == null ? null : round2(c.airMenuCalculated - c.airMenuTotal);
}

/** Estado "pior" de uma lista de fechos (pendente > rejeitado > aprovado). */
export function worstStatus(closings: CashClosing[]): CashClosingStatus | null {
  if (closings.length === 0) return null;
  if (closings.some((c) => c.status === "pending")) return "pending";
  if (closings.some((c) => c.status === "rejected")) return "rejected";
  return "approved";
}

/** Um dia com um ou mais fechos, somados como se fossem um só. */
export interface ClosingDay {
  date: string;
  /** Fechos do dia, pela ordem de submissão. */
  closings: CashClosing[];
  employeeNames: string[];
  totalCalculated: number;
  /** Soma das referências Vendus das sessões; null se alguma faltar. */
  vendusTotal: number | null;
  vendusDiff: number | null;
  /**
   * Referência AirMenu do dia. O AirMenu é consultado por data, não por sessão:
   * todos os fechos do mesmo dia trazem o total do dia inteiro, por isso conta
   * uma só vez (o valor mais recente disponível).
   */
  airMenuTotal: number | null;
  airMenuDiff: number | null;
  sangriaAmount: number;
  status: CashClosingStatus;
  lastSubmittedAt: string;
}

function summarizeDay(date: string, closings: CashClosing[]): ClosingDay {
  const sorted = [...closings].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const sum = (f: (c: CashClosing) => number) => round2(sorted.reduce((s, c) => s + f(c), 0));

  const vendusTotal = sorted.every((c) => c.vendusTotal != null) ? sum((c) => c.vendusTotal ?? 0) : null;
  const vendusCalculated = sum((c) => c.vendusCalculated);

  const airMenuTotal = [...sorted].reverse().find((c) => c.airMenuTotal != null)?.airMenuTotal ?? null;
  const airMenuCalculated = sum((c) => c.airMenuCalculated);

  return {
    date,
    closings: sorted,
    employeeNames: [...new Set(sorted.map((c) => c.employeeName))],
    totalCalculated: sum((c) => c.totalCalculated),
    vendusTotal,
    vendusDiff: vendusTotal == null ? null : round2(vendusCalculated - vendusTotal),
    airMenuTotal,
    airMenuDiff: airMenuTotal == null ? null : round2(airMenuCalculated - airMenuTotal),
    sangriaAmount: sum((c) => c.sangriaAmount),
    status: worstStatus(sorted) ?? "pending",
    lastSubmittedAt: sorted[sorted.length - 1]!.submittedAt,
  };
}

/** Junta os fechos por data (um dia = uma linha), do dia mais recente para o mais antigo. */
export function groupClosingsByDay(closings: CashClosing[]): ClosingDay[] {
  const byDate = new Map<string, CashClosing[]>();
  for (const c of closings) {
    const list = byDate.get(c.closingDate) ?? [];
    list.push(c);
    byDate.set(c.closingDate, list);
  }
  return [...byDate.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([date, list]) => summarizeDay(date, list));
}

/** Primeiro e último nome («Gabriel Gomes Bernardo de Souza» → «Gabriel Souza»). */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.length <= 2 ? parts.join(" ") : `${parts[0]} ${parts[parts.length - 1]}`;
}

/** Totais do período (rodapé da vista Mês). Dias sem referência não entram na coluna respetiva. */
export interface ClosingDaysTotals {
  days: number;
  closings: number;
  totalCalculated: number;
  vendusTotal: number;
  vendusDiff: number;
  airMenuDiff: number;
  sangriaAmount: number;
}

export function sumClosingDays(days: ClosingDay[]): ClosingDaysTotals {
  const sum = (f: (d: ClosingDay) => number | null) => round2(days.reduce((s, d) => s + (f(d) ?? 0), 0));
  return {
    days: days.length,
    closings: days.reduce((n, d) => n + d.closings.length, 0),
    totalCalculated: sum((d) => d.totalCalculated),
    vendusTotal: sum((d) => d.vendusTotal),
    vendusDiff: sum((d) => d.vendusDiff),
    airMenuDiff: sum((d) => d.airMenuDiff),
    sangriaAmount: sum((d) => d.sangriaAmount),
  };
}
