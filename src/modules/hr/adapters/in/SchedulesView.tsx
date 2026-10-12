import { useCallback, useMemo, useState } from "react";
import { UndoToast, type UndoToastState } from "./UndoToast.tsx";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import { PageFooter } from "../../../../components/PageFooter.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { ShiftDrawer } from "./ShiftDrawer.tsx";
import { BaseScheduleModal } from "./BaseScheduleModal.tsx";
import { ShiftRotationsPanel } from "./ShiftRotationsPanel.tsx";
import { ShiftTemplatesPanel } from "./ShiftTemplatesPanel.tsx";
import { ShiftAutomationsPanel } from "./ShiftAutomationsPanel.tsx";
import { useManageShiftAutomations } from "./use-shift-automations.ts";
import { useShiftTemplates } from "./use-shift-templates.ts";
import { usePositions } from "./use-positions.ts";
import { ApplyTemplateModal } from "./ApplyTemplateModal.tsx";
import { OCCURRENCE_STATUS_LABELS } from "../../domain/entities/shift-template.ts";
import { ClearShiftsModal } from "./ClearShiftsModal.tsx";
import { PublishReviewModal } from "./PublishReviewModal.tsx";
import { draftSummary } from "../../domain/services/publish-review.service.ts";
import { RepeatScheduleWeekModal } from "./RepeatScheduleWeekModal.tsx";
import { DaySummaryPanel } from "./DaySummaryPanel.tsx";
import { exportGeneralSchedulePdf } from "../../../../utils/schedulePdf.ts";
import type { HrEmployee, HrLeaveRequest, HrWorkShift } from "../../../../pages/hr/hr.types.ts";
import type { EmployeeListRow } from "../../domain/entities/employee.ts";
import type { CreateWorkShiftPayload, LeaveOverviewEntry, UpdateWorkShiftPayload, UpdateWorkShiftSeriesScopePayload, WorkShift } from "../../domain/entities/schedule.ts";
import { boardRows, shiftVisualType, SHIFT_TYPE_LABELS, templateVisualType, weekRangeLabel } from "../../domain/services/schedule-board.service.ts";
import { Button, IconCalendar, IconChevronLeft, IconClose, IconCopy, IconLayers, IconPlus, IconRepeat, IconStore, IconTrash, IconUserPlus, IconUsers, PageHeader, SearchableSelect } from "../../../../components/ui/index.ts";
import { ScheduleToolbar, type ViewMode, type VisualMode } from "./schedules/ScheduleToolbar.tsx";
import { WeekBoard, type BoardMode } from "./schedules/WeekBoard.tsx";
import { MonthBoard } from "./schedules/MonthBoard.tsx";
import { AssignShiftsPanel } from "./schedules/AssignShiftsPanel.tsx";

type Tab = "calendar" | "templates";

const VISUAL_MODE_STORAGE_PREFIX = "hr-schedules-visual-mode-";
const VIEW_MODE_STORAGE_KEY = "hr-schedules-view-mode";

/** Preferência de visualização (Detalhada/Compacta) guardada separadamente por Mês/Semana. */
function loadVisualMode(viewMode: ViewMode): VisualMode {
  try {
    return localStorage.getItem(`${VISUAL_MODE_STORAGE_PREFIX}${viewMode}`) === "compact" ? "compact" : "detailed";
  } catch {
    return "detailed";
  }
}

function saveVisualMode(viewMode: ViewMode, visualMode: VisualMode): void {
  try {
    localStorage.setItem(`${VISUAL_MODE_STORAGE_PREFIX}${viewMode}`, visualMode);
  } catch {
    // localStorage indisponível (ex: modo privado) — a preferência simplesmente não persiste, sem quebrar a página.
  }
}

/** Vista Semana (por omissão, como no Design System) ou Mês — a última escolha fica guardada. */
function loadViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_MODE_STORAGE_KEY) === "month" ? "month" : "week";
  } catch {
    return "week";
  }
}

function saveViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // sem persistência — não faz mal.
  }
}

const BOARD_MODE_STORAGE_KEY = "hr-schedules-board-mode";

/** Agrupamento da grelha (Funcionários, Turnos, Cargos) — lembrado entre visitas. */
function loadBoardMode(): BoardMode {
  try {
    const v = localStorage.getItem(BOARD_MODE_STORAGE_KEY);
    return v === "shifts" || v === "positions" ? v : "employees";
  } catch {
    return "employees";
  }
}

