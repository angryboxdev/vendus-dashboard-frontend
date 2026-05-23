import type { ContactsParams, CustomersParams } from "./crmApi";

export const crmQueryKeys = {
  root: ["crm"] as const,
  dashboard: () => [...crmQueryKeys.root, "dashboard"] as const,
  customers: (p: CustomersParams = {}) =>
    [...crmQueryKeys.root, "customers", p] as const,
  customer: (id: string) => [...crmQueryKeys.root, "customer", id] as const,
  orders: (customerId: string) =>
    [...crmQueryKeys.root, "orders", customerId] as const,
  contacts: (p: ContactsParams = {}) =>
    [...crmQueryKeys.root, "contacts", p] as const,
  scripts: (includeInactive = false) =>
    [...crmQueryKeys.root, "scripts", includeInactive] as const,
  script: (code: string) => [...crmQueryKeys.root, "script", code] as const,
  parameters: () => [...crmQueryKeys.root, "parameters"] as const,
};
