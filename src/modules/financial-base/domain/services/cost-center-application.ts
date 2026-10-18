/**
 * «Aplicação em Faturas» (Centros de Custo): despesa por subcategoria a
 * partir das duas fontes de classificação (F2 v1.2 §2.2):
 * - linhas de faturas «Por artigo» (o servidor só devolve essas no feed);
 * - repartições de faturas «Por valores».
 * Tudo em montantes líquidos sem IVA (já com descontos), para as duas fontes
 * serem somáveis. Notas de crédito entram a subtrair.
 */

export interface ApplicationLine {
  invoiceId: string;
  costCenterCategoryId: string | null;
  totalWithVat: number;
  vatAmount: number;
}

export interface ApplicationAllocation {
  invoiceId: string;
  costCenterCategoryId: string;
  netCents: number;
}

export interface ApplicationInvoice {
  id: string;
  supplierName: string | null;
  documentType?: "invoice" | "credit_note";
}

export type ApplicationSource = "lines" | "allocations";

export interface CategoryApplication {
  categoryId: string;
  totalWithoutVat: number;
  invoiceIds: Set<string>;
  supplierNames: Set<string>;
  /** invoiceId → { líquido nesta subcategoria, origem }. */
  byInvoice: Map<string, { cents: number; source: ApplicationSource }>;
}

export function aggregateByCategory(
  lines: ApplicationLine[],
  allocations: ApplicationAllocation[],
  invoices: ApplicationInvoice[],
): CategoryApplication[] {
  const invoiceMap = new Map(invoices.map((i) => [i.id, i]));
  const byCat = new Map<string, CategoryApplication>();

  function add(invoiceId: string, categoryId: string, cents: number, source: ApplicationSource) {
    const inv = invoiceMap.get(invoiceId);
    if (!inv) return;
    const row = byCat.get(categoryId) ?? { categoryId, totalWithoutVat: 0, invoiceIds: new Set<string>(), supplierNames: new Set<string>(), byInvoice: new Map() };
    row.totalWithoutVat += cents;
    row.invoiceIds.add(invoiceId);
    if (inv.supplierName) row.supplierNames.add(inv.supplierName);
    const prev = row.byInvoice.get(invoiceId);
    row.byInvoice.set(invoiceId, { cents: (prev?.cents ?? 0) + cents, source });
    byCat.set(categoryId, row);
  }

  // Linhas: líquido = total c/ IVA − IVA (já com descontos; o sinal da nota de crédito vem gravado).
  for (const l of lines) {
    if (l.costCenterCategoryId) add(l.invoiceId, l.costCenterCategoryId, l.totalWithVat - l.vatAmount, "lines");
  }
  // Repartições: montante líquido sempre positivo; a nota de crédito subtrai.
  for (const a of allocations) {
    const sign = invoiceMap.get(a.invoiceId)?.documentType === "credit_note" ? -1 : 1;
    add(a.invoiceId, a.costCenterCategoryId, sign * a.netCents, "allocations");
  }
  return [...byCat.values()];
}
