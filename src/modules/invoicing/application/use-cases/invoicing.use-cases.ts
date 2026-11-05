import { AT_USERNAME, WARNING_LABELS, type AtCredentialsInput, type NewSeriesInput, type SaftQuery } from "../../domain/entities/invoicing.ts";
import { FiscalRuleError, IssueNeedsConfirmationError } from "../../domain/errors.ts";
import type { InvoicingPort, IssueOutcome } from "../../domain/ports/in/invoicing.port.ts";
import type { DocumentFilter, FileSaverPort, IdGeneratorPort, InvoicingApiPort } from "../../domain/ports/out/invoicing-api.port.ts";
import { toIssueInput, validateIssueForm, type IssueForm } from "../../domain/services/issue-form.service.ts";

/** Casos de uso da área «Vendas» (faturação certificada, testes). */
export class InvoicingUseCases implements InvoicingPort {
  private readonly api: InvoicingApiPort;
  private readonly ids: IdGeneratorPort;
  private readonly files: FileSaverPort;

  constructor(api: InvoicingApiPort, ids: IdGeneratorPort, files: FileSaverPort) {
    this.api = api;
    this.ids = ids;
    this.files = files;
  }

  meta() {
    return this.api.meta();
  }

  listSeries() {
    return this.api.listSeries();
  }

  createSeries(input: NewSeriesInput) {
    return this.api.createSeries(input, this.ids.next());
  }

  setValidationCode(seriesRef: string, validationCode: string) {
    return this.api.setValidationCode(seriesRef, validationCode, this.ids.next());
  }

  listDocuments(filter: DocumentFilter) {
    return this.api.listDocuments(filter);
  }

  getDocument(id: string) {
    return this.api.getDocument(id);
  }

  newAttemptKey() {
    return this.ids.next();
  }

  async issue(form: IssueForm, opts: { attemptKey: string; confirmWarnings?: boolean }): Promise<IssueOutcome> {
    const errors = validateIssueForm(form);
    if (errors.length > 0) return { kind: "invalid", errors };
    try {
      const result = await this.api.issue({ ...toIssueInput(form), ...(opts.confirmWarnings ? { confirmWarnings: true } : {}) }, opts.attemptKey);
      return { kind: "issued", result };
    } catch (e) {
      if (e instanceof IssueNeedsConfirmationError) return { kind: "needs-confirmation", warnings: e.warnings.map((w) => WARNING_LABELS[w] ?? w) };
      if (e instanceof FiscalRuleError) return { kind: "invalid", errors: [e.message] };
      throw e;
    }
  }

  cancel(id: string, reasonCode: string, note?: string) {
    return this.api.cancel(id, reasonCode, note, this.ids.next());
  }

  legalEntities() {
    return this.api.legalEntities();
  }

  syncIssuerFromCompany() {
    return this.api.syncIssuerFromCompany();
  }

  async exportSaft(q: SaftQuery): Promise<string[]> {
    const errors: string[] = [];
    if (!q.legalEntityId) errors.push("Escolha o emitente");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(q.from) || !/^\d{4}-\d{2}-\d{2}$/.test(q.to)) errors.push("Indique o período");
    else if (q.from > q.to) errors.push("O início é depois do fim");
    else if (q.from.slice(0, 4) !== q.to.slice(0, 4)) errors.push("O SAF-T cobre um só ano — divida o período");
    if (errors.length > 0) return errors;
    try {
      const file = await this.api.exportSaft(q);
      this.files.save(`SAFT_${q.from}_${q.to}.xml`, file);
      return [];
    } catch (e) {
      if (e instanceof FiscalRuleError) return [e.message];
      throw e;
    }
  }

  atStatus() {
    return this.api.atStatus();
  }

  saveAtCredentials(legalEntityId: string, credentials: AtCredentialsInput): Promise<string[]> {
    if (!legalEntityId) return Promise.resolve(["Escolha o emitente"]);
    return this.atWrite(credentials, () => this.api.saveAtCredentials(legalEntityId, { ...credentials, username: credentials.username.trim() }));
  }

  removeAtCredentials(legalEntityId: string) {
    return this.api.removeAtCredentials(legalEntityId);
  }

  communicateAt(force: boolean) {
    return this.api.communicateAt(force);
  }

  documentAtCommunications(documentId: string) {
    return this.api.documentAtCommunications(documentId);
  }

  registerSeriesAt(seriesRef: string, credentials: AtCredentialsInput) {
    return this.atWrite(credentials, () => this.api.registerSeriesAt(seriesRef, { ...credentials, username: credentials.username.trim() }));
  }

  finalizeSeriesAt(seriesRef: string, credentials: AtCredentialsInput, justification?: string) {
    return this.atWrite(credentials, () => this.api.finalizeSeriesAt(seriesRef, { ...credentials, username: credentials.username.trim() }, justification?.trim() || undefined));
  }

  cancelSeriesAt(seriesRef: string, credentials: AtCredentialsInput) {
    return this.atWrite(credentials, () => this.api.cancelSeriesAt(seriesRef, { ...credentials, username: credentials.username.trim() }));
  }

  /** Credenciais do Portal das Finanças: formato NIF/n.º e senha; regras da AT recusadas voltam como erros do formulário. */
  private async atWrite(c: AtCredentialsInput, call: () => Promise<unknown>): Promise<string[]> {
    const errors: string[] = [];
    if (!AT_USERNAME.test(c.username.trim())) errors.push("Utilizador no formato NIF/n.º do subutilizador (ex.: 599999999/1)");
    if (!c.password) errors.push("Indique a senha do subutilizador");
    if (errors.length > 0) return errors;
    try {
      await call();
      return [];
    } catch (e) {
      if (e instanceof FiscalRuleError) return [e.message];
      throw e;
    }
  }
}
