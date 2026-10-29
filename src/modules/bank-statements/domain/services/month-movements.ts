import type { BankMovementDTO, DaySlotDTO } from "../entities/bank-statement.ts";
import { matchesMovementFilter, type MovementFilter } from "./movement-kind.ts";

export type MonthTab = "movements" | "suggestions" | "reconciled";
export type MonthChip = MovementFilter | "pending" | "with_suggestion";
export type MonthSort = "priority" | "date";

/** Estado simplificado de uma linha do mês (mockup V2): conciliado, parcial, só classificado (aguarda fatura) ou por conciliar. */
export type RowStatus = "reconciled" | "partial" | "classified" | "pending";

export function rowStatus(m: Pick<BankMovementDTO, "isResolved" | "reconciliationStatus">): RowStatus {
  if (m.reconciliationStatus === "conciliado_parcial") return "partial";
  if (m.reconciliationStatus === "pendente_de_documento") return "classified";
  return m.isResolved ? "reconciled" : "pending";
}

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Movimentos visíveis no mês, por dia: separador (Conciliados só os resolvidos), filtro (por conciliar,
 * entradas, saídas, transferências, com sugestão), pesquisa (descrição original ou normalizada, ou valor
 * «42,74») e ordem dentro do dia («Mais prioritários» = por conciliar primeiro, maior valor primeiro).
 */
export function visibleMonthDays(
  days: DaySlotDTO[],
  opts: { tab: MonthTab; chip: MonthChip; search: string; sort: MonthSort; suggestedIds: ReadonlySet<string> },
): DaySlotDTO[] {
  const q = normalize(opts.search.trim());
  const keep = (m: BankMovementDTO) => {
    if (opts.tab === "reconciled" && !m.isResolved) return false;
    if (opts.chip === "pending" && m.isResolved) return false;
    if (opts.chip === "with_suggestion" && !opts.suggestedIds.has(m.id)) return false;
    if (opts.chip !== "pending" && opts.chip !== "with_suggestion" && !matchesMovementFilter(m, opts.chip)) return false;
    if (q) {
      const amount = (m.amount / 100).toFixed(2);
      const hay = normalize(`${m.description} ${m.normalizedDescription ?? ""} ${amount} ${amount.replace(".", ",")}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  };
  const order = (a: BankMovementDTO, b: BankMovementDTO) =>
    opts.sort === "date" ? 0 : Number(a.isResolved) - Number(b.isResolved) || b.amount - a.amount;
  return days
    .map((d) => ({ ...d, movements: d.movements.filter(keep).sort(order) }))
    .filter((d) => d.movements.length > 0);
}
