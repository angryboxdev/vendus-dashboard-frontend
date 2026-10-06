export type BlockResult<T> = { status: "ok"; data: T } | { status: "unavailable"; reason: string };

export interface OverviewTeamKpis {
  activeEmployees: number;
  admissionsThisMonth: number;
  incompleteProfiles: number;
  documentsExpiringSoon: number;
  /** Nº de requisitos documentais obrigatórios em falta (soma por colaborador, não nº de colaboradores). */
  missingDocumentsCount: number;
}

export interface OverviewTodayKpis {
  scheduledCount: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
}

export interface OverviewPendingKpis {
  shiftsToReviewCount: number;
  unpaidPaymentsCount: number;
}

export type AlertSeverity = "CRITICA" | "ALTA" | "MEDIA" | "BAIXA";

export interface OverviewAlert {
  alertType: string;
  entityId: string;
  severity: AlertSeverity;
  occurredAt: string;
  employeeId: string;
  employeeName: string;
  message: string;
}

export interface OverviewOperationRow {
  employeeId: string;
  employeeName: string;
  /** AGENDADO|EM_TOLERANCIA|PRESENTE|ATRASADO|AUSENTE|INTERVALO|FINALIZADO|FERIAS|BAIXA|FOLGA|CONFLITO */
  state: string;
  /** Texto contextual — nunca repete o que `state` já diz. */
  situation: string;
  /** Linha secundária de alerta (ex: "1º turno sem entrada") — continua visível mesmo depois de `state`/`situation` já não a refletirem. Null = sem inconsistência a sinalizar. */
  situationWarning: string | null;
  /** 1 ou 2 partes por turno do dia (repartido inclui as 2; mais de 1 turno no dia soma todas). Null quando não há turno hoje. */
  shiftToday: string[] | null;
  locationId: string | null;
  locationName: string | null;
  /** Turno "por conferir" associado — permite abrir a conferência diretamente. Null quando não aplicável. */
  reviewShiftId: string | null;
}

export interface HrOverview {
  generatedAt: string;
  scope: { organizationId: string; locationId: string | null };
  team: BlockResult<OverviewTeamKpis>;
  today: BlockResult<OverviewTodayKpis>;
  pending: BlockResult<OverviewPendingKpis>;
  alerts: BlockResult<OverviewAlert[]>;
  operation: BlockResult<OverviewOperationRow[]>;
}

export type ReviewPriority = "CRITICA" | "ALTA" | "MEDIA" | "BAIXA";

export interface ShiftToReview {
  shiftId: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  plannedStartTime: string;
  plannedEndTime: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  exceptionLabel: string;
  priority: ReviewPriority;
  locationId: string;
  locationName: string | null;
}

export interface ListShiftsToReviewParams {
  locationId?: string;
  priority?: ReviewPriority;
  search?: string;
  page: number;
  pageSize: number;
}

export interface ListShiftsToReviewResult {
  items: ShiftToReview[];
  total: number;
  page: number;
  pageSize: number;
  countsByPriority: Record<ReviewPriority, number>;
}

export type ShiftAttendanceStatus = "worked_as_planned" | "late" | "left_early" | "cancelled";

export interface ConfirmShiftAttendancePayload {
  status: ShiftAttendanceStatus;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  lateMinutes?: number | null;
  notes?: string | null;
  locationId: string;
}
