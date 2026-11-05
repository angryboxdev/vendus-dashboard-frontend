import type { AtCommunication, AtCredentialsInput, AtStatus, CommunicateResult, DocumentSummary, DocumentView, InvoicingMeta, IssueResult, NewSeriesInput, SaftQuery, Series } from "../../entities/invoicing.ts";
import type { IssueForm } from "../../services/issue-form.service.ts";
import type { DocumentFilter, IssuerSyncResult, LegalEntityOption } from "../out/invoicing-api.port.ts";

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
  /** «Usar os dados da Empresa»: cria/atualiza o emitente. */
  syncIssuerFromCompany(): Promise<IssuerSyncResult>;
  /** Valida o período e descarrega o SAF-T; devolve erros do formulário (vazio = descarregado). */
  exportSaft(q: SaftQuery): Promise<string[]>;
  atStatus(): Promise<AtStatus>;
  /** Valida o formato e grava; devolve erros do formulário (vazio = gravado). */
  saveAtCredentials(legalEntityId: string, credentials: AtCredentialsInput): Promise<string[]>;
  removeAtCredentials(legalEntityId: string): Promise<void>;
  communicateAt(force: boolean): Promise<CommunicateResult>;
  documentAtCommunications(documentId: string): Promise<AtCommunication[]>;
  /** Operações de séries na AT; devolvem erros do formulário (vazio = feito). */
  registerSeriesAt(seriesRef: string, credentials: AtCredentialsInput): Promise<string[]>;
  finalizeSeriesAt(seriesRef: string, credentials: AtCredentialsInput, justification?: string): Promise<string[]>;
  cancelSeriesAt(seriesRef: string, credentials: AtCredentialsInput): Promise<string[]>;
}
