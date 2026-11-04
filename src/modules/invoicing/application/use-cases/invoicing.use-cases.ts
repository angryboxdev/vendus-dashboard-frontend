import { WARNING_LABELS, type NewSeriesInput, type SaftQuery } from "../../domain/entities/invoicing.ts";
import { FiscalRuleError, IssueNeedsConfirmationError } from "../../domain/errors.ts";
import type { InvoicingPort, IssueOutcome } from "../../domain/ports/in/invoicing.port.ts";
import type { DocumentFilter, FileSaverPort, IdGeneratorPort, InvoicingApiPort } from "../../domain/ports/out/invoicing-api.port.ts";
import { toIssueInput, validateIssueForm, type IssueForm } from "../../domain/services/issue-form.service.ts";

/** Casos de uso da área «Vendas» (faturação certificada, testes). */
export class InvoicingUseCases implements InvoicingPort {
  private readonly api: InvoicingApiPort;
  private readonly ids: IdGeneratorPort;
  private readonly files: FileSaverPort | null;

  constructor(api: InvoicingApiPort, ids: IdGeneratorPort, files: FileSaverPort | null = null) {
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

  async exportSaft(q: SaftQuery): Promise<string[]> {
    const errors: string[] = [];
    if (!q.legalEntityId) errors.push("Escolha o emitente");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(q.from) || !/^\d{4}-\d{2}-\d{2}$/.test(q.to)) errors.push("Indique o período");
    else if (q.from > q.to) errors.push("O início é depois do fim");
    else if (q.from.slice(0, 4) !== q.to.slice(0, 4)) errors.push("O SAF-T cobre um só ano — divida o período");
    if (errors.length > 0) return errors;
    try {
      const file = await this.api.exportSaft(q);
      this.files?.save(`SAFT_${q.from}_${q.to}.xml`, file);
      return [];
    } catch (e) {
      if (e instanceof FiscalRuleError) return [e.message];
      throw e;
    }
  }
}