function saveBoardMode(mode: BoardMode): void {
  try {
    localStorage.setItem(BOARD_MODE_STORAGE_KEY, mode);
  } catch {
    // sem persistência — não faz mal.
  }
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Primeiro + segundo nome (ex: "Carlos Andrés Silva Pereira" → "Carlos Andrés"). */
function shortName(fullName: string): string {
  return fullName.split(" ").slice(0, 2).join(" ");
}

// ── Adaptação mínima para reutilizar o export PDF legacy (src/utils/schedulePdf.ts)
// sem importar hrApi.ts/serviços legacy — só os 3 campos que a função lê são
// preenchidos com significado real; o resto é placeholder inofensivo.
function toLegacyEmployee(e: EmployeeListRow): HrEmployee {
  return {
    id: e.id,
    fullName: e.fullName,
    email: e.email,
    phone: e.phone,
    roleOrNotes: null,
    status: e.status,
    hiredAt: null,
    endedAt: null,
    createdAt: e.updatedAt,
    updatedAt: e.updatedAt,
  };
}

function toLegacyShift(s: WorkShift): HrWorkShift {
  return {
    id: s.id,
    employeeId: s.employeeId,
    workDate: s.workDate,
    startTime: s.startTime,
    endTime: s.endTime,
    locationOrStation: null,
    locationId: s.locationId,
    notes: s.notes,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    attendance: s.attendanceStatus
      ? {
          id: "",
          workShiftId: s.id,
          status: s.attendanceStatus,
          actualStartTime: null,
          actualEndTime: null,
          lateMinutes: null,
          notes: null,
          locationId: s.locationId,
          registrationSource: "dashboard",
          registeredByEmployeeId: null,
          registeredAt: s.updatedAt,
          updatedAt: s.updatedAt,
        }
      : null,
  };
}

function toLegacyLeave(l: LeaveOverviewEntry): HrLeaveRequest {
  return {
    id: l.id,
    employeeId: l.employeeId,
    type: l.type,
    startDate: l.startDate,
    endDate: l.endDate,
    workingDays: 0,
    notes: null,
    createdAt: l.startDate,
    updatedAt: l.startDate,
  };
}

function startOfMonthGrid(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const isoWeekday = (first.getDay() + 6) % 7; // 0=Mon
  const start = new Date(first);
  start.setDate(start.getDate() - isoWeekday);
  return start;
}

function mondayOf(d: Date): Date {
  const copy = new Date(d);
  const isoWeekday = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - isoWeekday);
  return copy;
}

/**
 * Escalas & Turnos (Design System Mezza): cabeçalho, local, barra única,
 * grelha semanal por colaborador (ou mês) e o painel "Atribuir turnos".
 * Mesmas funções de antes — só muda a apresentação.
 */
