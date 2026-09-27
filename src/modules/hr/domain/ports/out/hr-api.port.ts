import type {
  CreateEmployeePayload,
  Employee,
  EmployeeHistoryEntry,
  EmployeeProfile,
  ListEmployeesParams,
  ListEmployeesResult,
  PeopleKpis,
  UpdateEmployeePayload,
} from "../../entities/employee.ts";
import type {
  EmployeeDocument,
  ReplaceDocumentPayload,
  UploadDocumentPayload,
} from "../../entities/employee-document.ts";
import type {
  ConfirmShiftAttendancePayload,
  HrOverview,
  ListShiftsToReviewParams,
  ListShiftsToReviewResult,
  ShiftToReview,
} from "../../entities/overview.ts";
import type { DocumentCategoryDefinition, DocumentCategoryPayload } from "../../entities/document-category.ts";
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
} from "../../entities/schedule.ts";

export interface HrApiPort {
  listEmployees(params: ListEmployeesParams): Promise<ListEmployeesResult>;
  getKpis(): Promise<PeopleKpis>;
  getEmployeeProfile(id: string): Promise<EmployeeProfile>;
  createEmployee(payload: CreateEmployeePayload): Promise<Employee>;
  updateEmployee(id: string, payload: UpdateEmployeePayload): Promise<Employee>;
  setEmployeeStatus(id: string, status: "active" | "inactive"): Promise<Employee>;
  uploadEmployeePhoto(id: string, file: File): Promise<{ photoUrl: string }>;
  getEmployeeHistory(
    id: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: EmployeeHistoryEntry[]; total: number }>;

  listEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]>;
  uploadEmployeeDocument(employeeId: string, payload: UploadDocumentPayload): Promise<EmployeeDocument>;
  replaceEmployeeDocument(
    employeeId: string,
    documentId: string,
    payload: ReplaceDocumentPayload,
  ): Promise<EmployeeDocument>;
  removeEmployeeDocument(employeeId: string, documentId: string): Promise<void>;
  getEmployeeDocumentDownloadUrl(employeeId: string, documentId: string): Promise<string>;
  getEmployeeDocumentHistory(employeeId: string, documentId: string): Promise<EmployeeDocument[]>;

  getOverview(locationId?: string): Promise<HrOverview>;
  listShiftsToReview(params: ListShiftsToReviewParams): Promise<ListShiftsToReviewResult>;
  /** Busca 1 turno "por conferir" pelo id — drill-down direto a partir de "Hoje na operação". Null quando já não precisa de conferência. */
  getShiftToReview(shiftId: string): Promise<ShiftToReview | null>;
  /** Chama a rota legacy `PATCH /api/hr/shifts/:id/attendance` diretamente — não importa `src/pages/hr/hrApi.ts`. */
  confirmShiftAttendance(shiftId: string, payload: ConfirmShiftAttendancePayload): Promise<void>;

  listDocumentCategories(): Promise<DocumentCategoryDefinition[]>;
  createDocumentCategory(payload: DocumentCategoryPayload): Promise<DocumentCategoryDefinition>;
  updateDocumentCategory(id: string, payload: Partial<DocumentCategoryPayload>): Promise<DocumentCategoryDefinition>;
  setDocumentCategoryActive(id: string, active: boolean): Promise<DocumentCategoryDefinition>;

  // ── RH-03: Escalas & Turnos ──────────────────────────────────────────────
  listWorkShifts(params: ListWorkShiftsParams): Promise<WorkShift[]>;
  createWorkShift(payload: CreateWorkShiftPayload): Promise<WorkShift[]>;
  updateWorkShift(id: string, payload: UpdateWorkShiftPayload): Promise<WorkShift>;
  duplicateWorkShift(id: string, targetDate: string): Promise<WorkShift>;
  deleteWorkShift(id: string): Promise<void>;
  publishWorkShifts(ids: string[]): Promise<WorkShift[]>;

  getBaseSchedule(employeeId: string): Promise<BaseScheduleCell[]>;
  upsertBaseScheduleCell(employeeId: string, payload: UpsertBaseScheduleCellPayload): Promise<BaseScheduleCell>;
  applyBaseSchedule(employeeId: string, weekStartDate: string, overrideExceptions?: boolean): Promise<ApplyBaseScheduleResult>;

  listShiftRotations(): Promise<ShiftRotation[]>;
  createShiftRotation(payload: CreateShiftRotationPayload): Promise<ShiftRotation>;
  previewShiftRotation(id: string, weeks?: number): Promise<RotationWeekPreview[]>;
  applyShiftRotation(id: string, fromWeekStartDate?: string, weeks?: number): Promise<ApplyBaseScheduleResult>;
  setShiftRotationActive(id: string, active: boolean): Promise<ShiftRotation>;

  getScheduleAlerts(from: string, to: string, locationId?: string): Promise<ScheduleAlerts>;

  /** "Novo turno" — padrão semanal recorrente. O preview usa exatamente o mesmo cálculo do backend que `createWorkShiftSeries`. */
  previewWorkShiftSeries(payload: PreviewWorkShiftSeriesPayload): Promise<PreviewWorkShiftSeriesResult>;
  createWorkShiftSeries(payload: CreateWorkShiftSeriesPayload): Promise<CreateWorkShiftSeriesResult>;
  /** Edita um turno pertencente (ou não) a uma série, com âmbito explícito. */
  updateWorkShiftSeriesScope(id: string, payload: UpdateWorkShiftSeriesScopePayload): Promise<WorkShift[]>;
  /** "Limpar turnos" — âmbito explícito, nunca um "limpar tudo" implícito. */
  clearWorkShifts(scope: ClearShiftsScope): Promise<ClearWorkShiftsResult>;

  /** "Repetir escala pelo calendário" — copia os turnos reais de uma semana já montada para as semanas seguintes. Preview usa exatamente o mesmo cálculo da criação. */
  previewRepeatCalendarWeek(payload: PreviewRepeatCalendarWeekPayload): Promise<PreviewRepeatCalendarWeekResult>;
  repeatCalendarWeek(payload: RepeatCalendarWeekPayload): Promise<RepeatCalendarWeekResult>;

  /** Rota legacy `GET /api/hr/leave/overview` diretamente — não importa `src/pages/hr/hrApi.ts` (mesmo padrão de `confirmShiftAttendance`). */
  listLeaveOverview(year: number): Promise<LeaveOverviewEntry[]>;
  /** Rota legacy `GET /api/hr/leave/holidays` diretamente. */
  listPublicHolidays(year: number): Promise<PublicHoliday[]>;
}
