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
  DocumentOverviewRow,
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
  AutomationGenerationResult,
  ShiftAutomation,
  ShiftAutomationPayload,
  ShiftAutomationStatus,
} from "../../entities/shift-automation.ts";
import type {
  ApplyTemplateResult,
  OccurrenceDecision,
  ShiftTemplate,
  ShiftTemplatePayload,
  TemplateApplicationConfig,
  TemplateApplicationPreview,
} from "../../entities/shift-template.ts";
import type { PayslipCategory, PayslipImportResult, PayslipMappingEntry, PayslipPreviewRow } from "../../entities/payslip-import.ts";
import type { Position, PositionPayload } from "../../entities/position.ts";
import type {
  AttendanceIssueDetail,
  CorrectShiftAttendancePayload,
  ListAttendanceIssuesResult,
  MonthlyClosureStatus,
} from "../../entities/attendance-conference.ts";
import type {
  AttendanceRuleChangeEntry,
  AttendanceRulesConfig,
  UpdateAttendanceRulesPayload,
} from "../../entities/attendance-rules.ts";
import type { MonthlyAttendanceSummaryResult } from "../../entities/attendance-summary.ts";
import type { AttendanceEmployeeDetailResult } from "../../entities/attendance-employee-detail.ts";
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
} from "../../entities/schedule.ts";

export interface HrApiPort {
  listEmployees(params: ListEmployeesParams): Promise<ListEmployeesResult>;
  getKpis(): Promise<PeopleKpis>;
  getEmployeeProfile(id: string): Promise<EmployeeProfile>;
  createEmployee(payload: CreateEmployeePayload): Promise<Employee>;
  updateEmployee(id: string, payload: UpdateEmployeePayload): Promise<Employee>;
  setEmployeeStatus(id: string, status: "active" | "inactive"): Promise<Employee>;
  uploadEmployeePhoto(id: string, file: File): Promise<{ photoUrl: string }>;
  setEmployeeKioskPin(id: string, pin: string): Promise<void>;
  getEmployeeHistory(
    id: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: EmployeeHistoryEntry[]; total: number }>;

  // ── Cargos (Base Organizacional) — `/api/hr/positions`; nunca há delete ──
  listPositions(): Promise<Position[]>;
  createPosition(payload: Required<Pick<PositionPayload, "name">> & PositionPayload): Promise<Position>;
  updatePosition(id: string, payload: PositionPayload): Promise<Position>;
  setPositionActive(id: string, active: boolean): Promise<Position>;

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
  /** 1 linha por (colaborador ativo × requisito documental) — fonte única da aba "Pessoas > Documentos". */
  getDocumentOverview(): Promise<DocumentOverviewRow[]>;
  /** Importação de recibos (ticket 10, só admin) — identifica o colaborador de cada PDF; não grava nada. */
  previewPayslipImport(category: PayslipCategory, period: string, files: File[]): Promise<PayslipPreviewRow[]>;
  /** Grava os recibos confirmados (os PDFs são reenviados). */
  importPayslips(category: PayslipCategory, period: string, files: File[], mapping: PayslipMappingEntry[]): Promise<PayslipImportResult[]>;

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

  // ── RH 2.0: Modelos de turno ─────────────────────────────────────────────
  listShiftTemplates(): Promise<ShiftTemplate[]>;
  createShiftTemplate(payload: ShiftTemplatePayload): Promise<ShiftTemplate>;
  updateShiftTemplate(id: string, payload: Partial<ShiftTemplatePayload>): Promise<ShiftTemplate>;
  setShiftTemplateActive(id: string, active: boolean): Promise<ShiftTemplate>;
  /** Aplicar modelo (ticket 02) — pré-visualização, não grava nada. */
  previewTemplateApplication(templateId: string, config: TemplateApplicationConfig): Promise<TemplateApplicationPreview>;
  /** Aplicar modelo — confirma; o backend revalida tudo e só aplica o que continua igual. */
  applyTemplate(templateId: string, config: TemplateApplicationConfig, decisions: Record<string, OccurrenceDecision>): Promise<ApplyTemplateResult>;

  // ── RH 2.0: Automatizações ──────────────────────────────────────────────
  listShiftAutomations(): Promise<ShiftAutomation[]>;
  /** `generateNow`: gera já as primeiras semanas ("Guardar como automatização" no Aplicar modelo). */
  createShiftAutomation(payload: ShiftAutomationPayload, generateNow: boolean): Promise<{ automation: ShiftAutomation; generation: AutomationGenerationResult | null }>;
  updateShiftAutomation(id: string, payload: Partial<ShiftAutomationPayload>): Promise<ShiftAutomation>;
  setShiftAutomationStatus(id: string, status: ShiftAutomationStatus): Promise<ShiftAutomation>;
  /** "Gerar próximas X semanas". */
  generateShiftAutomation(id: string, weeks?: number): Promise<AutomationGenerationResult>;
  dismissAutomationIssue(id: string): Promise<void>;

