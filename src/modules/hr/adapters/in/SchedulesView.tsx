import { useMemo, useState } from "react";
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
import { OCCURRENCE_STATUS_LABELS } from "../../domain/entities/shift-template.ts";
import { ClearShiftsModal } from "./ClearShiftsModal.tsx";
import { RepeatScheduleWeekModal } from "./RepeatScheduleWeekModal.tsx";
import { DaySummaryPanel } from "./DaySummaryPanel.tsx";
import { exportGeneralSchedulePdf } from "../../../../utils/schedulePdf.ts";
import { LEAVE_TYPE_CALENDAR_COLORS, type HrEmployee, type HrLeaveRequest, type HrWorkShift } from "../../../../pages/hr/hr.types.ts";
import type { EmployeeListRow } from "../../domain/entities/employee.ts";
import {
  LEAVE_TYPE_LABELS,
  type CreateWorkShiftPayload,
  type LeaveOverviewEntry,
  type UpdateWorkShiftPayload,
  type UpdateWorkShiftSeriesScopePayload,
  type WorkShift,
} from "../../domain/entities/schedule.ts";

type ViewMode = "month" | "week";
type Tab = "calendar" | "templates" | "alerts";
type VisualMode = "detailed" | "compact";

const VISUAL_MODE_STORAGE_PREFIX = "hr-schedules-visual-mode-";

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

const ATTENDANCE_DOT: Record<string, string> = {
  worked_as_planned: "bg-emerald-500",
  late: "bg-amber-500",
  left_early: "bg-amber-500",
  cancelled: "bg-stone-400",
};

const LEAVE_DOT: Record<string, string> = {
  vacation: "bg-sky-400",
  sick_leave: "bg-red-400",
  justified: "bg-violet-400",
  unjustified: "bg-red-600",
  compensatory: "bg-teal-400",
};

/** Mesma paleta pastel do calendário legacy (`src/pages/hr/HrCalendarPage.tsx`) — mantém a identificação visual por colaborador ao migrar para este módulo. */
const PALETTE = [
  { bg: "bg-indigo-100", border: "border-indigo-200", text: "text-indigo-900" },
  { bg: "bg-violet-100", border: "border-violet-200", text: "text-violet-900" },
  { bg: "bg-pink-100", border: "border-pink-200", text: "text-pink-900" },
  { bg: "bg-teal-100", border: "border-teal-200", text: "text-teal-900" },
  { bg: "bg-orange-100", border: "border-orange-200", text: "text-orange-900" },
  { bg: "bg-sky-100", border: "border-sky-200", text: "text-sky-900" },
  { bg: "bg-rose-100", border: "border-rose-200", text: "text-rose-900" },
  { bg: "bg-lime-100", border: "border-lime-200", text: "text-lime-900" },
] as const;
type PaletteEntry = (typeof PALETTE)[number];

/** Primeiro + segundo nome (ex: "Carlos Andrés Silva Pereira" → "Carlos Andrés") — cabe sempre no retângulo, ao contrário do nome completo. */
function shortName(fullName: string): string {
  return fullName.split(" ").slice(0, 2).join(" ");
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
}

/** Bolinha de estado: presença conferida (verde/âmbar) tem prioridade; sem conferência, laranja = pendente (mesmo com o turno publicado; é a mesma semântica "Pendente"/"Conferido" do calendário legacy). */
function shiftDotClass(shift: WorkShift): string {
  if (shift.attendanceStatus) return ATTENDANCE_DOT[shift.attendanceStatus] ?? "bg-stone-400";
  return "bg-amber-500";
}

