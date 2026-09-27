import { apiGet, apiPatch, apiPost, apiPostFormData, apiDeleteNoContent, apiPut, ApiError } from "../../../../lib/api.ts";
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
  DocumentOverviewRow,
  EmployeeDocument,
  ReplaceDocumentPayload,
  UploadDocumentPayload,
} from "../../domain/entities/employee-document.ts";
import type {
  ConfirmShiftAttendancePayload,
  HrOverview,
  ListShiftsToReviewParams,
  ListShiftsToReviewResult,
  ShiftToReview,
} from "../../domain/entities/overview.ts";
import type { DocumentCategoryDefinition, DocumentCategoryPayload } from "../../domain/entities/document-category.ts";
import type {
  ApplyBaseScheduleResult,
  BaseScheduleCell,
  ClearShiftsScope,
  ClearWorkShiftsResult,
  CreateShiftRotationPayload,
  CreateWorkShiftPayload,
  CreateWorkShiftSeriesPayload,
  CreateWorkShiftSeriesResult,
  LeaveOverviewEntry,
  ListWorkShiftsParams,
  PreviewRepeatCalendarWeekPayload,
  PreviewRepeatCalendarWeekResult,
  PreviewWorkShiftSeriesPayload,
  PreviewWorkShiftSeriesResult,
  PublicHoliday,
  RepeatCalendarWeekPayload,
  RepeatCalendarWeekResult,
  RotationWeekPreview,
  ScheduleAlerts,
  ShiftRotation,
  UpdateWorkShiftPayload,
  UpdateWorkShiftSeriesScopePayload,
  UpsertBaseScheduleCellPayload,
  WorkShift,
} from "../../domain/entities/schedule.ts";

