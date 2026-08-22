import { apiGet, apiPatch, apiPatchNoContent, apiPost } from "../../../../lib/api.ts";
import type { CrmActionHistoryPage, CrmActionType, CrmScriptOption, CrmTableFilters, CrmTag, CustomerTableResult } from "../../domain/entities/crm-workspace.ts";
import type { CrmWorkspaceApiPort } from "../../domain/ports/out/crm-workspace-api.port.ts";

const BASE = "/api/crm";
export class HttpCrmWorkspaceApiAdapter implements CrmWorkspaceApiPort {
  listCustomers(filters: CrmTableFilters): Promise<CustomerTableResult> {
    const query = new URLSearchParams({ page: String(filters.page ?? 1), pageSize: String(filters.pageSize ?? 10) });
    Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== "" && (!Array.isArray(value) || value.length)) query.set(key, Array.isArray(value) ? value.join(",") : String(value)); });
    return apiGet(`${BASE}/customer-table?${query}`);
  }
  listTags = () => apiGet<CrmTag[]>(`${BASE}/tags`);
  createTag = (input: { label: string; color: string }) => apiPost<CrmTag>(`${BASE}/tags`, input);
  listActionTypes = () => apiGet<CrmActionType[]>(`${BASE}/action-types`);
  listScripts = () => apiGet<CrmScriptOption[]>(`${BASE}/scripts?includeInactive=true`);
  createActionType = (input: { name: string; color: string }) => apiPost<CrmActionType>(`${BASE}/action-types`, input);
  updateActionType = (code: string, input: { name: string }) => apiPatch<CrmActionType>(`${BASE}/action-types/${encodeURIComponent(code)}`, input);
  async createActions(input: { customerIds: string[]; actionTypeCode: string; scheduledFor: string; notes: string | null; scriptCode: string | null }) { await apiPost(`${BASE}/actions`, input); }
  async completeAction(id: string, completedAt: string) { await apiPatch(`${BASE}/actions/${encodeURIComponent(id)}/complete`, { completedAt }); }
  async completeActions(actions: { id: string; completedAt: string }[]) { await apiPatch(`${BASE}/actions/complete-bulk`, { actions }); }
  listCustomerActions(customerId: string, cursor?: string) {
    const query = new URLSearchParams({ limit: "20" }); if (cursor) query.set("cursor", cursor);
    return apiGet<CrmActionHistoryPage>(`${BASE}/customers/${encodeURIComponent(customerId)}/actions?${query}`);
  }
  updateTags = (input: { customerIds: string[]; add: string[]; remove: string[] }) => apiPatchNoContent(`${BASE}/customers/tags`, input);
  setInactive = (input: { customerIds: string[]; inactive: boolean }) => apiPatchNoContent(`${BASE}/customers/inactive`, input);
}
