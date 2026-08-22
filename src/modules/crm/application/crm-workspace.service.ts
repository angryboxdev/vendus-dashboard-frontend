import type { CrmWorkspaceApiPort } from "../domain/ports/out/crm-workspace-api.port.ts";
export class CrmWorkspaceService {
  private readonly api: CrmWorkspaceApiPort;
  constructor(api: CrmWorkspaceApiPort) { this.api = api; }
  listCustomers = (filters: Parameters<CrmWorkspaceApiPort["listCustomers"]>[0]) => this.api.listCustomers(filters);
  listTags = () => this.api.listTags();
  createTag = (input: Parameters<CrmWorkspaceApiPort["createTag"]>[0]) => this.api.createTag(input);
  listActionTypes = () => this.api.listActionTypes();
  createActionType = (input: Parameters<CrmWorkspaceApiPort["createActionType"]>[0]) => this.api.createActionType(input);
  updateActionType = (code: string, input: { name: string }) => this.api.updateActionType(code, input);
  createActions = (input: Parameters<CrmWorkspaceApiPort["createActions"]>[0]) => this.api.createActions(input);
  completeAction = (id: string, completedAt: string) => this.api.completeAction(id, completedAt);
  completeActions = (actions: { id: string; completedAt: string }[]) => this.api.completeActions(actions);
  listCustomerActions = (customerId: string, cursor?: string) => this.api.listCustomerActions(customerId, cursor);
  updateTags = (input: Parameters<CrmWorkspaceApiPort["updateTags"]>[0]) => this.api.updateTags(input);
  setInactive = (input: Parameters<CrmWorkspaceApiPort["setInactive"]>[0]) => this.api.setInactive(input);
}
