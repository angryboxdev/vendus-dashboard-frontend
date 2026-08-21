import {
  apiGet,
  apiPost,
  apiPatchNoContent,
  apiDeleteNoContent,
  apiPostFormData,
} from "../../../../lib/api.ts";
import type { BankStatementsApiPort, GetStatementParams, ListStatementsParams, StatementPreview } from "../../domain/ports/out/bank-statements-api.port.ts";
import type {
  AccountMonthStatDTO,
  ApplyRulesResult,
  BankStatementDetailDTO,
  BankStatementSummaryDTO,
  ClassifyMovementPayload,
  CreateRulePayload,
  DaySlotDTO,
  ImportStatementResult,
  InvoiceLinkedMovementDTO,
  MatchSuggestionDTO,
  MovementCandidateDTO,
  OccurrenceCandidateDTO,
  ReconciliationRuleDTO,
} from "../../domain/entities/bank-statement.ts";

const BASE = "/api/bank-statements";

export class HttpBankStatementsApiAdapter implements BankStatementsApiPort {
  async previewStatement(file: File): Promise<StatementPreview> {
    const fd = new FormData();
    fd.append("file", file);
    return apiPostFormData(`${BASE}/preview`, fd);
  }

  async importStatement(formData: FormData): Promise<ImportStatementResult> {
    return apiPostFormData(`${BASE}`, formData);
  }

  async listStatements(params?: ListStatementsParams): Promise<BankStatementSummaryDTO[]> {
    const q = new URLSearchParams();
    if (params?.accountNumber) q.set("accountNumber", params.accountNumber);
    if (params?.status) q.set("status", params.status);
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    const qs = q.toString();
    return apiGet(`${BASE}${qs ? `?${qs}` : ""}`);
  }

  async getStatement(id: string, params?: GetStatementParams): Promise<BankStatementDetailDTO> {
    const q = new URLSearchParams();
    if (params?.reconciliationStatus) q.set("reconciliationStatus", params.reconciliationStatus);
    if (params?.movementType) q.set("movementType", params.movementType);
    if (params?.riskLevel) q.set("riskLevel", params.riskLevel);
    const qs = q.toString();
    return apiGet(`${BASE}/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`);
  }

  async applyAutoRules(statementId: string): Promise<ApplyRulesResult> {
    return apiPost(`${BASE}/${encodeURIComponent(statementId)}/apply-rules`, {});
  }

  async suggestMatches(statementId: string): Promise<MatchSuggestionDTO[]> {
    return apiPost(`${BASE}/${encodeURIComponent(statementId)}/suggest`, {});
  }

  async closeStatement(statementId: string): Promise<void> {
    await apiPost(`${BASE}/${encodeURIComponent(statementId)}/close`, {});
  }

  async reconcileMovement(
    movementId: string,
    entityLinks: Array<{
      entityType: "invoice" | "payable_entry";
      entityId: string;
      allocatedAmountCents: number;
      supplierId?: string | null;
    }>
  ): Promise<void> {
    await apiPatchNoContent(`${BASE}/movements/${encodeURIComponent(movementId)}/reconcile`, {
      entityLinks,
    });
  }

  async classifyMovement(movementId: string, payload: ClassifyMovementPayload): Promise<void> {
    await apiPatchNoContent(`${BASE}/movements/${encodeURIComponent(movementId)}/classify`, payload);
  }

  async listRules(): Promise<ReconciliationRuleDTO[]> {
    return apiGet(`${BASE}/rules`);
  }

  async createRule(payload: CreateRulePayload): Promise<ReconciliationRuleDTO> {
    return apiPost(`${BASE}/rules`, payload);
  }

  async deleteStatement(id: string): Promise<void> {
    await apiDeleteNoContent(`${BASE}/${encodeURIComponent(id)}`);
  }

  async updateStatementBalances(id: string, openingBalance: number, closingBalance: number): Promise<void> {
    await apiPatchNoContent(`${BASE}/${encodeURIComponent(id)}/balances`, { openingBalance, closingBalance });
  }

  async uploadMovementDocument(movementId: string, file: File): Promise<{ documentUrl: string }> {
    const fd = new FormData();
    fd.append("file", file);
    return apiPostFormData(`${BASE}/movements/${encodeURIComponent(movementId)}/document`, fd);
  }

  async findMovementCandidates(movementId: string): Promise<MovementCandidateDTO[]> {
    return apiGet<MovementCandidateDTO[]>(`${BASE}/movements/${encodeURIComponent(movementId)}/candidates`);
  }

  async deleteRule(id: string): Promise<void> {
    await apiDeleteNoContent(`${BASE}/rules/${encodeURIComponent(id)}`);
  }

  async getAccountCalendar(accountId: string, year: number): Promise<AccountMonthStatDTO[]> {
    return apiGet(`${BASE}/accounts/${encodeURIComponent(accountId)}/calendar?year=${year}`);
  }

  async getAccountMonthDetail(accountId: string, year: number, month: number): Promise<DaySlotDTO[]> {
    return apiGet(`${BASE}/accounts/${encodeURIComponent(accountId)}/calendar/${year}/${month}`);
  }

  async getMovementsLinkedToInvoice(invoiceId: string): Promise<InvoiceLinkedMovementDTO[]> {
    return apiGet<InvoiceLinkedMovementDTO[]>(`${BASE}/invoices/${encodeURIComponent(invoiceId)}/movements`);
  }

  async getInvoiceOpenBalances(invoiceIds: string[]): Promise<Record<string, number>> {
    if (invoiceIds.length === 0) return {};
    return apiGet<Record<string, number>>(`${BASE}/invoices/open-balances?ids=${invoiceIds.map(encodeURIComponent).join(",")}`);
  }

  async unreconcileMovement(movementId: string): Promise<void> {
    await apiDeleteNoContent(`${BASE}/movements/${encodeURIComponent(movementId)}/reconcile`);
  }

  async searchOccurrenceCandidates(params: { q?: string; dateFrom?: string; dateTo?: string; limit?: number }): Promise<OccurrenceCandidateDTO[]> {
    const q = new URLSearchParams();
    if (params.q) q.set("q", params.q);
    if (params.dateFrom) q.set("dateFrom", params.dateFrom);
    if (params.dateTo) q.set("dateTo", params.dateTo);
    if (params.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return apiGet<OccurrenceCandidateDTO[]>(`${BASE}/occurrences/candidates${qs ? `?${qs}` : ""}`);
  }
}
