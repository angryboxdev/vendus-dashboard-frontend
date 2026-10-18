import type { PayablesSummaryDTO, PayablesSummaryParams } from "../entities/invoice.ts";

/**
 * «Total a pagar | Em atraso» (F2 v1.2 §2.3). O servidor agrega; aqui só se
 * traduzem os filtros da lista e se resumem as notas discretas.
 */

/** Filtros da lista → pedido. O mês filtra pela data da fatura (dia 1 ao último, inclusive), como a lista. */
export function payablesSummaryParams(f: { search: string; month: string | null; supplierId: string }): PayablesSummaryParams {
  const params: PayablesSummaryParams = {};
  if (f.search.trim()) params.search = f.search.trim();
  if (f.supplierId) params.supplierId = f.supplierId;
  if (f.month && /^\d{4}-\d{2}$/.test(f.month)) {
    const [y, m] = f.month.split("-").map(Number) as [number, number];
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    params.from = `${f.month}-01`;
    params.to = `${f.month}-${String(lastDay).padStart(2, "0")}`;
  }
  return params;
}

export function formatMoney(cents: number, currency: string): string {
  return (cents / 100).toLocaleString("pt-PT", { style: "currency", currency });
}

/** O que o total não mostra à primeira vista (tooltip). */
export function summaryNotes(s: PayablesSummaryDTO): string[] {
  const notes: string[] = [];
  if (s.missingDueDate.count > 0) notes.push(`${s.missingDueDate.count} sem vencimento (${formatMoney(s.missingDueDate.cents, s.currency)}) — fora de «Em atraso»`);
  if (s.unappliedCreditCents > 0) notes.push(`Notas de crédito por aplicar: ${formatMoney(s.unappliedCreditCents, s.currency)}`);
  if (s.suspectedDuplicates > 0) notes.push(`${s.suspectedDuplicates} possíveis duplicados`);
  if (s.multiLocationDocuments > 0) notes.push(`${s.multiLocationDocuments} documentos com várias lojas`);
  if (s.otherCurrencies.length > 0) notes.push(`Outras moedas não somadas: ${s.otherCurrencies.join(", ")}`);
  return notes;
}
