import { apiGet, apiPatch, apiPost } from "../../lib/api";
import type {
  CrmContact,
  CrmCustomer,
  CrmCustomerEnriched,
  CrmDashboardData,
  CrmOrder,
  CrmParameter,
  CrmScript,
} from "./crm.types";

const CRM = "/api/crm";

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function fetchCrmDashboard(): Promise<CrmDashboardData> {
  return apiGet(`${CRM}/dashboard`);
}

// ─── Customers ────────────────────────────────────────────────────────────────

export type CustomersParams = {
  segment?: string;
  tag?: string;
  optIn?: string;
  channel?: string;
  search?: string;
  inactive?: boolean;
  enriched?: boolean;
  limit?: number;
  offset?: number;
};

function buildCustomersQuery(p: CustomersParams): string {
  const q = new URLSearchParams();
  if (p.segment) q.set("segment", p.segment);
  if (p.tag) q.set("tag", p.tag);
  if (p.optIn) q.set("optIn", p.optIn);
  if (p.channel) q.set("channel", p.channel);
  if (p.search) q.set("search", p.search);
  if (p.inactive !== undefined) q.set("inactive", String(p.inactive));
  if (p.enriched) q.set("enriched", "true");
  if (p.limit != null) q.set("limit", String(p.limit));
  if (p.offset != null) q.set("offset", String(p.offset));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function fetchCustomers(
  params: CustomersParams = {},
): Promise<CrmCustomer[]> {
  return apiGet(`${CRM}/customers${buildCustomersQuery(params)}`);
}

export async function fetchCustomersEnriched(
  params: Omit<CustomersParams, "enriched"> = {},
): Promise<CrmCustomerEnriched[]> {
  return apiGet(
    `${CRM}/customers${buildCustomersQuery({ ...params, enriched: true })}`,
  );
}

export async function fetchCustomerEnriched(
  id: string,
): Promise<CrmCustomerEnriched> {
  return apiGet(`${CRM}/customers/${encodeURIComponent(id)}`);
}

export type CreateCustomerBody = {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  preferredChannel?: string;
  birthday?: string | null;
  howFound?: string | null;
  optIn?: string;
  notes?: string | null;
  referredBy?: string | null;
  seg07Path?: string | null;
  registeredAt?: string;
};

export async function createCustomer(
  body: CreateCustomerBody,
): Promise<CrmCustomer> {
  return apiPost(`${CRM}/customers`, body);
}

export async function patchCustomer(
  id: string,
  body: Partial<CreateCustomerBody> & { inactive?: boolean; manualFollowupDate?: string | null },
): Promise<CrmCustomer> {
  return apiPatch(`${CRM}/customers/${encodeURIComponent(id)}`, body);
}

export async function updateCustomerTags(
  id: string,
  add: string[],
  remove: string[],
): Promise<{ tags: string[] }> {
  return apiPost(`${CRM}/customers/${encodeURIComponent(id)}/tags`, {
    add,
    remove,
  });
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function fetchOrders(customerId: string): Promise<CrmOrder[]> {
  return apiGet(`${CRM}/customers/${encodeURIComponent(customerId)}/orders`);
}

export type CreateOrderBody = {
  orderDate: string;
  amount: number;
  channel?: string | null;
  notes?: string | null;
};

export async function createOrder(
  customerId: string,
  body: CreateOrderBody,
): Promise<CrmOrder> {
  return apiPost(
    `${CRM}/customers/${encodeURIComponent(customerId)}/orders`,
    body,
  );
}

export async function patchOrder(
  orderId: string,
  body: Partial<CreateOrderBody>,
): Promise<CrmOrder> {
  return apiPatch(`${CRM}/orders/${encodeURIComponent(orderId)}`, body);
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export type ContactsParams = {
  customerId?: string;
  scriptCode?: string;
  channel?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  limit?: number;
  offset?: number;
};

export async function fetchContacts(
  params: ContactsParams = {},
): Promise<CrmContact[]> {
  const q = new URLSearchParams();
  if (params.customerId) q.set("customerId", params.customerId);
  if (params.scriptCode) q.set("scriptCode", params.scriptCode);
  if (params.channel) q.set("channel", params.channel);
  if (params.dateFrom) q.set("dateFrom", params.dateFrom);
  if (params.dateTo) q.set("dateTo", params.dateTo);
  if (params.status) q.set("status", params.status);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  const s = q.toString();
  return apiGet(`${CRM}/contacts${s ? `?${s}` : ""}`);
}

export type CreateContactBody = {
  customerId: string;
  contactedAt?: string;
  scriptCode?: string | null;
  direction: "Enviado" | "Recebido";
  channel: string;
  status: "Sem resposta" | "Respondeu" | "Recusou";
  response?: string | null;
  notes?: string | null;
  tagsToAdd?: string[];
  tagsToRemove?: string[];
};

export async function createContact(
  body: CreateContactBody,
): Promise<CrmContact> {
  return apiPost(`${CRM}/contacts`, body);
}

export async function patchContact(
  id: string,
  body: Partial<CreateContactBody>,
): Promise<CrmContact> {
  return apiPatch(`${CRM}/contacts/${encodeURIComponent(id)}`, body);
}

// ─── Scripts ──────────────────────────────────────────────────────────────────

export async function fetchScripts(
  includeInactive = false,
): Promise<CrmScript[]> {
  const qs = includeInactive ? "?includeInactive=true" : "";
  return apiGet(`${CRM}/scripts${qs}`);
}

export async function fetchScript(
  code: string,
  vars?: Record<string, string>,
): Promise<CrmScript & { renderedBody: string }> {
  const q = new URLSearchParams(vars ?? {});
  const qs = q.toString();
  return apiGet(
    `${CRM}/scripts/${encodeURIComponent(code)}${qs ? `?${qs}` : ""}`,
  );
}

// ─── Parameters ───────────────────────────────────────────────────────────────

export async function fetchParameters(): Promise<CrmParameter[]> {
  return apiGet(`${CRM}/parameters`);
}

export async function patchParameter(
  key: string,
  value: string,
): Promise<CrmParameter> {
  return apiPatch(`${CRM}/parameters/${encodeURIComponent(key)}`, { value });
}
