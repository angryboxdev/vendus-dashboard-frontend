import {
  apiGet,
  apiPost,
  apiPatch,
  apiPatchNoContent,
  apiDeleteNoContent,
  apiPostFormData,
} from "../../../../lib/api.ts";
import type { BankStatementsApiPort, GetStatementParams, ListStatementsParams, StatementPreview } from "../../domain/ports/out/bank-statements-api.port.ts";
import type {
  ApplyRulesResult,
  BankStatementDetailDTO,
  BankStatementSummaryDTO,
  ClassifyMovementPayload,
  CreateRulePayload,
  ImportStatementResult,
  MatchSuggestionDTO,
  MovementCandidateDTO,
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
    entityType: "invoice" | "payable_entry",
    entityId: string
  ): Promise<void> {
    await apiPatch(`${BASE}/movements/${encodeURIComponent(movementId)}/reconcile`, {
      entityType,
      entityId,
    });
  }

  async classifyMovement(movementId: string, payload: ClassifyMovementPayload): Promise<void> {
    await apiPatch(`${BASE}/movements/${encodeURIComponent(movementId)}/classify`, payload);
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
}