const BASE = "/api/hr/people";
const DOCUMENT_OVERVIEW_BASE = "/api/hr/document-overview";
const OVERVIEW_BASE = "/api/hr/overview";
const DOCUMENT_CATEGORIES_BASE = "/api/hr/document-categories";
const SCHEDULES_BASE = "/api/hr/schedules";
/** Rotas legacy (src/routes/hrLeaveRoutes.ts) — reaproveitadas diretamente, sem importar código do frontend legacy. */
const LEGACY_LEAVE_BASE = "/api/hr/leave";
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

  async getDocumentOverview(): Promise<DocumentOverviewRow[]> {
    return apiGet<DocumentOverviewRow[]>(DOCUMENT_OVERVIEW_BASE);
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

  async getShiftToReview(shiftId: string): Promise<ShiftToReview | null> {
    try {
      return await apiGet<ShiftToReview>(`${OVERVIEW_BASE}/shifts-to-review/${encodeURIComponent(shiftId)}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  }

  async confirmShiftAttendance(shiftId: string, payload: ConfirmShiftAttendancePayload): Promise<void> {
    await apiPatch<unknown>(`${LEGACY_SHIFTS_BASE}/${encodeURIComponent(shiftId)}/attendance`, payload);
  }

  async listDocumentCategories(): Promise<DocumentCategoryDefinition[]> {
    return apiGet<DocumentCategoryDefinition[]>(DOCUMENT_CATEGORIES_BASE);
  }

  async createDocumentCategory(payload: DocumentCategoryPayload): Promise<DocumentCategoryDefinition> {
    return apiPost<DocumentCategoryDefinition>(DOCUMENT_CATEGORIES_BASE, payload);
  }

  async updateDocumentCategory(
    id: string,
    payload: Partial<DocumentCategoryPayload>,
  ): Promise<DocumentCategoryDefinition> {
    return apiPatch<DocumentCategoryDefinition>(`${DOCUMENT_CATEGORIES_BASE}/${encodeURIComponent(id)}`, payload);
  }

  async setDocumentCategoryActive(id: string, active: boolean): Promise<DocumentCategoryDefinition> {
    return apiPatch<DocumentCategoryDefinition>(`${DOCUMENT_CATEGORIES_BASE}/${encodeURIComponent(id)}/active`, {
      active,
    });
  }

  // ── RH-03: Escalas & Turnos ────────────────────────────────────────────

  async listWorkShifts(params: ListWorkShiftsParams): Promise<WorkShift[]> {
    const q = new URLSearchParams({ from: params.from, to: params.to });
    if (params.employeeId) q.set("employeeId", params.employeeId);
    if (params.locationId) q.set("locationId", params.locationId);
    if (params.status) q.set("status", params.status);
    return apiGet<WorkShift[]>(`${SCHEDULES_BASE}/work-shifts?${q.toString()}`);
  }

  async createWorkShift(payload: CreateWorkShiftPayload): Promise<WorkShift[]> {
    return apiPost<WorkShift[]>(`${SCHEDULES_BASE}/work-shifts`, payload);
  }

  async updateWorkShift(id: string, payload: UpdateWorkShiftPayload): Promise<WorkShift> {
    return apiPatch<WorkShift>(`${SCHEDULES_BASE}/work-shifts/${encodeURIComponent(id)}`, payload);
  }

  async duplicateWorkShift(id: string, targetDate: string): Promise<WorkShift> {
    return apiPost<WorkShift>(`${SCHEDULES_BASE}/work-shifts/${encodeURIComponent(id)}/duplicate`, { targetDate });
  }

  async deleteWorkShift(id: string): Promise<void> {
    await apiDeleteNoContent(`${SCHEDULES_BASE}/work-shifts/${encodeURIComponent(id)}`);
  }

  async publishWorkShifts(ids: string[]): Promise<WorkShift[]> {
    return apiPost<WorkShift[]>(`${SCHEDULES_BASE}/work-shifts/publish`, { ids });
  }

  async getBaseSchedule(employeeId: string): Promise<BaseScheduleCell[]> {
    return apiGet<BaseScheduleCell[]>(`${SCHEDULES_BASE}/base-schedule/${encodeURIComponent(employeeId)}`);
  }

  async upsertBaseScheduleCell(
    employeeId: string,
    payload: UpsertBaseScheduleCellPayload,
  ): Promise<BaseScheduleCell> {
    return apiPut<BaseScheduleCell>(
      `${SCHEDULES_BASE}/base-schedule/${encodeURIComponent(employeeId)}/${payload.weekday}`,
      payload,
    );
  }

  async applyBaseSchedule(
    employeeId: string,
    weekStartDate: string,
    overrideExceptions?: boolean,
  ): Promise<ApplyBaseScheduleResult> {
    return apiPost<ApplyBaseScheduleResult>(`${SCHEDULES_BASE}/base-schedule/${encodeURIComponent(employeeId)}/apply`, {
      weekStartDate,
      ...(overrideExceptions !== undefined && { overrideExceptions }),
    });
  }

  async listShiftRotations(): Promise<ShiftRotation[]> {
    return apiGet<ShiftRotation[]>(`${SCHEDULES_BASE}/rotations`);
  }

  async createShiftRotation(payload: CreateShiftRotationPayload): Promise<ShiftRotation> {
    return apiPost<ShiftRotation>(`${SCHEDULES_BASE}/rotations`, payload);
  }

  async previewShiftRotation(id: string, weeks?: number): Promise<RotationWeekPreview[]> {
    const q = weeks ? `?weeks=${weeks}` : "";
    return apiGet<RotationWeekPreview[]>(`${SCHEDULES_BASE}/rotations/${encodeURIComponent(id)}/preview${q}`);
  }

  async applyShiftRotation(id: string, fromWeekStartDate?: string, weeks?: number): Promise<ApplyBaseScheduleResult> {
    return apiPost<ApplyBaseScheduleResult>(`${SCHEDULES_BASE}/rotations/${encodeURIComponent(id)}/apply`, {
      ...(fromWeekStartDate !== undefined && { fromWeekStartDate }),
      ...(weeks !== undefined && { weeks }),
    });
  }

  async setShiftRotationActive(id: string, active: boolean): Promise<ShiftRotation> {
    return apiPatch<ShiftRotation>(`${SCHEDULES_BASE}/rotations/${encodeURIComponent(id)}/active`, { active });
  }

  async getScheduleAlerts(from: string, to: string, locationId?: string): Promise<ScheduleAlerts> {
    const q = new URLSearchParams({ from, to });
    if (locationId) q.set("locationId", locationId);
    return apiGet<ScheduleAlerts>(`${SCHEDULES_BASE}/alerts?${q.toString()}`);
  }

  async previewWorkShiftSeries(payload: PreviewWorkShiftSeriesPayload): Promise<PreviewWorkShiftSeriesResult> {
    return apiPost<PreviewWorkShiftSeriesResult>(`${SCHEDULES_BASE}/work-shift-series/preview`, payload);
  }

  async createWorkShiftSeries(payload: CreateWorkShiftSeriesPayload): Promise<CreateWorkShiftSeriesResult> {
    return apiPost<CreateWorkShiftSeriesResult>(`${SCHEDULES_BASE}/work-shift-series`, payload);
  }

  async updateWorkShiftSeriesScope(id: string, payload: UpdateWorkShiftSeriesScopePayload): Promise<WorkShift[]> {
    return apiPatch<WorkShift[]>(`${SCHEDULES_BASE}/work-shifts/${encodeURIComponent(id)}/series-scope`, payload);
  }

  async clearWorkShifts(scope: ClearShiftsScope): Promise<ClearWorkShiftsResult> {
    return apiPost<ClearWorkShiftsResult>(`${SCHEDULES_BASE}/work-shifts/clear`, { scope });
  }

  async previewRepeatCalendarWeek(payload: PreviewRepeatCalendarWeekPayload): Promise<PreviewRepeatCalendarWeekResult> {
    return apiPost<PreviewRepeatCalendarWeekResult>(`${SCHEDULES_BASE}/work-shifts/repeat-week/preview`, payload);
  }

  async repeatCalendarWeek(payload: RepeatCalendarWeekPayload): Promise<RepeatCalendarWeekResult> {
    return apiPost<RepeatCalendarWeekResult>(`${SCHEDULES_BASE}/work-shifts/repeat-week`, payload);
  }

  async listLeaveOverview(year: number): Promise<LeaveOverviewEntry[]> {
    return apiGet<LeaveOverviewEntry[]>(`${LEGACY_LEAVE_BASE}/overview?year=${year}`);
  }

  async listPublicHolidays(year: number): Promise<PublicHoliday[]> {
    return apiGet<PublicHoliday[]>(`${LEGACY_LEAVE_BASE}/holidays?year=${year}`);
  }
}