export function SchedulesView() {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const { locations, hasMultipleLocations } = useLocations();
  // Suporta abrir já filtrado por colaborador/data a partir de outro ecrã (ex: clicar num nome em "Hoje na operação", Visão Geral).
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState<Tab>("calendar");
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [visualMode, setVisualMode] = useState<VisualMode>(() => loadVisualMode(loadViewMode()));
  const [boardMode, setBoardMode] = useState<BoardMode>(loadBoardMode);
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [assignOpen, setAssignOpen] = useState(() => typeof window === "undefined" || !window.matchMedia || window.matchMedia("(min-width: 1280px)").matches);
  const [applyTemplate, setApplyTemplate] = useState<{ templateId: string | null } | null>(null);
  const [selectedSummaryDate, setSelectedSummaryDate] = useState<string | null>(null);
  const [anchorDate, setAnchorDate] = useState(() => {
    const dateParam = searchParams.get("date");
    return dateParam ? new Date(`${dateParam}T00:00:00`) : new Date();
  });
  const [employeeFilter, setEmployeeFilter] = useState<string>(() => searchParams.get("employeeId") ?? "");
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<WorkShift | null>(null);
  const [newShiftDate, setNewShiftDate] = useState<string | null>(null);
  const [newShiftEmployee, setNewShiftEmployee] = useState<string | null>(null);
  const [showBaseSchedule, setShowBaseSchedule] = useState(false);
  const [showClearShifts, setShowClearShifts] = useState(false);
  /** "Rever e publicar": revisão dos rascunhos antes de publicar (nunca publica direto). null = fechado. */
  const [review, setReview] = useState<{ from: string; to: string } | null>(null);
  const [publishedCount, setPublishedCount] = useState<number | null>(null);
  /** Aviso logo a seguir a criar turnos em rascunho (ainda não visíveis para os colaboradores). */
  const [draftNotice, setDraftNotice] = useState<{ count: number; range: { from: string; to: string } } | null>(null);
  function noticeDrafts(created: Pick<WorkShift, "status" | "workDate">[]) {
    const summary = draftSummary(created);
    if (summary) {
      setPublishedCount(null);
      setDraftNotice(summary);
    }
  }
  function openReview(range: { from: string; to: string }) {
    setPublishedCount(null);
    setReview(range);
  }
  const [repeatModalWeeks, setRepeatModalWeeks] = useState<number | null>(null);
  const [repeatModalRotate, setRepeatModalRotate] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rangeStart = useMemo(() => (viewMode === "month" ? startOfMonthGrid(anchorDate.getFullYear(), anchorDate.getMonth()) : mondayOf(anchorDate)), [anchorDate, viewMode]);
  const gridDays = viewMode === "month" ? 42 : 7;
  const days = useMemo(() => Array.from({ length: gridDays }, (_, i) => new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() + i)), [rangeStart, gridDays]);
  const from = toYmd(days[0]!);
  const to = toYmd(days[days.length - 1]!);
  const todayYmd = toYmd(new Date());

  const { data: employeesResult } = useQuery({
    queryKey: ["hr-people-list", { status: "active", page: 1, pageSize: 200 }],
    queryFn: () => api.listEmployees({ status: "active", page: 1, pageSize: 200 }),
  });
  const employees = useMemo(() => employeesResult?.items ?? [], [employeesResult]);
  const { data: positions = [] } = usePositions();
  const positionNameById = useMemo(() => new Map(positions.map((p) => [p.id, p.name])), [positions]);
  const { data: templates = [], isLoading: templatesLoading } = useShiftTemplates();
  const templateById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["hr-work-shifts", from, to, employeeFilter, locationFilter],
    queryFn: () =>
      api.listWorkShifts({
        from,
        to,
        ...(employeeFilter && { employeeId: employeeFilter }),
        ...(locationFilter && { locationId: locationFilter }),
      }),
  });

  // Sem filtro de colaborador/loja — "Repetir escala"/"Copiar semana" precisam de ver TODOS os colaboradores da semana visível, mesmo que o calendário esteja filtrado a 1 só.
  const { data: weekShiftsForActions = [] } = useQuery({
    queryKey: ["hr-work-shifts-week-actions", from, to],
    queryFn: () => api.listWorkShifts({ from, to }),
    enabled: viewMode === "week" && tab === "calendar",
  });
  const weekEmployeesForActions = useMemo(() => {
    const ids = new Set(weekShiftsForActions.map((s) => s.employeeId));
    return employees.filter((e) => ids.has(e.id)).map((e) => ({ id: e.id, fullName: e.fullName }));
  }, [weekShiftsForActions, employees]);

  const { data: leaves = [] } = useQuery({
    queryKey: ["hr-leave-overview", rangeStart.getFullYear()],
    queryFn: () => api.listLeaveOverview(rangeStart.getFullYear()),
  });
  const { data: holidays = [] } = useQuery({
    queryKey: ["hr-public-holidays", rangeStart.getFullYear()],
    queryFn: () => api.listPublicHolidays(rangeStart.getFullYear()),
  });

  const { data: alerts } = useQuery({
    queryKey: ["hr-schedule-alerts", from, to, locationFilter],
    queryFn: () => api.getScheduleAlerts(from, to, locationFilter || undefined),
  });
  const otherAlertsCount = alerts ? alerts.coverageGaps.length + alerts.overlaps.length + (alerts.automationIssues ?? []).length : 0;

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["hr-work-shifts"] });
    void qc.invalidateQueries({ queryKey: ["hr-work-shifts-week-actions"] });
    void qc.invalidateQueries({ queryKey: ["hr-schedule-alerts"] });
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateWorkShiftPayload) => api.createWorkShift(payload),
    onSuccess: (created) => {
      noticeDrafts(created);
      invalidate();
      setDrawerOpen(false);
      setFormError(null);
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Erro ao criar turno"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateWorkShiftPayload }) => api.updateWorkShift(id, payload),
    onSuccess: () => {
      invalidate();
      setDrawerOpen(false);
      setFormError(null);
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Erro ao editar turno"),
  });
  const duplicateMutation = useMutation({
    mutationFn: ({ id, targetDate }: { id: string; targetDate: string }) => api.duplicateWorkShift(id, targetDate),
    onSuccess: (duplicated) => {
      noticeDrafts([duplicated]);
      invalidate();
      setDrawerOpen(false);
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Erro ao duplicar turno"),
  });
  const [undoToast, setUndoToast] = useState<UndoToastState | null>(null);
  const closeUndoToast = useCallback(() => setUndoToast(null), []);
  /** Último "desfazer" disponível (fica para o botão da barra mesmo depois de o aviso fechar). */
  const [lastUndoToken, setLastUndoToken] = useState<string | null>(null);
  const offerUndo = (count: number, undoToken: string | null) => {
    if (undoToken && count > 0) {
      setUndoToast({ message: `${count} turno(s) apagado(s).`, undoToken });
      setLastUndoToken(undoToken);
    }
  };
  const undoMutation = useMutation({
    mutationFn: (token: string) => api.undoDeleteWorkShifts(token),
    onSuccess: ({ restoredCount }) => {
      invalidate();
      setLastUndoToken(null);
      setUndoToast({ message: `${restoredCount} turno(s) reposto(s).`, undoToken: null });
    },
    onError: (e: unknown) => {
      setLastUndoToken(null);
      setUndoToast({ message: e instanceof Error ? e.message : "Não foi possível desfazer.", undoToken: null });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteWorkShift(id),
    onSuccess: ({ undoToken }) => {
      invalidate();
      setDrawerOpen(false);
      offerUndo(1, undoToken);
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Erro ao apagar turno"),
  });
  const { dismissMutation } = useManageShiftAutomations();
  const updateSeriesScopeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateWorkShiftSeriesScopePayload }) => api.updateWorkShiftSeriesScope(id, payload),
    onSuccess: () => {
      invalidate();
      setDrawerOpen(false);
      setFormError(null);
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Erro ao editar a série"),
  });
  const clearSeriesMutation = useMutation({
    mutationFn: (seriesId: string) => api.clearWorkShifts({ kind: "series", seriesId }),
    onSuccess: (result) => {
      invalidate();
      setDrawerOpen(false);
      offerUndo(result.deletedCount, result.undoToken);
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Erro ao limpar a série"),
  });

  function handleSeriesCreated() {
    invalidate();
    setDrawerOpen(false);
    setFormError(null);
  }

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, WorkShift[]>();
    for (const s of shifts) map.set(s.workDate, [...(map.get(s.workDate) ?? []), s]);
    return map;
  }, [shifts]);

  const leavesByDate = useMemo(() => {
    const map = new Map<string, LeaveOverviewEntry[]>();
    for (const l of leaves) {
      let d = new Date(l.startDate + "T00:00:00");
      const end = new Date(l.endDate + "T00:00:00");
      while (d <= end) {
        const key = toYmd(d);
        map.set(key, [...(map.get(key) ?? []), l]);
        d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      }
    }
    return map;
  }, [leaves]);

  const holidaysByDate = useMemo(() => new Map(holidays.map((h) => [h.date.slice(0, 10), h])), [holidays]);

  // Só para a visualização Compacta / Resumo do dia — nunca recalcula regras de negócio, só agrega o que "Alertas e ações" já traz.
  const conflictsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of alerts?.overlaps ?? []) map.set(o.workDate, (map.get(o.workDate) ?? 0) + 1);
    return map;
  }, [alerts]);
  const locationNameById = useMemo(() => new Map(locations.map((l) => [l.id, l.name])), [locations]);

  /** Rótulo do cartão: nome do modelo quando o turno veio de um; senão o tipo (Manhã, Tarde, Noturno, Partido). */
  const shiftLabel = useCallback(
    (s: WorkShift) => {
      const t = s.templateId ? templateById.get(s.templateId) : undefined;
      if (t) return { title: t.name, tone: templateVisualType(t) };
      const tone = shiftVisualType(s);
      return { title: SHIFT_TYPE_LABELS[tone], tone };
    },
    [templateById],
  );

  const board = useMemo(
    () =>
      boardRows(
        employees.filter((e) => !employeeFilter || e.id === employeeFilter),
        shifts,
        { search, showUnassigned, sort, locationId: locationFilter },
      ),
    [employees, employeeFilter, shifts, search, showUnassigned, sort, locationFilter],
  );

  function switchViewMode(mode: ViewMode) {
    setViewMode(mode);
    saveViewMode(mode);
    setVisualMode(loadVisualMode(mode));
    setSelectedSummaryDate(null);
  }

  function goToday() {
    setAnchorDate(new Date());
  }
  function goPrev() {
    setAnchorDate((d) => {
      const next = new Date(d);
      if (viewMode === "month") next.setMonth(next.getMonth() - 1);
      else next.setDate(next.getDate() - 7);
      return next;
    });
  }
  function goNext() {
    setAnchorDate((d) => {
      const next = new Date(d);
      if (viewMode === "month") next.setMonth(next.getMonth() + 1);
      else next.setDate(next.getDate() + 7);
      return next;
    });
  }

  function handleExportPdf() {
    void exportGeneralSchedulePdf({
      year: anchorDate.getFullYear(),
      month: anchorDate.getMonth() + 1,
      shifts: shifts.map(toLegacyShift),
      leaves: leaves.map(toLegacyLeave),
      employees: employees.map(toLegacyEmployee),
    });
  }

  function openNewShift(dateYmd?: string, employeeId: string | null = null) {
    setEditingShift(null);
    setNewShiftDate(dateYmd ?? todayYmd);
    setNewShiftEmployee(employeeId);
    setFormError(null);
    setDrawerOpen(true);
  }
  function openEditShift(shift: WorkShift) {
    setEditingShift(shift);
    setNewShiftDate(null);
    setFormError(null);
    setDrawerOpen(true);
  }

  const periodLabel = viewMode === "month" ? anchorDate.toLocaleDateString("pt-PT", { month: "long", year: "numeric" }) : weekRangeLabel(days[0]!, days[6]!);
  const weekOnlyHint = "Disponível na vista Semana";
  const needEmployeeHint = "Escolha um colaborador nos filtros";

  const alertsContent =
    alerts && otherAlertsCount > 0 ? (
      <div className="max-h-96 space-y-2 overflow-y-auto p-1.5">
        <p className="px-1 text-xs font-medium text-ink-secondary">
          {[
            alerts.coverageGaps.length > 0 && `${alerts.coverageGaps.length} sem cobertura`,
            alerts.overlaps.length > 0 && `${alerts.overlaps.length} ${alerts.overlaps.length === 1 ? "sobreposição" : "sobreposições"}`,
            (alerts.automationIssues ?? []).length > 0 && `${(alerts.automationIssues ?? []).length} das automatizações`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {alerts.coverageGaps.map((g, i) => (
          <div key={`gap-${i}`} className="rounded-xl border border-red-100 bg-red-50/50 p-2.5 text-xs">
            <p className="font-semibold text-red-700">Falta cobertura</p>
            <p className="text-ink">
              {g.employeeName} · {g.workDate}
            </p>
            <button onClick={() => openNewShift(g.workDate)} className="mt-1 font-medium text-brand-600 hover:underline">
              Atribuir turno →
            </button>
          </div>
        ))}
        {alerts.overlaps.map((o, i) => (
          <div key={`overlap-${i}`} className="rounded-xl border border-amber-100 bg-amber-50/50 p-2.5 text-xs">
            <p className="font-semibold text-amber-800">Conflito de sobreposição</p>
            <p className="text-ink">
              {o.employeeName} · {o.workDate}
            </p>
          </div>
        ))}
        {(alerts.automationIssues ?? []).map((issue) => (
          <div key={issue.id} className="rounded-xl border border-line bg-surface-soft/60 p-2.5 text-xs">
            <p className="font-semibold text-navy-900">Automatização não criou o turno</p>
            <p className="text-ink">
              {issue.employeeName} · {issue.workDate}
            </p>
            <p className="text-ink-secondary">
              {issue.automationName} — {issue.status === "inactive_template" ? "Modelo inativo" : OCCURRENCE_STATUS_LABELS[issue.status].label}
            </p>
            <div className="mt-1 flex gap-3">
              <button onClick={() => openNewShift(issue.workDate)} className="font-medium text-brand-600 hover:underline">
                Resolver na escala →
              </button>
              <button onClick={() => dismissMutation.mutate(issue.id)} disabled={dismissMutation.isPending} className="text-ink-secondary hover:underline disabled:opacity-50">
                Dispensar
              </button>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="px-3 py-4 text-sm text-ink-secondary">Sem alertas nesta {viewMode === "week" ? "semana" : "vista"}.</p>
    );

  const pending = alerts?.pendingPublishCount ?? 0;
  const summary = (
    <>
      <span className="flex items-center gap-2">
        <IconUsers size={16} className="text-brand-600" />
        {viewMode === "week" ? (
          <>
            <span>{board.assigned} pessoas atribuídas</span>
            <span aria-hidden="true">•</span>
            <button type="button" onClick={() => setShowUnassigned((v) => !v)} className="hover:text-navy-900 hover:underline" aria-pressed={showUnassigned}>
              {board.hidden} {showUnassigned ? "sem turnos (visíveis)" : "ocultos"}
            </button>
          </>
        ) : (
          <span>{new Set(shifts.map((s) => s.employeeId)).size} pessoas com turnos neste mês</span>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-3">
        {draftNotice && (
          <span role="status" className="flex items-center gap-2 text-sm text-navy-900 motion-safe:animate-motion-fade">
            {draftNotice.count} turno(s) criado(s) em rascunho
            <button type="button" onClick={() => openReview(draftNotice.range)} className="font-medium text-brand-600 hover:underline">
              Rever e publicar
            </button>
            <button type="button" onClick={() => setDraftNotice(null)} aria-label="Fechar aviso" className="text-ink-muted hover:text-navy-900">
              <IconClose size={14} />
            </button>
          </span>
        )}
        {publishedCount !== null && (
          <span role="status" className="text-sm text-emerald-700 motion-safe:animate-motion-fade">
            {publishedCount} turno(s) publicado(s) — já visíveis para os colaboradores.
          </span>
        )}
        {pending > 0 && alerts?.pendingPublishRange ? (
          <button
            type="button"
            onClick={() => openReview(alerts.pendingPublishRange!)}
            aria-label={`${pending} turnos em rascunho — rever e publicar`}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {pending} {pending === 1 ? "turno por publicar" : "turnos por publicar"}
          </button>
        ) : shifts.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Planeamento publicado
          </span>
        ) : null}
      </span>
    </>
  );

  if (tab === "templates") {
    return (
      <div className="min-h-screen bg-surface-app">
        <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-8">
          <PageHeader breadcrumb={["RH", "Escalas", "Modelos & Automatizações"]} title="Modelos & Automatizações" description="Modelos de turno reutilizáveis e automatizações da escala." />
          <Button icon={<IconChevronLeft size={16} />} onClick={() => setTab("calendar")}>
            Voltar à escala
          </Button>
          <div className="space-y-4 motion-safe:animate-motion-fade-up">
            {/* RH 2.0: Modelos de turno (ticket 01); as rotações passam a automatizações no ticket 04. */}
            <ShiftTemplatesPanel onReviewDrafts={(range) => openReview(range)} />
            <ShiftAutomationsPanel />
            <ShiftRotationsPanel />
          </div>
        </div>
        {review && (
          <PublishReviewModal
            range={review}
            locationId={locationFilter || undefined}
            locationName={(id) => locationNameById.get(id) ?? "—"}
            onClose={() => setReview(null)}
            onPublished={(count) => {
              invalidate();
              setReview(null);
              setDraftNotice(null);
              setPublishedCount(count);
              setTab("calendar");
            }}
          />
        )}
        <PageFooter />
      </div>
    );
  }

  const locationOptions = locations.filter((l) => l.isActive !== false).map((l) => ({ id: l.id, label: l.name }));

  return (
    <div className="min-h-screen bg-surface-app">
      <div className="mx-auto max-w-[1920px] space-y-6 px-4 py-6 sm:pl-6 sm:pr-4">
          <PageHeader breadcrumb={["RH", "Escalas"]} title="Escalas & Turnos" description="Planeie e acompanhe os turnos da equipa." />

          <div className="motion-safe:animate-motion-fade-up [animation-delay:30ms]">
            <SearchableSelect
              label="Local"
              icon={<IconStore size={20} />}
              // Com um só local, mostra-o (o filtro fica vazio = esse local).
              value={hasMultipleLocations ? locationFilter : (locationOptions[0]?.id ?? "")}
              options={locationOptions}
              onChange={setLocationFilter}
              allLabel={hasMultipleLocations ? "Todas as lojas" : undefined}
              disabled={!hasMultipleLocations}
              triggerClassName="h-12 min-w-[246px]"
            />
          </div>

          <ScheduleToolbar
            mode={boardMode}
            onMode={(m) => {
              setBoardMode(m);
              saveBoardMode(m);
            }}
            viewMode={viewMode}
            onViewMode={switchViewMode}
            visualMode={visualMode}
            onVisualMode={(mode) => {
              setVisualMode(mode);
              saveVisualMode(viewMode, mode);
              if (mode === "detailed") setSelectedSummaryDate(null);
            }}
            periodLabel={periodLabel}
            onToday={goToday}
            onPrev={goPrev}
            onNext={goNext}
            search={search}
            onSearch={setSearch}
            employees={employees.map((e) => ({ id: e.id, label: e.fullName }))}
            employeeFilter={employeeFilter}
            onEmployeeFilter={setEmployeeFilter}
            canUndo={lastUndoToken !== null}
            undoing={undoMutation.isPending}
            onUndo={() => lastUndoToken && undoMutation.mutate(lastUndoToken)}
            onApplyTemplate={() => setApplyTemplate({ templateId: null })}
            onExportPdf={handleExportPdf}
            weekActions={[
              {
                label: "Repetir escala",
                icon: <IconRepeat size={16} />,
                disabled: viewMode !== "week",
                hint: weekOnlyHint,
                onSelect: () => {
                  setRepeatModalRotate(false);
                  setRepeatModalWeeks(4);
                },
              },
              {
                label: "Copiar semana (alternar turnos)",
                icon: <IconCopy size={16} />,
                disabled: viewMode !== "week",
                hint: weekOnlyHint,
                onSelect: () => {
                  setRepeatModalRotate(true);
                  setRepeatModalWeeks(1);
                },
              },
              { label: "Limpar semana", icon: <IconTrash size={16} />, danger: true, onSelect: () => setShowClearShifts(true) },
            ]}
            showUnassigned={showUnassigned}
            onToggleUnassigned={() => setShowUnassigned((v) => !v)}
            alertsCount={otherAlertsCount}
            alerts={alertsContent}
            addItems={[
              { label: "Novo turno", icon: <IconPlus size={16} />, onSelect: () => openNewShift(undefined, employeeFilter || null) },
              { label: "Atribuir turnos", icon: <IconLayers size={16} />, onSelect: () => setAssignOpen(true) },
              { label: "Aplicar modelo a vários colaboradores", icon: <IconUserPlus size={16} />, onSelect: () => setApplyTemplate({ templateId: null }) },
              "separator",
              { label: "Escala base", icon: <IconCalendar size={16} />, disabled: !employeeFilter, hint: needEmployeeHint, onSelect: () => setShowBaseSchedule(true) },
              { label: "Limpar turnos", icon: <IconTrash size={16} />, disabled: !employeeFilter, hint: needEmployeeHint, danger: true, onSelect: () => setShowClearShifts(true) },
              "separator",
              { label: "Modelos & Automatizações", icon: <IconLayers size={16} />, onSelect: () => setTab("templates") },
            ]}
            onPublish={() => openReview({ from, to })}
          />

        <div className="flex items-start">
          <div className={`grid min-w-0 flex-1 grid-cols-1 gap-4 ${viewMode === "month" && visualMode === "compact" && selectedSummaryDate ? "xl:grid-cols-[1fr_320px]" : ""}`}>
            {viewMode === "week" ? (
              <WeekBoard
                mode={boardMode}
                days={days}
                todayYmd={todayYmd}
                rows={board.rows}
                shifts={shifts}
                loading={isLoading}
                sort={sort}
                onToggleSort={() => setSort((s) => (s === "asc" ? "desc" : "asc"))}
                positionName={(id) => (id ? (positionNameById.get(id) ?? null) : null)}
                shiftLabel={shiftLabel}
                leavesByDate={leavesByDate}
                holidaysByDate={holidaysByDate}
                onOpenShift={openEditShift}
                onNewShift={(employeeId, ymd) => openNewShift(ymd, employeeId)}
                summary={summary}
                toYmd={toYmd}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-ink-secondary">{summary}</div>
                <MonthBoard
                  days={days}
                  month={anchorDate.getMonth()}
                  todayYmd={todayYmd}
                  visualMode={visualMode}
                  loading={isLoading}
                  toYmd={toYmd}
                  shiftsByDate={shiftsByDate}
                  leavesByDate={leavesByDate}
                  holidaysByDate={holidaysByDate}
                  conflictsByDate={conflictsByDate}
                  employeeName={(id) => employees.find((e) => e.id === id)?.fullName ?? id}
                  shiftLabel={shiftLabel}
                  onOpenShift={openEditShift}
                  onNewShift={(ymd) => openNewShift(ymd, employeeFilter || null)}
                  onSelectDay={setSelectedSummaryDate}
                />
              </div>
            )}

            {viewMode === "month" && visualMode === "compact" && selectedSummaryDate && (
              <DaySummaryPanel
                date={selectedSummaryDate}
                dayShifts={shiftsByDate.get(selectedSummaryDate) ?? []}
                dayLeaves={leavesByDate.get(selectedSummaryDate) ?? []}
                conflictCount={conflictsByDate.get(selectedSummaryDate) ?? 0}
                employeeColorClass={() => "bg-surface-soft border-line"}
                locationName={(locationId) => locationNameById.get(locationId) ?? "—"}
                shortName={shortName}
                onClose={() => setSelectedSummaryDate(null)}
                onOpenShift={(shift) => openEditShift(shift)}
                onOpenDay={() => {
                  setAnchorDate(new Date(`${selectedSummaryDate}T00:00:00`));
                  switchViewMode("week");
                }}
                onEditSchedule={() => openNewShift(selectedSummaryDate)}
              />
            )}
          </div>

        {assignOpen && (
          <AssignShiftsPanel
            templates={templates}
            loading={templatesLoading}
            onPick={(templateId) => setApplyTemplate({ templateId })}
            onCreateCustom={() => openNewShift(undefined, employeeFilter || null)}
            onOpenSettings={() => setTab("templates")}
            onClose={() => setAssignOpen(false)}
          />
        )}
        </div>
      </div>

      <ShiftDrawer
        open={drawerOpen}
        editing={editingShift}
        defaultEmployeeId={newShiftEmployee ?? (employeeFilter || null)}
        defaultWorkDate={newShiftDate}
        onClose={() => setDrawerOpen(false)}
        onCreate={(payload) => createMutation.mutate(payload)}
        onUpdate={(id, payload) => updateMutation.mutate({ id, payload })}
        onUpdateSeriesScope={(id, payload) => updateSeriesScopeMutation.mutate({ id, payload })}
        onSeriesCreated={handleSeriesCreated}
        onClearSeries={(seriesId) => clearSeriesMutation.mutate(seriesId)}
        onDuplicate={(id, targetDate) => duplicateMutation.mutate({ id, targetDate })}
        onDelete={(id) => deleteMutation.mutate(id)}
        saving={createMutation.isPending || updateMutation.isPending || updateSeriesScopeMutation.isPending}
        error={formError}
      />

      {applyTemplate && (
        <ApplyTemplateModal
          templates={templates}
          initialTemplateId={applyTemplate.templateId}
          onClose={() => {
            setApplyTemplate(null);
            invalidate();
          }}
          onReviewDrafts={(range) => {
            setApplyTemplate(null);
            invalidate();
            openReview(range);
          }}
        />
      )}

      {showBaseSchedule && employeeFilter && (
        <BaseScheduleModal
          employeeId={employeeFilter}
          employeeName={employees.find((e) => e.id === employeeFilter)?.fullName ?? ""}
          weekStartDate={toYmd(mondayOf(anchorDate))}
          onClose={() => setShowBaseSchedule(false)}
          onApplied={invalidate}
        />
      )}

      {review && (
        <PublishReviewModal
          range={review}
          locationId={locationFilter || undefined}
          locationName={(id) => locationNameById.get(id) ?? "—"}
          onClose={() => setReview(null)}
          onPublished={(count) => {
            invalidate();
            setReview(null);
            setDraftNotice(null);
            setPublishedCount(count);
          }}
        />
      )}

      {showClearShifts && (
        <ClearShiftsModal
          employeeId={employeeFilter || null}
          employeeName={employees.find((e) => e.id === employeeFilter)?.fullName ?? ""}
          employees={employees}
          defaultWeekStartDate={toYmd(mondayOf(anchorDate))}
          locationId={locationFilter || undefined}
          onClose={() => setShowClearShifts(false)}
          onCleared={(result) => {
            invalidate();
            setShowClearShifts(false);
            offerUndo(result.deletedCount, result.undoToken);
          }}
        />
      )}

      {undoToast && <UndoToast state={undoToast} busy={undoMutation.isPending} onUndo={(t) => undoMutation.mutate(t)} onClose={closeUndoToast} />}

      {repeatModalWeeks !== null && (
        <RepeatScheduleWeekModal
          sourceWeekStartDate={toYmd(mondayOf(anchorDate))}
          sourceWeekLabel={periodLabel}
          sourceWeekEmployees={weekEmployeesForActions}
          defaultWeeks={repeatModalWeeks}
          defaultRotate={repeatModalRotate}
          onClose={() => setRepeatModalWeeks(null)}
          onCompleted={(result) => {
            noticeDrafts(result.employees.flatMap((e) => e.created));
            invalidate();
            setRepeatModalWeeks(null);
          }}
        />
      )}

      <PageFooter />
    </div>
  );
}
