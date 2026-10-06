import type { AccountingDocumentSource } from "./accounting-document.ts";

export type VatPeriodicity = "monthly" | "quarterly";

export interface VatRateBreakdown {
  rate: number;
  salesVat: number;
  purchasesVatDeductible: number;
  purchasesVatNonDeductible: number;
  balance: number;
}

/**
 * Drill-down por documento (só compras vindas de `AccountingDocument` —
 * não têm uma taxa de IVA única fiável, por isso ficam de fora de `byRate`
 * mas continuam visíveis aqui). Nunca inclui documentos de venda.
 */
export interface VatDocumentBreakdown {
  id: string;
  source: AccountingDocumentSource;
  documentType: string;
  fundingSource: string | null;
  entityName: string;
  date: string;
  vatAmount: number;
  vatDeductibleAmount: number;
  vatNonDeductibleAmount: number;
}

/** "Apuramento de IVA" (acompanhamento — sem fecho formal). Nunca recalcula IVA: só agrega o que `vendus`/`invoices`/`accounting_documents` já calculam. */
export interface VatOverviewResult {
  period: { periodicity: VatPeriodicity; year: number; period: number; from: string; to: string };
  salesVatTotal: number;
  purchasesVatDeductibleTotal: number;
  purchasesVatNonDeductibleTotal: number;
  /** salesVatTotal − purchasesVatDeductibleTotal. Positivo = a pagar ao Estado; negativo = crédito. */
  balance: number;
  byRate: VatRateBreakdown[];
  documents: VatDocumentBreakdown[];
}
