import { apiGet, apiGetBlob, apiGetVersioned, apiWrite } from "../../../../lib/api.ts";
import type {
  Agreement,
  CompensationAssignment,
  CompensationItem,
  Contract,
  ContractInput,
  CustomFieldDefinition,
  CustomValue,
  ImportResult,
  ManagerLink,
  Person,
  VersionedPerson,
} from "../../domain/entities/people.ts";
import type { PeopleApiPort } from "../../domain/ports/out/people-api.port.ts";

const P = "/api/novo-rh/people";
const C = "/api/novo-rh/catalog";

export class HttpPeopleApiAdapter implements PeopleApiPort {
  list(filter: { status?: "active" | "inactive" | "all"; q?: string }) {
    const q = new URLSearchParams();
    if (filter.status) q.set("status", filter.status);
    if (filter.q) q.set("q", filter.q);
    return apiGet<Person[]>(`${P}?${q.toString()}`);
  }
  async get(id: string): Promise<VersionedPerson> {
    const { data, etag } = await apiGetVersioned<Person>(`${P}/${id}`);
    return { person: data, etag };
  }
  async create(input: Partial<Person>) {
    return (await apiWrite<Person>(P, { body: input })).data;
  }
  async update(id: string, etag: string | null, input: Partial<Person> & { reason?: string }) {
    const { data, etag: next } = await apiWrite<Person>(`${P}/${id}`, { method: "PATCH", body: input, ifMatch: etag });
    return { person: data, etag: next };
  }
  async deactivate(id: string, etag: string | null, reason: string) {
    const { data, etag: next } = await apiWrite<Person>(`${P}/${id}/deactivate`, { body: { reason }, ifMatch: etag });
    return { person: data, etag: next };
  }
  async reactivate(id: string, etag: string | null, reason: string) {
    const { data, etag: next } = await apiWrite<Person>(`${P}/${id}/reactivate`, { body: { reason }, ifMatch: etag });
    return { person: data, etag: next };
  }
  async setKioskPin(id: string, pin: string) {
    await apiWrite(`${P}/${id}/kiosk-pin`, { method: "PUT", body: { pin } });
  }
  async transfer(input: { employeeId: string; locationId: string; effectiveDate: string; reason: string }) {
    await apiWrite("/api/novo-rh/structure/transfers", { body: input });
  }
  exportCsv() {
    return apiGetBlob(`${P}/export.csv`);
  }
  async importCsv(csv: string, dryRun: boolean) {
    return (await apiWrite<ImportResult>(`${P}/import`, { body: { csv, dryRun } })).data;
  }

  listContracts(id: string) {
    return apiGet<Contract[]>(`${P}/${id}/contracts`);
  }
  async createContract(id: string, input: ContractInput) {
    return (await apiWrite<Contract>(`${P}/${id}/contracts`, { body: input })).data;
  }
  async cancelContract(id: string, contract: Contract, reason: string) {
    return (await apiWrite<Contract>(`${P}/${id}/contracts/${contract.id}/cancel`, { body: { reason }, ifMatch: contract.etag })).data;
  }

  listManagers(id: string) {
    return apiGet<ManagerLink[]>(`${P}/${id}/managers`);
  }
  async addManager(id: string, input: Omit<ManagerLink, "id" | "employeeId">) {
    return (await apiWrite<ManagerLink>(`${P}/${id}/managers`, { body: input })).data;
  }
  async endManager(id: string, linkId: string, validTo: string) {
    return (await apiWrite<ManagerLink>(`${P}/${id}/managers/${linkId}/end`, { body: { validTo } })).data;
  }

  orgChart(date: string) {
    return apiGet<{ employeeId: string; managerEmployeeId: string; linkId: string; validFrom: string }[]>(`/api/novo-rh/org-chart?date=${encodeURIComponent(date)}`);
  }
  async setDirectManager(id: string, managerEmployeeId: string | null, validFrom: string) {
    return (await apiWrite<ManagerLink | null>(`${P}/${id}/direct-manager`, { method: "PUT", body: { managerEmployeeId, validFrom } })).data;
  }

  listCompensations(id: string) {
    return apiGet<CompensationAssignment[]>(`${P}/${id}/compensations`);
  }
  async assignCompensation(id: string, input: { itemId: string; amount: number | null; validFrom: string; validTo: string | null }) {
    return (await apiWrite<CompensationAssignment>(`${P}/${id}/compensations`, { body: input })).data;
  }
  async endCompensation(id: string, assignmentId: string, validTo: string) {
    return (await apiWrite<CompensationAssignment>(`${P}/${id}/compensations/${assignmentId}/end`, { body: { validTo } })).data;
  }

  getCustomValues(id: string) {
    return apiGet<CustomValue[]>(`${P}/${id}/custom-fields`);
  }
  async setCustomValues(id: string, values: Record<string, string | null>) {
    return (await apiWrite<CustomValue[]>(`${P}/${id}/custom-fields`, { method: "PUT", body: { values } })).data;
  }

  listPositions() {
    return apiGet<{ id: string; name: string }[]>("/api/novo-rh/catalog/positions");
  }
  listAgreements() {
    return apiGet<Agreement[]>(`${C}/agreements`);
  }
  async createAgreement(input: { name: string; code: string | null }) {
    return (await apiWrite<Agreement>(`${C}/agreements`, { body: input })).data;
  }
  async archiveAgreement(id: string) {
    await apiWrite(`${C}/agreements/${id}/archive`, {});
  }
  listCompensationItems() {
    return apiGet<CompensationItem[]>(`${C}/compensation-items`);
  }
  async createCompensationItem(input: Omit<CompensationItem, "id" | "active">) {
    return (await apiWrite<CompensationItem>(`${C}/compensation-items`, { body: input })).data;
  }
  async deactivateCompensationItem(id: string) {
    await apiWrite(`${C}/compensation-items/${id}/deactivate`, {});
  }
  listCustomFields() {
    return apiGet<CustomFieldDefinition[]>(`${C}/custom-fields`);
  }
  async createCustomField(input: Omit<CustomFieldDefinition, "id" | "archived">) {
    return (await apiWrite<CustomFieldDefinition>(`${C}/custom-fields`, { body: input })).data;
  }
  async archiveCustomField(id: string) {
    await apiWrite(`${C}/custom-fields/${id}/archive`, {});
  }
}
