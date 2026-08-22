import type { CrmActionHistoryPage, CrmActionType, CrmScriptOption, CrmTableFilters, CrmTag, CustomerTableResult } from "../../entities/crm-workspace.ts";

export interface CrmWorkspaceApiPort {
  listCustomers(filters: CrmTableFilters): Promise<CustomerTableResult>;
  listTags(): Promise<CrmTag[]>;
  createTag(input: { label: string; color: string }): Promise<CrmTag>;
  listActionTypes(): Promise<CrmActionType[]>;
  listScripts(): Promise<CrmScriptOption[]>;
  createActionType(input: { name: string; color: string }): Promise<CrmActionType>;
  updateActionType(code: string, input: { name: string }): Promise<CrmActionType>;
  createActions(input: { customerIds: string[]; actionTypeCode: string; scheduledFor: string; notes: string | null; scriptCode: string | null }): Promise<void>;
  completeAction(id: string, completedAt: string): Promise<void>;
  completeActions(actions: { id: string; completedAt: string }[]): Promise<void>;
  listCustomerActions(customerId: string, cursor?: string): Promise<CrmActionHistoryPage>;
  updateTags(input: { customerIds: string[]; add: string[]; remove: string[] }): Promise<void>;
  setInactive(input: { customerIds: string[]; inactive: boolean }): Promise<void>;
}
