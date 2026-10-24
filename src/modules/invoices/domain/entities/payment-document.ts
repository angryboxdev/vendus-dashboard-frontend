/**
 * Documento de cobrança do Estado (AT retenções na fonte, SS referência MB),
 * devolvido por `POST /invoices/import` quando o PDF não é uma fatura.
 * Espelha o contrato do backend (`PaymentDocumentImportDTO`). Não é compra
 * nem fatura: IVA não aplicável, sem linhas nem Stock; a leitura não cria
 * dívida nem prova pagamento.
 */

export type BarcodeState =
  | { status: "absent" }
  | { status: "decoded"; symbology: "CODE128"; payload: string; page: number }
  | { status: "unreadable"; page: number };

export interface PaymentObligationLine {
  code: string;
  description: string;
  amountCents: number;
  interestCents: number;
  totalCents: number;
}

export interface PaymentReadingIssue {
  code: "field_missing" | "totals_mismatch" | "reference_format" | "barcode_text_mismatch" | "barcode_unreadable" | "due_date_passed" | "taxpayer_not_organization";
  blocking: boolean;
  detail: string;
}

export interface PaymentDocumentReading {
  kind: "at_withholding" | "ss_payment_reference";
  obligationType: "obrigacao_fiscal" | "obrigacao_contributiva";
  subtype: "retencoes_irs_prediais" | "retencoes_na_fonte" | "seguranca_social_entidade_empregadora";
  issuer: "AT" | "SS";
  taxpayerNif: string | null;
  documentNumber: string | null;
  period: string | null;
  lines: PaymentObligationLine[];
  paymentReference: string | null;
  mbEntity: string | null;
  amountCents: number | null;
  interestCents: number;
  totalCents: number | null;
  dueDate: string | null;
  issueDate: string | null;
  declarationReceivedAt: string | null;
  vat: "not_applicable";
  barcode: BarcodeState;
  barcodePrintedText: string | null;
  fieldSources: Partial<Record<"documentNumber" | "taxpayerNif" | "period" | "paymentReference" | "mbEntity" | "totalCents" | "dueDate", "text" | "barcode">>;
  issues: PaymentReadingIssue[];
  status: "ready" | "needs_attention";
}

export interface ExistingObligation {
  source: "invoice" | "payable";
  id: string;
  invoiceId: string | null;
  label: string;
  supplierName: string;
  amountCents: number;
  dueDate: string | null;
  documentDate: string | null;
  status: string;
}

export interface ObligationMatch {
  existing: ExistingObligation;
  reasons: ("same_reference" | "same_document_number" | "similar_number" | "same_amount_and_due_date" | "same_amount_in_period")[];
  strength: "strong" | "possible";
}

export interface PaymentDocumentImportDTO {
  kind: "payment_document";
  payment: PaymentDocumentReading;
  matches: ObligationMatch[];
  supplierSuggestion: { id: string; name: string; defaultCostCenterGroupId: string | null; defaultCostCenterCategoryId: string | null } | null;
  metrics: { totalMs: number; barcodeMs: number; aiCalls: 0 };
}

export function isPaymentDocument(result: unknown): result is PaymentDocumentImportDTO {
  return typeof result === "object" && result !== null && (result as { kind?: unknown }).kind === "payment_document";
}

export const MATCH_REASON_LABELS: Record<ObligationMatch["reasons"][number], string> = {
  same_reference: "mesma referência de pagamento",
  same_document_number: "mesmo número de documento",
  similar_number: "número quase igual (dígitos trocados)",
  same_amount_and_due_date: "mesmo valor e prazo",
  same_amount_in_period: "mesmo valor no período",
};

export const PAYMENT_DOCUMENT_TITLES: Record<PaymentDocumentReading["subtype"], string> = {
  retencoes_irs_prediais: "Finanças — Retenções na fonte (IRS prediais)",
  retencoes_na_fonte: "Finanças — Retenções na fonte",
  seguranca_social_entidade_empregadora: "Segurança Social — Contribuições da entidade empregadora",
};
