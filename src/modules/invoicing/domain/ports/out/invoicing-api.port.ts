import type {
  DocumentStatus,
  DocumentSummary,
  DocumentView,
  FiscalDocumentType,
  InvoicingMeta,
  IssueDocumentInput,
  IssueResult,
  NewSeriesInput,
  Series,
} from "../../entities/invoicing.ts";

export interface DocumentFilter {
  from?: string;
  to?: string;
  type?: FiscalDocumentType;
  status?: DocumentStatus;
}

/** API da faturação certificada (`/api/invoicing`). */
export interface InvoicingApiPort {
  meta(): Promise<InvoicingMeta>;
  listSeries(): Promise<Series[]>;
  createSeries(input: NewSeriesInput, idempotencyKey: string): Promise<Series>;
  setValidationCode(seriesRef: string, validationCode: string, idempotencyKey: string): Promise<Series>;
  listDocuments(filter: DocumentFilter): Promise<DocumentSummary[]>;
  getDocument(id: string): Promise<DocumentView>;
  /** A mesma chave num reenvio devolve a mesma resposta — nunca um segundo documento. */
  issue(input: IssueDocumentInput, idempotencyKey: string): Promise<IssueResult>;
  cancel(id: string, reasonCode: string, note: string | undefined, idempotencyKey: string): Promise<DocumentView>;
  /** Entidades legais ativas (emitentes) — `/api/novo-rh/legal-entities`. */
  legalEntities(): Promise<LegalEntityOption[]>;
}

export interface LegalEntityOption {
  id: string;
  name: string;
  taxId: string;
}

/** Gera chaves de idempotência (o domínio não conhece `crypto`). */
export interface IdGeneratorPort {
  next(): string;
}
