import type { DocumentSummary, DocumentView, InvoicingMeta, IssueResult, NewSeriesInput, Series } from "../../entities/invoicing.ts";
import type { IssueForm } from "../../services/issue-form.service.ts";
import type { DocumentFilter, LegalEntityOption } from "../out/invoicing-api.port.ts";

/** Resultado de emitir: emitido, erros do formulário, ou avisos a confirmar (data futura, relógio). */
export type IssueOutcome =
  | { kind: "issued"; result: IssueResult }
  | { kind: "invalid"; errors: string[] }
  | { kind: "needs-confirmation"; warnings: string[] };

export interface InvoicingPort {
  meta(): Promise<InvoicingMeta>;
  listSeries(): Promise<Series[]>;
  createSeries(input: NewSeriesInput): Promise<Series>;
  setValidationCode(seriesRef: string, validationCode: string): Promise<Series>;
  listDocuments(filter: DocumentFilter): Promise<DocumentSummary[]>;
  getDocument(id: string): Promise<DocumentView>;
  /**
   * Emite a partir do formulário. `attemptKey` identifica o pedido: reenviar o mesmo
   * pedido (falha de rede) com a mesma chave nunca cria um segundo documento. Um pedido
   * diferente (formulário alterado, avisos confirmados) leva chave nova (`newAttemptKey`).
   */
  issue(form: IssueForm, opts: { attemptKey: string; confirmWarnings?: boolean }): Promise<IssueOutcome>;
  newAttemptKey(): string;
  cancel(id: string, reasonCode: string, note?: string): Promise<DocumentView>;
  legalEntities(): Promise<LegalEntityOption[]>;
}
