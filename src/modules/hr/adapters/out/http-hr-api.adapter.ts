import type { GrantPortalAccessResult, PortalAccess } from "../../domain/entities/portal-access.ts";
import type { InboxRequest, RequestsInbox } from "../../domain/entities/portal-requests.ts";
import type { AbsenceBoard, AbsenceImpact, ConfirmAbsencePayload, ConfirmAbsencePreview, ConfirmAbsenceResult, LeaveBalanceRow, OccurrenceRef, RegisterAbsencePayload } from "../../domain/entities/absences.ts";
import { apiGet, apiPatch, apiPost, apiPostFormData, apiDeleteNoContent, apiDeleteJson, apiPut, ApiError } from "../../../../lib/api.ts";
import type { HrApiPort } from "../../domain/ports/out/hr-api.port.ts";
import type { Position, PositionPayload } from "../../domain/entities/position.ts";
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
  AutomationGenerationResult,
  ShiftAutomation,
  ShiftAutomationPayload,
  ShiftAutomationStatus,
} from "../../domain/entities/shift-automation.ts";
import type {
  ApplyTemplateResult,
  OccurrenceDecision,
  ShiftTemplate,
  ShiftTemplatePayload,
  TemplateApplicationConfig,
  TemplateApplicationPreview,
} from "../../domain/entities/shift-template.ts";
import type { PayslipCategory, PayslipImportResult, PayslipMappingEntry, PayslipPreviewRow } from "../../domain/entities/payslip-import.ts";
import type {
  AttendanceIssueDetail,
  CorrectShiftAttendancePayload,
  ListAttendanceIssuesResult,
  MonthlyClosureStatus,
} from "../../domain/entities/attendance-conference.ts";
import type {
  AttendanceRuleChangeEntry,
  AttendanceRulesConfig,
  UpdateAttendanceRulesPayload,
} from "../../domain/entities/attendance-rules.ts";
import type { MonthlyAttendanceSummaryResult } from "../../domain/entities/attendance-summary.ts";
import type { AttendanceEmployeeDetailResult } from "../../domain/entities/attendance-employee-detail.ts";
import type {
  ApplyBaseScheduleResult,
  BaseScheduleCell,
  ClearShiftsScope,
  ClearWorkShiftsResult,
  ClearWorkShiftsPreview,
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
const ATTENDANCE_BASE = "/api/hr/attendance";
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
    if (params.positionId) q.set("positionId", params.positionId);
    if (params.locationId) q.set("locationId", params.locationId);
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

  async listPositions(): Promise<Position[]> {
    return apiGet<Position[]>("/api/hr/positions");
  }

  async createPosition(payload: PositionPayload): Promise<Position> {
    return apiPost<Position>("/api/hr/positions", payload);
  }

  async updatePosition(id: string, payload: PositionPayload): Promise<Position> {
    return apiPatch<Position>(`/api/hr/positions/${encodeURIComponent(id)}`, payload);
  }

  async setPositionActive(id: string, active: boolean): Promise<Position> {
    return apiPatch<Position>(`/api/hr/positions/${encodeURIComponent(id)}/active`, { active });
  }

  async setEmployeeStatus(id: string, status: "active" | "inactive"): Promise<Employee> {
    return apiPatch<Employee>(`${BASE}/${encodeURIComponent(id)}/status`, { status });
  }

  async getPortalAccess(employeeId: string): Promise<PortalAccess> {
    return apiGet<PortalAccess>(`/api/hr/people/${encodeURIComponent(employeeId)}/portal-access`);
  }

  async grantPortalAccess(employeeId: string): Promise<GrantPortalAccessResult> {
    return apiPost<GrantPortalAccessResult>(`/api/hr/people/${encodeURIComponent(employeeId)}/portal-access`, {});
  }

  async revokePortalAccess(employeeId: string): Promise<void> {
    await apiDeleteJson<{ revoked: true }>(`/api/hr/people/${encodeURIComponent(employeeId)}/portal-access`);
  }

  async setEmployeeKioskPin(id: string, pin: string): Promise<void> {
    await apiPatch<unknown>(`/api/hr/employees/${encodeURIComponent(id)}/kiosk-pin`, { pin });
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
    if (payload.period) formData.append("period", payload.period);
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

  async previewPayslipImport(category: PayslipCategory, period: string, files: File[]): Promise<PayslipPreviewRow[]> {
    const formData = new FormData();
    formData.append("category", category);
    formData.append("period", period);
    for (const f of files) formData.append("files", f);
    return apiPostFormData<PayslipPreviewRow[]>("/api/hr/payslips/import/preview", formData);
  }

  async importPayslips(category: PayslipCategory, period: string, files: File[], mapping: PayslipMappingEntry[]): Promise<PayslipImportResult[]> {
    const formData = new FormData();
    formData.append("category", category);
    formData.append("period", period);
    formData.append("mapping", JSON.stringify(mapping));
    const wanted = new Set(mapping.map((m) => m.fileName));
    for (const f of files) if (wanted.has(f.name)) formData.append("files", f);
    return apiPostFormData<PayslipImportResult[]>("/api/hr/payslips/import", formData);
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

  async reviewEmployeeDocument(employeeId: string, documentId: string, payload: { decision: "approve" | "reject"; note?: string; expiresAt?: string | null }): Promise<void> {
    await apiPost(`/api/hr/people/${encodeURIComponent(employeeId)}/documents/${encodeURIComponent(documentId)}/review`, payload);
  }

  async getRequestsInbox(): Promise<RequestsInbox> {
    return apiGet<RequestsInbox>("/api/hr/requests");
  }

  async decidePortalRequest(id: string, decision: "approve" | "reject", note: string | null): Promise<InboxRequest> {
    return apiPost<InboxRequest>(`/api/hr/requests/${encodeURIComponent(id)}/decide`, { decision, note });
  }

  async getRequestAttachmentUrl(id: string): Promise<string> {
    return (await apiGet<{ url: string }>(`/api/hr/requests/${encodeURIComponent(id)}/attachment-url`)).url;
  }

  async getAbsenceBoard(from: string, to: string): Promise<AbsenceBoard> {
    return apiGet<AbsenceBoard>(`/api/hr/leave/board?from=${from}&to=${to}`);
  }

  async previewAbsence(payload: RegisterAbsencePayload): Promise<AbsenceImpact> {
    return apiPost<AbsenceImpact>("/api/hr/leave/absences/preview", payload);
  }

  async registerAbsence(payload: RegisterAbsencePayload): Promise<{ id: string }> {
    return apiPost<{ id: string }>("/api/hr/leave/absences", payload);
  }

  async cancelAbsence(id: string, reason: string): Promise<void> {
    await apiPost(`/api/hr/leave/absences/${encodeURIComponent(id)}/cancel`, { reason });
  }

  async listLeaveBalances(year: number): Promise<LeaveBalanceRow[]> {
    return apiGet<LeaveBalanceRow[]>(`/api/hr/leave/balances?year=${year}`);
  }

  async setLeaveBalance(employeeId: string, year: number, daysEntitled: number, daysCarriedOver: number): Promise<void> {
    await apiPut(`/api/hr/leave/balances/${encodeURIComponent(employeeId)}/${year}`, { daysEntitled, daysCarriedOver });
  }

  async previewConfirmAbsence(ref: OccurrenceRef): Promise<ConfirmAbsencePreview> {
    return apiPost<ConfirmAbsencePreview>("/api/hr/attendance/confirm-absence/preview", ref);
  }

  async confirmAbsence(payload: ConfirmAbsencePayload): Promise<ConfirmAbsenceResult> {
    return apiPost<ConfirmAbsenceResult>("/api/hr/attendance/confirm-absence", payload);
  }

  async deleteWorkShift(id: string): Promise<{ undoToken: string }> {
    return apiDeleteJson<{ undoToken: string }>(`${SCHEDULES_BASE}/work-shifts/${encodeURIComponent(id)}`);
  }

  async undoDeleteWorkShifts(undoToken: string): Promise<{ restoredCount: number }> {
    return apiPost<{ restoredCount: number }>(`${SCHEDULES_BASE}/work-shifts/undo`, { undoToken });
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

  async listShiftTemplates(): Promise<ShiftTemplate[]> {
    return apiGet<ShiftTemplate[]>(`${SCHEDULES_BASE}/templates`);
  }

  async createShiftTemplate(payload: ShiftTemplatePayload): Promise<ShiftTemplate> {
    return apiPost<ShiftTemplate>(`${SCHEDULES_BASE}/templates`, payload);
  }

  async updateShiftTemplate(id: string, payload: Partial<ShiftTemplatePayload>): Promise<ShiftTemplate> {
    return apiPatch<ShiftTemplate>(`${SCHEDULES_BASE}/templates/${encodeURIComponent(id)}`, payload);
  }

  async setShiftTemplateActive(id: string, active: boolean): Promise<ShiftTemplate> {
    return apiPatch<ShiftTemplate>(`${SCHEDULES_BASE}/templates/${encodeURIComponent(id)}/active`, { active });
  }

  async previewTemplateApplication(templateId: string, config: TemplateApplicationConfig): Promise<TemplateApplicationPreview> {
    return apiPost<TemplateApplicationPreview>(`${SCHEDULES_BASE}/templates/${encodeURIComponent(templateId)}/apply/preview`, config);
  }

  async applyTemplate(templateId: string, config: TemplateApplicationConfig, decisions: Record<string, OccurrenceDecision>): Promise<ApplyTemplateResult> {
    return apiPost<ApplyTemplateResult>(`${SCHEDULES_BASE}/templates/${encodeURIComponent(templateId)}/apply`, { ...config, decisions });
  }

  async listShiftAutomations(): Promise<ShiftAutomation[]> {
    return apiGet<ShiftAutomation[]>(`${SCHEDULES_BASE}/automations`);
  }

  async createShiftAutomation(payload: ShiftAutomationPayload, generateNow: boolean) {
    return apiPost<{ automation: ShiftAutomation; generation: AutomationGenerationResult | null }>(`${SCHEDULES_BASE}/automations`, { ...payload, generateNow });
  }

  async updateShiftAutomation(id: string, payload: Partial<ShiftAutomationPayload>): Promise<ShiftAutomation> {
    return apiPatch<ShiftAutomation>(`${SCHEDULES_BASE}/automations/${encodeURIComponent(id)}`, payload);
  }

  async setShiftAutomationStatus(id: string, status: ShiftAutomationStatus): Promise<ShiftAutomation> {
    return apiPatch<ShiftAutomation>(`${SCHEDULES_BASE}/automations/${encodeURIComponent(id)}/status`, { status });
  }

  async generateShiftAutomation(id: string, weeks?: number): Promise<AutomationGenerationResult> {
    return apiPost<AutomationGenerationResult>(`${SCHEDULES_BASE}/automations/${encodeURIComponent(id)}/generate`, weeks ? { weeks } : {});
  }

  async dismissAutomationIssue(id: string): Promise<void> {
    await apiPost<{ dismissed: boolean }>(`${SCHEDULES_BASE}/automation-issues/${encodeURIComponent(id)}/dismiss`, {});
  }

  async deleteShiftRotation(id: string): Promise<void> {
    await apiDeleteNoContent(`${SCHEDULES_BASE}/rotations/${encodeURIComponent(id)}`);
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

  async previewClearWorkShifts(scope: ClearShiftsScope): Promise<ClearWorkShiftsPreview> {
    return apiPost<ClearWorkShiftsPreview>(`${SCHEDULES_BASE}/work-shifts/clear/preview`, { scope });
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

  async listAttendanceIssues(year: number, month: number, locationId?: string): Promise<ListAttendanceIssuesResult> {
    const q = new URLSearchParams({ year: String(year), month: String(month) });
    if (locationId) q.set("locationId", locationId);
    return apiGet<ListAttendanceIssuesResult>(`${ATTENDANCE_BASE}/issues?${q.toString()}`);
  }

  async getAttendanceIssueDetail(
    workDate: string,
    key: { shiftId?: string; attendanceId?: string },
  ): Promise<AttendanceIssueDetail | null> {
    const q = new URLSearchParams({ workDate });
    if (key.shiftId) q.set("shiftId", key.shiftId);
    if (key.attendanceId) q.set("attendanceId", key.attendanceId);
    try {
      return await apiGet<AttendanceIssueDetail>(`${ATTENDANCE_BASE}/issues/detail?${q.toString()}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  }

  async correctShiftAttendance(payload: CorrectShiftAttendancePayload): Promise<AttendanceIssueDetail | null> {
    return apiPost<AttendanceIssueDetail | null>(`${ATTENDANCE_BASE}/issues/correct`, payload);
  }

  async getMonthlyClosureStatus(year: number, month: number): Promise<MonthlyClosureStatus> {
    return apiGet<MonthlyClosureStatus>(`${ATTENDANCE_BASE}/closure?year=${year}&month=${month}`);
  }

  async closeMonthlyPeriod(year: number, month: number): Promise<MonthlyClosureStatus> {
    return apiPost<MonthlyClosureStatus>(`${ATTENDANCE_BASE}/closure/close`, { year, month });
  }

  async reopenMonthlyPeriod(year: number, month: number, reason: string): Promise<MonthlyClosureStatus> {
    return apiPost<MonthlyClosureStatus>(`${ATTENDANCE_BASE}/closure/reopen`, { year, month, reason });
  }

  // ── Fase 2.1: Regras de Assiduidade, Tolerâncias e Conferência ───────────
  // Contrato pendente de implementação no backend — ver README do módulo,
  // secção "Known gaps".
  async getAttendanceRules(): Promise<AttendanceRulesConfig> {
    return apiGet<AttendanceRulesConfig>(`${ATTENDANCE_BASE}/rules`);
  }

  async updateAttendanceRules(payload: UpdateAttendanceRulesPayload): Promise<AttendanceRulesConfig> {
    return apiPut<AttendanceRulesConfig>(`${ATTENDANCE_BASE}/rules`, payload);
  }

  async listAttendanceRuleChanges(): Promise<AttendanceRuleChangeEntry[]> {
    return apiGet<AttendanceRuleChangeEntry[]>(`${ATTENDANCE_BASE}/rules/history`);
  }

  async getMonthlyAttendanceSummary(year: number, month: number, locationId?: string): Promise<MonthlyAttendanceSummaryResult> {
    const q = new URLSearchParams({ year: String(year), month: String(month) });
    if (locationId) q.set("locationId", locationId);
    return apiGet<MonthlyAttendanceSummaryResult>(`${ATTENDANCE_BASE}/summary?${q.toString()}`);
  }

  async getEmployeeAttendanceDetail(employeeId: string, year: number, month: number): Promise<AttendanceEmployeeDetailResult | null> {
    const q = new URLSearchParams({ year: String(year), month: String(month) });
    try {
      return await apiGet<AttendanceEmployeeDetailResult>(`${ATTENDANCE_BASE}/employee/${encodeURIComponent(employeeId)}?${q.toString()}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  }
}