export function SchedulesView() {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const { locations, hasMultipleLocations } = useLocations();
  // Suporta abrir já filtrado por colaborador/data a partir de outro ecrã (ex: clicar num nome em "Hoje na operação", Visão Geral).
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState<Tab>("calendar");
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [visualMode, setVisualMode] = useState<VisualMode>(() => loadVisualMode("month"));
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
  const [showBaseSchedule, setShowBaseSchedule] = useState(false);
  const [showClearShifts, setShowClearShifts] = useState(false);
  const [showWeekActionsMenu, setShowWeekActionsMenu] = useState(false);
  const [repeatModalWeeks, setRepeatModalWeeks] = useState<number | null>(null);
  const [repeatModalRotate, setRepeatModalRotate] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rangeStart = useMemo(
    () =>
      viewMode === "month"
        ? startOfMonthGrid(anchorDate.getFullYear(), anchorDate.getMonth())
        : mondayOf(anchorDate),
    [anchorDate, viewMode],
  );
  const gridDays = viewMode === "month" ? 42 : 7;
  const days = useMemo(
    () => Array.from({ length: gridDays }, (_, i) => new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate() + i)),
    [rangeStart, gridDays],
  );
  const from = toYmd(days[0]!);
  const to = toYmd(days[days.length - 1]!);

  const { data: employeesResult } = useQuery({
    queryKey: ["hr-people-list", { status: "active", page: 1, pageSize: 200 }],
    queryFn: () => api.listEmployees({ status: "active", page: 1, pageSize: 200 }),
  });
  const employees = useMemo(() => employeesResult?.items ?? [], [employeesResult]);

  const colorById = useMemo(() => {
    const map = new Map<string, PaletteEntry>();
    employees.forEach((e, i) => map.set(e.id, PALETTE[i % PALETTE.length]!));
    return map;
  }, [employees]);

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

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["hr-work-shifts"] });
    void qc.invalidateQueries({ queryKey: ["hr-work-shifts-week-actions"] });
    void qc.invalidateQueries({ queryKey: ["hr-schedule-alerts"] });
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateWorkShiftPayload) => api.createWorkShift(payload),
    onSuccess: () => {
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
    onSuccess: () => {
      invalidate();
      setDrawerOpen(false);
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Erro ao duplicar turno"),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteWorkShift(id),
    onSuccess: () => {
      invalidate();
      setDrawerOpen(false);
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Erro ao apagar turno"),
  });
  const { dismissMutation } = useManageShiftAutomations();
  const publishAllMutation = useMutation({
    mutationFn: (ids: string[]) => api.publishWorkShifts(ids),
    onSuccess: invalidate,
  });
  const updateSeriesScopeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateWorkShiftSeriesScopePayload }) =>
      api.updateWorkShiftSeriesScope(id, payload),
    onSuccess: () => {
      invalidate();
      setDrawerOpen(false);
      setFormError(null);
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : "Erro ao editar a série"),
  });
  const clearSeriesMutation = useMutation({
    mutationFn: (seriesId: string) => api.clearWorkShifts({ kind: "series", seriesId }),
    onSuccess: () => {
      invalidate();
      setDrawerOpen(false);
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
    for (const s of shifts) {
      const list = map.get(s.workDate) ?? [];
      list.push(s);
      map.set(s.workDate, list);
    }
    return map;
  }, [shifts]);

  const leavesByDate = useMemo(() => {
    const map = new Map<string, LeaveOverviewEntry[]>();
    for (const l of leaves) {
      let d = new Date(l.startDate + "T00:00:00");
      const end = new Date(l.endDate + "T00:00:00");
      while (d <= end) {
        const key = toYmd(d);
        const list = map.get(key) ?? [];
        list.push(l);
        map.set(key, list);
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

  function switchViewMode(mode: ViewMode) {
    setViewMode(mode);
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

  function openNewShift(dateYmd?: string) {
    setEditingShift(null);
    setNewShiftDate(dateYmd ?? toYmd(new Date()));
    setFormError(null);
    setDrawerOpen(true);
  }
  function openEditShift(shift: WorkShift) {
    setEditingShift(shift);
    setNewShiftDate(null);
    setFormError(null);
    setDrawerOpen(true);
  }

  const periodLabel =
    viewMode === "month"
      ? anchorDate.toLocaleDateString("pt-PT", { month: "long", year: "numeric" })
      : `Semana ${formatDayHeader(days[0]!)}–${formatDayHeader(days[6]!)}`;

  const pendingPublishIds = shifts.filter((s) => s.status === "draft").map((s) => s.id);

  return (
    <div className="min-h-screen bg-[#FAF6F3]">
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Escalas & Turnos</h1>
            <p className="mt-0.5 text-sm text-stone-500">Planeamento, edição e rotações de turnos</p>
          </div>
          <button
            onClick={() => openNewShift()}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            + Novo turno
          </button>
        </div>
        <div className="mt-3 flex border-b border-stone-100">
          {([
            { key: "calendar", label: "Calendário" },
            { key: "templates", label: "Modelos & Automatizações" },
            { key: "alerts", label: "Alertas e ações" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                tab === key ? "border-[#ED5C32] text-[#ED5C32]" : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "templates" ? (
        // RH 2.0: Modelos de turno (ticket 01); as rotações passam a automatizações no ticket 04.
        <div className="space-y-4 p-4">
          <ShiftTemplatesPanel />
          <ShiftAutomationsPanel />
          <ShiftRotationsPanel />
        </div>
      ) : tab === "alerts" ? (
        <div className="p-4">
          <div className="space-y-2 rounded-xl border border-[#F5C992]/40 bg-white p-3 shadow-sm">
            <h2 className="text-sm font-semibold text-stone-800">Alertas e ações</h2>
            {!alerts ||
            (alerts.coverageGaps.length === 0 &&
              alerts.overlaps.length === 0 &&
              alerts.pendingPublishCount === 0 &&
              (alerts.automationIssues ?? []).length === 0) ? (
              <p className="text-sm text-stone-400">Sem alertas no período visível.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {alerts.coverageGaps.map((g, i) => (
                  <div key={`gap-${i}`} className="rounded-lg border border-red-100 bg-red-50/40 p-2 text-xs">
                    <p className="font-semibold text-red-700">Falta cobertura</p>
                    <p className="text-stone-600">{g.employeeName}</p>
                    <p className="text-stone-400">{g.workDate}</p>
                    <button
                      onClick={() => {
                        setTab("calendar");
                        openNewShift(g.workDate);
                      }}
                      className="mt-1 font-medium text-[#ED5C32] hover:underline"
                    >
                      Atribuir turno →
                    </button>
                  </div>
                ))}
                {alerts.overlaps.map((o, i) => (
                  <div key={`overlap-${i}`} className="rounded-lg border border-amber-100 bg-amber-50/40 p-2 text-xs">
                    <p className="font-semibold text-amber-700">Conflito de sobreposição</p>
                    <p className="text-stone-600">{o.employeeName}</p>
                    <p className="text-stone-400">{o.workDate}</p>
                  </div>
                ))}
                {(alerts.automationIssues ?? []).map((issue) => (
                  <div key={issue.id} className="rounded-lg border border-violet-100 bg-violet-50/40 p-2 text-xs">
                    <p className="font-semibold text-violet-700">Automatização não criou o turno</p>
                    <p className="text-stone-600">
                      {issue.employeeName} · {issue.workDate}
                    </p>
                    <p className="text-stone-500">
                      {issue.automationName} — {issue.status === "inactive_template" ? "Modelo inativo" : OCCURRENCE_STATUS_LABELS[issue.status].label}
                    </p>
                    <div className="mt-1 flex gap-3">
                      <button
                        onClick={() => {
                          setTab("calendar");
                          openNewShift(issue.workDate);
                        }}
                        className="font-medium text-[#ED5C32] hover:underline"
                      >
                        Resolver na escala →
                      </button>
                      <button
                        onClick={() => dismissMutation.mutate(issue.id)}
                        disabled={dismissMutation.isPending}
                        className="text-stone-500 hover:underline disabled:opacity-50"
                      >
                        Dispensar
                      </button>
                    </div>
                  </div>
                ))}
                {alerts.pendingPublishCount > 0 && (
                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-2 text-xs">
                    <p className="font-semibold text-stone-700">Turnos por publicar</p>
                    <p className="text-stone-500">{alerts.pendingPublishCount} turno(s) restante(s)</p>
                    <button
                      onClick={() => publishAllMutation.mutate(pendingPublishIds)}
                      disabled={publishAllMutation.isPending}
                      className="mt-1 font-medium text-[#ED5C32] hover:underline disabled:opacity-50"
                    >
                      Rever e publicar →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div
            className={`grid grid-cols-1 gap-4 ${
              visualMode === "compact" && selectedSummaryDate ? "xl:grid-cols-[1fr_320px]" : ""
            }`}
          >
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <button onClick={goPrev} className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100">
                  ←
                </button>
                <button onClick={goToday} className="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50">
                  Hoje
                </button>
                <button onClick={goNext} className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100">
                  →
                </button>
              </div>
              <span className="text-sm font-semibold capitalize text-stone-700">{periodLabel}</span>
              <div className="ml-auto flex items-center gap-2">
                <div className="flex rounded-md border border-stone-200 bg-stone-50 p-0.5">
                  {(["month", "week"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => switchViewMode(mode)}
                      className={`rounded px-3 py-1 text-xs font-medium ${
                        viewMode === mode ? "bg-white text-stone-800 shadow-sm" : "text-stone-500"
                      }`}
                    >
                      {mode === "month" ? "Mês" : "Semana"}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-stone-500">
                  <span>Visualização:</span>
                  <div className="flex rounded-md border border-stone-200 bg-stone-50 p-0.5">
                    {(["detailed", "compact"] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => {
                          setVisualMode(mode);
                          saveVisualMode(viewMode, mode);
                          if (mode === "detailed") setSelectedSummaryDate(null);
                        }}
                        className={`rounded px-3 py-1 text-xs font-medium ${
                          visualMode === mode ? "bg-white text-stone-800 shadow-sm" : "text-stone-500"
                        }`}
                      >
                        {mode === "detailed" ? "Detalhada" : "Compacta"}
                      </button>
                    ))}
                  </div>
                </div>
                {hasMultipleLocations && (
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="">Todas as lojas</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                )}
                {employeeFilter && (
                  <button
                    onClick={() => setShowBaseSchedule(true)}
                    className="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50"
                  >
                    Escala base
                  </button>
                )}
                {employeeFilter && (
                  <button
                    onClick={() => setShowClearShifts(true)}
                    className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    Limpar turnos
                  </button>
                )}
                {viewMode === "week" && (
                  <div className="relative">
                    <button
                      onClick={() => setShowWeekActionsMenu((v) => !v)}
                      className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                    >
                      Ações da semana ▾
                    </button>
                    {showWeekActionsMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowWeekActionsMenu(false)} />
                        <div className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-stone-200 bg-white py-1 text-sm shadow-lg">
                          <button
                            onClick={() => {
                              setShowWeekActionsMenu(false);
                              setRepeatModalRotate(false);
                              setRepeatModalWeeks(4);
                            }}
                            className="block w-full px-3 py-1.5 text-left text-stone-700 hover:bg-stone-50"
                          >
                            Repetir escala
                          </button>
                          <button
                            onClick={() => {
                              setShowWeekActionsMenu(false);
                              setRepeatModalRotate(true);
                              setRepeatModalWeeks(1);
                            }}
                            className="block w-full px-3 py-1.5 text-left text-stone-700 hover:bg-stone-50"
                            title="Alterna o horário entre os colaboradores selecionados, em vez de duplicar às cegas"
                          >
                            Copiar semana (alternar turnos)
                          </button>
                          <button
                            onClick={() => {
                              setShowWeekActionsMenu(false);
                              setShowClearShifts(true);
                            }}
                            className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
                          >
                            Limpar semana
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <button
                  onClick={handleExportPdf}
                  className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  Exportar PDF
                </button>
              </div>
            </div>

            {/* Employee filter badges */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setEmployeeFilter("")}
                className={`rounded-full border px-3 py-0.5 text-xs font-medium transition-colors ${
                  employeeFilter === ""
                    ? "border-stone-700 bg-stone-700 text-white"
                    : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                Todos
              </button>
              {employees.map((emp) => {
                const c = colorById.get(emp.id) ?? PALETTE[0];
                const active = employeeFilter === emp.id;
                return (
                  <button
                    key={emp.id}
                    onClick={() => setEmployeeFilter(active ? "" : emp.id)}
                    className={`rounded-full border px-3 py-0.5 text-xs font-medium uppercase transition-all ${
                      active ? `${c!.bg} ${c!.border} ${c!.text} ring-2 ring-offset-1 ring-current` : `${c!.bg} ${c!.border} ${c!.text} opacity-70 hover:opacity-100`
                    }`}
                  >
                    {shortName(emp.fullName)}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-stone-300" /> Pendente</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Conferido</span>
              {Object.entries(LEAVE_TYPE_LABELS).map(([type, label]) => (
                <span key={type} className="flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${LEAVE_DOT[type]}`} /> {label}
                </span>
              ))}
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-600" /> Feriado</span>
            </div>

            {/* Grid */}
            <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white">
              {isLoading ? (
                <div className="py-16 text-center text-sm text-stone-400">A carregar…</div>
              ) : (
                <div className="grid grid-cols-7 gap-px bg-stone-100">
                  {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
                    <div key={d} className="bg-stone-50 px-2 py-1.5 text-center text-xs font-semibold uppercase text-stone-500">
                      {d}
                    </div>
                  ))}
                  {days.map((day) => {
                    const ymd = toYmd(day);
                    const inMonth = viewMode === "week" || day.getMonth() === anchorDate.getMonth();
                    const dayShifts = shiftsByDate.get(ymd) ?? [];
                    const dayLeaves = leavesByDate.get(ymd) ?? [];
                    const holiday = holidaysByDate.get(ymd);
                    const dayConflicts = conflictsByDate.get(ymd) ?? 0;

                    if (visualMode === "compact") {
                      const scheduledCount = new Set(dayShifts.map((s) => s.employeeId)).size;
                      const visibleShifts = dayShifts.slice(0, 2);
                      const extraCount = dayShifts.length - visibleShifts.length;
                      return (
                        <button
                          key={ymd}
                          onClick={() => setSelectedSummaryDate(ymd)}
                          className={`min-h-[104px] bg-white p-1.5 text-left ${inMonth ? "" : "opacity-40"} ${holiday ? "bg-amber-50/60" : ""} hover:bg-stone-50`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-stone-400">{day.getDate()}</span>
                            {dayConflicts > 0 && <span title={`${dayConflicts} conflito(s)`}>⚠️</span>}
                          </div>
                          {holiday && <p className="truncate text-[10px] font-medium text-amber-700">{holiday.name}</p>}
                          {(scheduledCount > 0 || dayLeaves.length > 0) && (
                            <p className="mt-0.5 truncate text-[10px] text-stone-500">
                              {scheduledCount} escalado(s)
                              {dayLeaves.length > 0 && ` · ${dayLeaves.length} ausência(s)`}
                              {dayConflicts > 0 && ` · ${dayConflicts} conflito(s)`}
                            </p>
                          )}
                          <div className="mt-1 space-y-0.5">
                            {visibleShifts.map((s) => {
                              const hasSecond = s.secondStartTime && s.secondEndTime;
                              return (
                                <p key={s.id} className="truncate text-[10px] text-stone-600">
                                  {shortName(s.employeeName)} · {s.startTime}–{s.endTime}
                                  {hasSecond && ` | ${s.secondStartTime}–${s.secondEndTime}`}
                                </p>
                              );
                            })}
                            {extraCount > 0 && <p className="text-[10px] font-medium text-[#ED5C32]">+{extraCount} mais</p>}
                          </div>
                        </button>
                      );
                    }

                    return (
                      <div
                        key={ymd}
                        className={`min-h-[130px] bg-white p-1.5 ${inMonth ? "" : "opacity-40"} ${holiday ? "bg-amber-50/60" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-stone-400">{day.getDate()}</span>
                          <button
                            onClick={() => openNewShift(ymd)}
                            className="rounded px-1 text-xs text-stone-300 hover:bg-stone-100 hover:text-[#ED5C32]"
                            title="Novo turno"
                          >
                            +
                          </button>
                        </div>
                        {holiday && <p className="truncate text-[10px] font-medium text-amber-700">{holiday.name}</p>}
                        <div className="mt-0.5 space-y-1">
                          {dayShifts.map((s) => {
                            const c = colorById.get(s.employeeId) ?? PALETTE[0]!;
                            const hasSecond = s.secondStartTime && s.secondEndTime;
                            return (
                              <button
                                key={s.id}
                                onClick={() => openEditShift(s)}
                                title={`${s.employeeName} · ${s.startTime}–${s.endTime}${hasSecond ? ` | ${s.secondStartTime}–${s.secondEndTime}` : ""}${s.endsNextDay ? " (+1 dia)" : ""}${s.status === "draft" ? " (rascunho)" : ""}`}
                                className={`block w-full rounded border px-1.5 py-0.5 text-left text-[11px] leading-snug ${c.bg} ${c.border} ${c.text}`}
                              >
                                <div className="font-medium">{shortName(s.employeeName)}</div>
                                <div className="mt-0.5 flex items-center gap-1 text-[10px] opacity-70">
                                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${shiftDotClass(s)}`} />
                                  <span>
                                    {s.startTime}–{s.endTime}
                                    {s.endsNextDay && " (+1 dia)"}
                                  </span>
                                  {hasSecond && (
                                    <>
                                      <span className="opacity-60">|</span>
                                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${shiftDotClass(s)}`} />
                                      <span>
                                        {s.secondStartTime}–{s.secondEndTime}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                          {dayLeaves.map((l) => (
                            <div
                              key={l.id}
                              title={LEAVE_TYPE_LABELS[l.type]}
                              className={`rounded border px-1.5 py-0.5 text-[11px] leading-snug ${LEAVE_TYPE_CALENDAR_COLORS[l.type]}`}
                            >
                              <div className="truncate font-medium">
                                {shortName(employees.find((e) => e.id === l.employeeId)?.fullName ?? l.employeeId)}
                              </div>
                              <div className="mt-0.5 text-[10px] opacity-70">{LEAVE_TYPE_LABELS[l.type]}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {visualMode === "compact" && selectedSummaryDate && (
            <DaySummaryPanel
              date={selectedSummaryDate}
              dayShifts={shiftsByDate.get(selectedSummaryDate) ?? []}
              dayLeaves={leavesByDate.get(selectedSummaryDate) ?? []}
              conflictCount={conflictsByDate.get(selectedSummaryDate) ?? 0}
              employeeColorClass={(employeeId) => {
                const c = colorById.get(employeeId) ?? PALETTE[0]!;
                return `${c.bg} ${c.border}`;
              }}
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
        </div>
      )}

      <ShiftDrawer
        open={drawerOpen}
        editing={editingShift}
        defaultEmployeeId={employeeFilter || null}
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

      {showBaseSchedule && employeeFilter && (
        <BaseScheduleModal
          employeeId={employeeFilter}
          employeeName={employees.find((e) => e.id === employeeFilter)?.fullName ?? ""}
          weekStartDate={toYmd(mondayOf(anchorDate))}
          onClose={() => setShowBaseSchedule(false)}
          onApplied={invalidate}
        />
      )}

      {showClearShifts && (
        <ClearShiftsModal
          employeeId={employeeFilter || null}
          employeeName={employees.find((e) => e.id === employeeFilter)?.fullName ?? ""}
          defaultWeekStartDate={toYmd(mondayOf(anchorDate))}
          locationId={locationFilter || undefined}
          onClose={() => setShowClearShifts(false)}
          onCleared={() => {
            invalidate();
            setShowClearShifts(false);
          }}
        />
      )}

      {repeatModalWeeks !== null && (
        <RepeatScheduleWeekModal
          sourceWeekStartDate={toYmd(mondayOf(anchorDate))}
          sourceWeekLabel={periodLabel}
          sourceWeekEmployees={weekEmployeesForActions}
          defaultWeeks={repeatModalWeeks}
          defaultRotate={repeatModalRotate}
          onClose={() => setRepeatModalWeeks(null)}
          onCompleted={() => {
            invalidate();
            setRepeatModalWeeks(null);
          }}
        />
      )}

      <PageFooter />
    </div>
  );
}