  listShiftRotations(): Promise<ShiftRotation[]>;
  createShiftRotation(payload: CreateShiftRotationPayload): Promise<ShiftRotation>;
  previewShiftRotation(id: string, weeks?: number): Promise<RotationWeekPreview[]>;
  applyShiftRotation(id: string, fromWeekStartDate?: string, weeks?: number): Promise<ApplyBaseScheduleResult>;
  setShiftRotationActive(id: string, active: boolean): Promise<ShiftRotation>;
  /** Apaga a rotação; os turnos já criados por ela ficam na escala. */
  deleteShiftRotation(id: string): Promise<void>;

  getScheduleAlerts(from: string, to: string, locationId?: string): Promise<ScheduleAlerts>;

  /** "Novo turno" — padrão semanal recorrente. O preview usa exatamente o mesmo cálculo do backend que `createWorkShiftSeries`. */
  previewWorkShiftSeries(payload: PreviewWorkShiftSeriesPayload): Promise<PreviewWorkShiftSeriesResult>;
  createWorkShiftSeries(payload: CreateWorkShiftSeriesPayload): Promise<CreateWorkShiftSeriesResult>;
  /** Edita um turno pertencente (ou não) a uma série, com âmbito explícito. */
  updateWorkShiftSeriesScope(id: string, payload: UpdateWorkShiftSeriesScopePayload): Promise<WorkShift[]>;
  /** "Limpar turnos" — âmbito explícito, nunca um "limpar tudo" implícito. */
  clearWorkShifts(scope: ClearShiftsScope): Promise<ClearWorkShiftsResult>;
  previewClearWorkShifts(scope: ClearShiftsScope): Promise<ClearWorkShiftsPreview>;

  /** "Repetir escala pelo calendário" — copia os turnos reais de uma semana já montada para as semanas seguintes. Preview usa exatamente o mesmo cálculo da criação. */
  previewRepeatCalendarWeek(payload: PreviewRepeatCalendarWeekPayload): Promise<PreviewRepeatCalendarWeekResult>;
  repeatCalendarWeek(payload: RepeatCalendarWeekPayload): Promise<RepeatCalendarWeekResult>;

  /** Rota legacy `GET /api/hr/leave/overview` diretamente — não importa `src/pages/hr/hrApi.ts` (mesmo padrão de `confirmShiftAttendance`). */
  listLeaveOverview(year: number): Promise<LeaveOverviewEntry[]>;
  /** Rota legacy `GET /api/hr/leave/holidays` diretamente. */
  listPublicHolidays(year: number): Promise<PublicHoliday[]>;

  // ── Fase 2: Assiduidade, Correções e Fecho Mensal ────────────────────────
  listAttendanceIssues(year: number, month: number, locationId?: string): Promise<ListAttendanceIssuesResult>;
  getAttendanceIssueDetail(workDate: string, key: { shiftId?: string; attendanceId?: string }): Promise<AttendanceIssueDetail | null>;
  correctShiftAttendance(payload: CorrectShiftAttendancePayload): Promise<AttendanceIssueDetail | null>;
  getMonthlyClosureStatus(year: number, month: number): Promise<MonthlyClosureStatus>;
  closeMonthlyPeriod(year: number, month: number): Promise<MonthlyClosureStatus>;
  reopenMonthlyPeriod(year: number, month: number, reason: string): Promise<MonthlyClosureStatus>;

  // ── Fase 2.1: Regras de Assiduidade, Tolerâncias e Conferência ───────────
  /** Implementado no backend; `hr_attendance_rules`/a troca de tipos de correção ainda dependem de 2 migrações pendentes de aplicação manual — ver README. */
  getAttendanceRules(): Promise<AttendanceRulesConfig>;
  updateAttendanceRules(payload: UpdateAttendanceRulesPayload): Promise<AttendanceRulesConfig>;
  listAttendanceRuleChanges(): Promise<AttendanceRuleChangeEntry[]>;
  getMonthlyAttendanceSummary(year: number, month: number, locationId?: string): Promise<MonthlyAttendanceSummaryResult>;
  /** Ficha individual ("Assiduidade — Nome") — `null` se o colaborador não existir. */
  getEmployeeAttendanceDetail(employeeId: string, year: number, month: number): Promise<AttendanceEmployeeDetailResult | null>;
}
