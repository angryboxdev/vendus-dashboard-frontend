/**
 * Faturação certificada AT — contrato com o backend (`/api/invoicing`,
 * `src/modules/invoicing/README.md` do backend). Só tipos: sem React nem fetch.
 */

export type FiscalDocumentType = "FT" | "FS" | "FR" | "NC" | "ND" | "CM";
export type SeriesMode = "normal" | "training";
export type DocumentStatus = "N" | "A" | "F";
export type TaxRegion = "PT" | "PT-AC" | "PT-MA";
export type TaxRateCode = "RED" | "INT" | "NOR";
export type ProductType = "P" | "S" | "O" | "E" | "I";

export const DOCUMENT_TYPE_LABELS: Record<FiscalDocumentType, string> = {
  FT: "Fatura",
  FS: "Fatura simplificada",
  FR: "Fatura-recibo",
  NC: "Nota de crédito",
  ND: "Nota de débito",
  CM: "Consulta de mesa",
};

export const STATUS_LABELS: Record<DocumentStatus, string> = { N: "Emitido", A: "Anulado", F: "Faturado" };

export const PAYMENT_MECHANISM_LABELS: Record<string, string> = {
  NU: "Numerário",
  CC: "Cartão de crédito",
  CD: "Cartão de débito",
  MB: "Referência / MB Way",
  TB: "Transferência bancária",
  OU: "Outro",
};

export interface InvoicingMeta {
  certified: boolean;
  certificateNumber: string;
  signingAvailable: boolean;
  simplifiedInvoiceLimitNet: string;
  documentTypes: FiscalDocumentType[];
  vatRates: Array<{ region: string; code: string; percentage: string }>;
  exemptions: Array<{ code: string; mention: string }>;
  cancelReasons: Array<{ code: string; label: string }>;
}

export interface Series {
  ref: string;
  legalEntityId: string;
  locationId: string | null;
  documentType: FiscalDocumentType;
  seriesId: string;
  mode: SeriesMode;
  validationCode: string | null;
  lastSequence: number;
  lastDocumentDate: string | null;
  status?: "active" | "finalized" | "cancelled";
}

export interface NewSeriesInput {
  legalEntityId: string;
  locationId?: string | null;
  documentType: FiscalDocumentType;
  seriesId: string;
  mode: SeriesMode;
}

export interface DocumentSummary {
  id: string;
  documentType: FiscalDocumentType;
  seriesMode: SeriesMode;
  customerTaxId: string;
  documentNumber: string;
  documentDate: string;
  status: DocumentStatus;
  /** Valor exato em texto, ex.: "28.00" (o backend nunca manda números com vírgula flutuante). */
  grossTotal: string;
}

export interface DocumentLine {
  lineNumber: number;
  productCode: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPct: string | null;
  lineAmount: string;
  taxCode: string;
  taxPercentage: string;
  exemptionCode: string | null;
  exemptionReason: string | null;
}

export interface DocumentTax {
  taxRegion: string;
  taxCode: string;
  taxPercentage: string;
  exemptionCode: string | null;
  exemptionReason: string | null;
  taxableBase: string;
  taxAmount: string;
}

export interface Party {
  taxId: string;
  name: string;
  address: { street: string; postalCode: string; city: string; country: string } | null;
}

/** Documento gravado (2.ª via) com o que se imprime. */
export interface DocumentView extends DocumentSummary {
  sequence: number;
  systemEntryDate: string;
  softwareCertificateNumber: string;
  atcud: string;
  qrPayload: string;
  netTotal: string;
  taxPayable: string;
  paymentMechanism: string | null;
  customer: Party & { country: string };
  issuer: Party;
  referencesTo: Array<{ documentId: string; documentNumber: string; reason?: string }>;
  orderReferences: Array<{ documentId: string; documentNumber: string }>;
  statusReason: string | null;
  lines: DocumentLine[];
  taxes: DocumentTax[];
  printed: { atcud: string; mentions: string[] };
}

export interface IssueLineInput {
  productCode: string;
  productType: ProductType;
  unit: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountPct?: string;
  tax: { region: TaxRegion; rate: TaxRateCode } | { region: TaxRegion; exemptionCode: string };
}

export interface IssueDocumentInput {
  seriesRef: string;
  documentDate?: string;
  customer: { taxId: string; name: string; country: string } | null;
  lines: IssueLineInput[];
  paymentMechanism?: string;
  references?: Array<{ documentId: string; reason: string }>;
  orderReferences?: string[];
  confirmWarnings?: boolean;
}

export interface IssueResult {
  documentId: string;
  documentNumber: string;
  atcud: string;
}

/** Exportação SAF-T (PT): emitente e período (um só ano fiscal). */
export interface SaftQuery {
  legalEntityId: string;
  from: string;
  to: string;
  /** Inclui os documentos de formação. */
  includeTraining: boolean;
}

/** Avisos que o servidor pede para confirmar (data futura, relógio atrasado). */
export const WARNING_LABELS: Record<string, string> = {
  "future-document-date": "A data do documento é futura.",
  "system-clock-behind": "O relógio do sistema está atrás da última emissão.",
};

/** Comunicação à AT (e-Fatura e séries) — `/api/invoicing/at`. */
export type AtOutcome = "accepted" | "rejected" | "auth" | "failed";

/** Subutilizador do Portal das Finanças: `NIF/n.º` (WFA faturas, WSE séries). */
export interface AtCredentialsInput {
  username: string;
  password: string;
}

export interface AtStatus {
  configured: boolean;
  environment: "test" | "production";
  credentials: Array<{ legalEntityId: string; username: string; updatedAt: string }>;
  queue: { pending: number; blocked: number; oldestPendingDate: string | null; deadline: string | null; overdue: boolean; dueSoon: boolean };
  problems: Array<{ documentId: string; documentNumber: string; code: number | null; message: string | null; outcome: "rejected" | "auth" }>;
}

export interface CommunicateResult {
  attempted: number;
  accepted: number;
  rejected: number;
  failed: number;
  withoutCredentials: number;
}

export interface AtCommunication {
  operation: "register" | "change-status";
  documentStatus: DocumentStatus;
  outcome: AtOutcome;
  code: number | null;
  message: string | null;
  createdAt: string;
}

export const AT_OUTCOME_LABELS: Record<AtOutcome, string> = {
  accepted: "Aceite",
  rejected: "Recusado",
  auth: "Credenciais recusadas",
  failed: "Por repetir",
};

/** `NIF/n.º do subutilizador`, como no Portal das Finanças. */
export const AT_USERNAME = /^\d{9}\/\d{1,4}$/;

export const EMPTY_AT_CREDENTIALS: AtCredentialsInput = { username: "", password: "" };
