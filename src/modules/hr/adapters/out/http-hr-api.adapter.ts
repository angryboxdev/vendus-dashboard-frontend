import { apiGet, apiPatch, apiPost, apiPostFormData, apiDeleteNoContent } from "../../../../lib/api.ts";
import type { HrApiPort } from "../../domain/ports/out/hr-api.port.ts";
import type {
  CreateEmployeePayload,
  Employee,
  EmployeeHistoryEntry,
  EmployeeProfile,
  ListEmployeesParams,
  ListEmployeesResult,
  PeopleKpis,
  UpdateEmployeePayload,
} from "../../domain/entities/employee.ts";
import type {
  EmployeeDocument,
  ReplaceDocumentPayload,
  UploadDocumentPayload,
} from "../../domain/entities/employee-document.ts";
import type {
  ConfirmShiftAttendancePayload,
  HrOverview,
  ListShiftsToReviewParams,
  ListShiftsToReviewResult,
} from "../../domain/entities/overview.ts";

const BASE = "/api/hr/people";
const OVERVIEW_BASE = "/api/hr/overview";
/** Rota legacy (src/routes/hrRoutes.ts) — reaproveitada diretamente, sem importar código do frontend legacy. */
const LEGACY_SHIFTS_BASE = "/api/hr/shifts";

export class HttpHrApiAdapter implements HrApiPort {
  async listEmployees(params: ListEmployeesParams): Promise<ListEmployeesResult> {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.status) q.set("status", params.status);
    if (params.employmentType) q.set("employmentType", params.employmentType);
    if (params.documentSituation) q.set("documentSituation", params.documentSituation);
    if (params.profileComplete) q.set("profileComplete", params.profileComplete);
    q.set("page", String(params.page));
    q.set("pageSize", String(params.pageSize));
    return apiGet<ListEmployeesResult>(`${BASE}?${q.toString()}`);
  }

  async getKpis(): Promise<PeopleKpis> {
    return apiGet<PeopleKpis>(`${BASE}/kpis`);
  }

  async getEmployeeProfile(id: string): Promise<EmployeeProfile> {
    return apiGet<EmployeeProfile>(`${BASE}/${encodeURIComponent(id)}`);
  }

  async createEmployee(payload: CreateEmployeePayload): Promise<Employee> {
    return apiPost<Employee>(BASE, payload);
  }

  async updateEmployee(id: string, payload: UpdateEmployeePayload): Promise<Employee> {
    return apiPatch<Employee>(`${BASE}/${encodeURIComponent(id)}`, payload);
  }

  async setEmployeeStatus(id: string, status: "active" | "inactive"): Promise<Employee> {
    return apiPatch<Employee>(`${BASE}/${encodeURIComponent(id)}/status`, { status });
  }

  async uploadEmployeePhoto(id: string, file: File): Promise<{ photoUrl: string }> {
    const formData = new FormData();
    formData.append("file", file);
    return apiPostFormData<{ photoUrl: string }>(`${BASE}/${encodeURIComponent(id)}/photo`, formData);
  }

  async getEmployeeHistory(
    id: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: EmployeeHistoryEntry[]; total: number }> {
    const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    return apiGet<{ items: EmployeeHistoryEntry[]; total: number }>(
      `${BASE}/${encodeURIComponent(id)}/history?${q.toString()}`,
    );
  }

  async listEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]> {
    return apiGet<EmployeeDocument[]>(`${BASE}/${encodeURIComponent(employeeId)}/documents`);
  }

  async uploadEmployeeDocument(employeeId: string, payload: UploadDocumentPayload): Promise<EmployeeDocument> {
    const formData = new FormData();
    formData.append("file", payload.file);
    formData.append("category", payload.category);
    formData.append("mandatory", String(payload.mandatory));
    formData.append("origin", payload.origin);
    if (payload.expiresAt) formData.append("expiresAt", payload.expiresAt);
    return apiPostFormData<EmployeeDocument>(`${BASE}/${encodeURIComponent(employeeId)}/documents`, formData);
  }

  async replaceEmployeeDocument(
    employeeId: string,
    documentId: string,
    payload: ReplaceDocumentPayload,
  ): Promise<EmployeeDocument> {
    const formData = new FormData();
    formData.append("file", payload.file);
    if (payload.expiresAt !== undefined) formData.append("expiresAt", payload.expiresAt ?? "");
    return apiPostFormData<EmployeeDocument>(
      `${BASE}/${encodeURIComponent(employeeId)}/documents/${encodeURIComponent(documentId)}/replace`,
      formData,
    );
  }

  async removeEmployeeDocument(employeeId: string, documentId: string): Promise<void> {
    await apiDeleteNoContent(
      `${BASE}/${encodeURIComponent(employeeId)}/documents/${encodeURIComponent(documentId)}`,
    );
  }

  async getEmployeeDocumentDownloadUrl(employeeId: string, documentId: string): Promise<string> {
    const { url } = await apiGet<{ url: string }>(
      `${BASE}/${encodeURIComponent(employeeId)}/documents/${encodeURIComponent(documentId)}/download-url`,
    );
    return url;
  }

  async getEmployeeDocumentHistory(employeeId: string, documentId: string): Promise<EmployeeDocument[]> {
    return apiGet<EmployeeDocument[]>(
      `${BASE}/${encodeURIComponent(employeeId)}/documents/${encodeURIComponent(documentId)}/history`,
    );
  }

  async getOverview(locationId?: string): Promise<HrOverview> {
    const q = new URLSearchParams();
    if (locationId) q.set("locationId", locationId);
    const qs = q.toString();
    return apiGet<HrOverview>(`${OVERVIEW_BASE}${qs ? `?${qs}` : ""}`);
  }

  async listShiftsToReview(params: ListShiftsToReviewParams): Promise<ListShiftsToReviewResult> {
    const q = new URLSearchParams();
    if (params.locationId) q.set("locationId", params.locationId);
    if (params.priority) q.set("priority", params.priority);
    if (params.search) q.set("search", params.search);
    q.set("page", String(params.page));
    q.set("pageSize", String(params.pageSize));
    return apiGet<ListShiftsToReviewResult>(`${OVERVIEW_BASE}/shifts-to-review?${q.toString()}`);
  }

  async confirmShiftAttendance(shiftId: string, payload: ConfirmShiftAttendancePayload): Promise<void> {
    await apiPatch<unknown>(`${LEGACY_SHIFTS_BASE}/${encodeURIComponent(shiftId)}/attendance`, payload);
  }
}
