import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm, useFormState, useWatch } from "react-hook-form";
import { Link, useParams } from "react-router-dom";

import { ApiError } from "../../lib/api";
import {
  formatIsoDateRangePt,
} from "../../lib/format";
import {
  attendanceFormValuesToPatchBody,
  createEmployeePayment,
  createShift,
  deletePayment,
  deleteShift,
  fetchEmployee,
  fetchEmployees,
  fetchLeaveOverview,
  fetchPublicHolidays,
  fetchShifts,
  patchEmployee,
  patchPayment,
  patchShift,
  patchShiftAttendance,
  paymentFormValuesToApiBody,
  setEmployeeKioskPin,
  type PatchEmployeeBody,
  type PatchShiftAttendanceBody,
} from "./hrApi";
import { hrQueryKeys } from "./hrQueryKeys";
import {
  employeeEditSchema,
  paymentFormSchema,
  shiftFormSchema,
  type EmployeeEditFormValues,
  type PaymentFormValues,
  type ShiftFormValues,
} from "./hrSchemas";
import { AttendanceConferenceModal } from "./components/AttendanceConferenceModal";
import { WeeklyScheduleEditor } from "./components/WeeklyScheduleEditor";
import {
  HR_EMPLOYMENT_TYPE_LABELS,
  isShiftAttendancePending,
  JOB_ROLE_LABELS,
  LEAVE_TYPE_CALENDAR_COLORS,
  LEAVE_TYPE_LABELS,
  normalizeEmploymentType,
  normalizeJobRole,
  salaryPeriodValueFromPayment,
  SHIFT_ATTENDANCE_STATUS_LABELS,
  type HrEmployeePayment,
  type HrLeaveRequest,
  type HrWorkShift,
} from "./hr.types";
import { defaultWeeklyScheduleFor } from "./weeklySchedulePresets";
import {
  buildCreateShiftBodiesFromWeeklySchedule,
  finalizeWeeklySchedule,
} from "./weeklyScheduleUtils";
import {
  addDaysToYmd,
  buildMonthCalendarCells,
  dateInputValueToIsoDatetime,
  formatYearMonth,
  getCivilMonthRangeIso,
  getCurrentYearMonthLisbon,
  getTodayLisbon,
  isoDatetimeToDateInputValue,
  parseTimeToMinutes,
} from "./dates";
import { Modal } from "./components/Modal";
import { SkeletonBlock } from "./components/SkeletonBlock";
import { LeaveTab } from "./components/LeaveTab";
import { PaymentsTab } from "./components/PaymentsTab";

function shiftPlannedMins(s: HrWorkShift): number | null {
  const start = parseTimeToMinutes(s.startTime);
  const end = parseTimeToMinutes(s.endTime);
  if (start === null || end === null) return null;
  return end - start;
}

function shiftActualMins(s: HrWorkShift): number | null {
  const a = s.attendance;
  if (!a?.actualStartTime || !a?.actualEndTime) return null;
  const start = parseTimeToMinutes(a.actualStartTime);
  const end = parseTimeToMinutes(a.actualEndTime);
  if (start === null || end === null) return null;
  return end - start;
}

function formatMins(mins: number): string {
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${mins < 0 ? "−" : "+"}${m}min`;
  return `${mins < 0 ? "−" : "+"}${h}h${m > 0 ? `${m}min` : ""}`;
}

function ShiftSaldo({ shift }: { shift: HrWorkShift }) {
  const planned = shiftPlannedMins(shift);
  const actual = shiftActualMins(shift);
  if (actual === null || planned === null)
    return <span className="text-slate-400">—</span>;
  const diff = actual - planned;
  if (diff === 0) return <span className="text-slate-500">0</span>;
  if (diff > 0)
    return (
      <span className="font-medium text-emerald-700">{formatMins(diff)}</span>
    );
  return <span className="font-medium text-red-600">{formatMins(diff)}</span>;
}

function ShiftRealizado({ shift }: { shift: HrWorkShift }) {
  const a = shift.attendance;
  if (!a?.actualStartTime) return <span className="text-slate-400">—</span>;
  if (!a.actualEndTime)
    return (
      <span className="text-slate-600">
        {a.actualStartTime}{" "}
        <span className="text-xs text-amber-600">em curso</span>
      </span>
    );
  return (
    <span className="text-slate-700">
      {a.actualStartTime} – {a.actualEndTime}
    </span>
  );
}

const WEEKDAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const controlClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";


function toPatchEmployeeBody(v: EmployeeEditFormValues): PatchEmployeeBody {
  const hired =
    v.hiredAt?.trim() != null && v.hiredAt.trim() !== ""
      ? dateInputValueToIsoDatetime(v.hiredAt.trim())
      : null;
  const ended =
    v.endedAt?.trim() != null && v.endedAt.trim() !== ""
      ? dateInputValueToIsoDatetime(v.endedAt.trim())
      : null;
  return {
    fullName: v.fullName.trim(),
    email: v.email?.trim() || null,
    phone: v.phone?.trim() || null,
    roleOrNotes: v.roleOrNotes?.trim() || null,
    status: v.status,
    jobRole: v.jobRole,
    employmentType: v.employmentType,
    hiredAt: hired,
    endedAt: ended,
    salaryType: v.salaryType ?? "fixed",
    baseSalary: !v.baseSalary || typeof v.baseSalary !== "number" || isNaN(v.baseSalary) ? null : v.baseSalary,
    hourlyRate: !v.hourlyRate || typeof v.hourlyRate !== "number" || isNaN(v.hourlyRate) ? null : v.hourlyRate,
  };
}

export function HrEmployeeDetailPage() {
  const { id: rawId } = useParams();
  const id = rawId ?? "";
  const qc = useQueryClient();
  const initialYm = getCurrentYearMonthLisbon();
  const [year, setYear] = useState(initialYm.year);
  const [month, setMonth] = useState(initialYm.month);
  const [tab, setTab] = useState<"dados" | "turnos" | "pagamentos" | "ferias">(
    "dados",
  );
  const [banner, setBanner] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const [shiftModal, setShiftModal] = useState<"create" | HrWorkShift | null>(
    null,
  );
  const [attendanceModal, setAttendanceModal] = useState<HrWorkShift | null>(
    null,
  );
  const [payModal, setPayModal] = useState<"create" | HrEmployeePayment | null>(
    null,
  );
  const [applyMonthOpen, setApplyMonthOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [prefillDate, setPrefillDate] = useState<string>("");
  const todayIso = useMemo(() => getTodayLisbon(), []);

  const range = useMemo(
    () => getCivilMonthRangeIso(year, month),
    [year, month],
  );

  const shiftScope = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      employeeId: id,
    }),
    [range.from, range.to, id],
  );

  const {
    data: employee,
    isPending: empLoading,
    error: empError,
  } = useQuery({
    queryKey: hrQueryKeys.employee(id),
    queryFn: () => fetchEmployee(id),
    enabled: Boolean(id),
  });

  const { data: shifts, isPending: shiftsLoading } = useQuery({
    queryKey: hrQueryKeys.shifts(shiftScope),
    queryFn: () => fetchShifts(shiftScope),
    enabled: Boolean(id) && tab === "turnos",
  });

  const byDate = useMemo(() => {
    const map = new Map<string, HrWorkShift[]>();
    for (const s of shifts ?? []) {
      const list = map.get(s.workDate) ?? [];
      list.push(s);
      map.set(s.workDate, list);
    }
    return map;
  }, [shifts]);

  const weeks = useMemo(
    () => buildMonthCalendarCells(year, month),
    [year, month],
  );

  const { data: holidays } = useQuery({
    queryKey: hrQueryKeys.publicHolidays(year),
    queryFn: () => fetchPublicHolidays(year),
    enabled: tab === "turnos",
  });

  const holidaySet = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of holidays ?? []) m.set(h.date, h.name);
    return m;
  }, [holidays]);

  const { data: leaves } = useQuery({
    queryKey: hrQueryKeys.leaveOverview(year),
    queryFn: () => fetchLeaveOverview(year),
    enabled: tab === "turnos",
  });

  const leavesByDate = useMemo(() => {
    const map = new Map<string, HrLeaveRequest[]>();
    for (const leave of leaves ?? []) {
      if (leave.employeeId !== id) continue;
      let cur = leave.startDate;
      while (cur <= leave.endDate) {
        if (cur >= range.from && cur <= range.to) {
          const list = map.get(cur) ?? [];
          list.push(leave);
          map.set(cur, list);
        }
        cur = addDaysToYmd(cur, 1);
        if (cur > range.to) break;
      }
    }
    return map;
  }, [leaves, id, range.from, range.to]);


  const patchMut = useMutation({
    mutationFn: (body: PatchEmployeeBody) => patchEmployee(id, body),
    onSuccess: async (_data, body) => {
      await qc.invalidateQueries({ queryKey: hrQueryKeys.root });
      const keys = body ? Object.keys(body) : [];
      const onlySchedule = keys.length === 1 && keys[0] === "weeklySchedule";
      setBanner({
        type: "ok",
        text: onlySchedule ? "Escala atualizada." : "Dados atualizados.",
      });
    },
    onError: (e: unknown) => {
      setBanner({
        type: "err",
        text:
          e instanceof ApiError ? e.message : "Não foi possível guardar dados.",
      });
    },
  });

  const invalidateHr = async () => {
    await qc.invalidateQueries({ queryKey: hrQueryKeys.root });
  };

  const createShiftMut = useMutation({
    mutationFn: (values: ShiftFormValues) =>
      createShift({
        employeeId: values.employeeId,
        workDate: values.workDate,
        startTime: values.startTime,
        endTime: values.endTime,
        locationOrStation: values.locationOrStation?.trim() || null,
        notes: values.notes?.trim() || null,
      }),
    onSuccess: async () => {
      await invalidateHr();
      setShiftModal(null);
      setBanner({ type: "ok", text: "Turno criado." });
    },
    onError: (e: unknown) => {
      setBanner({
        type: "err",
        text: e instanceof ApiError ? e.message : "Erro ao criar turno.",
      });
    },
  });

  const updateShiftMut = useMutation({
    mutationFn: ({ sid, values }: { sid: string; values: ShiftFormValues }) =>
      patchShift(sid, {
        employeeId: values.employeeId,
        workDate: values.workDate,
        startTime: values.startTime,
        endTime: values.endTime,
        locationOrStation: values.locationOrStation?.trim() || null,
        notes: values.notes?.trim() || null,
      }),
    onSuccess: async () => {
      await invalidateHr();
      setShiftModal(null);
      setBanner({ type: "ok", text: "Turno atualizado." });
    },
    onError: (e: unknown) => {
      setBanner({
        type: "err",
        text: e instanceof ApiError ? e.message : "Erro ao atualizar turno.",
      });
    },
  });

  const deleteShiftMut = useMutation({
    mutationFn: (sid: string) => deleteShift(sid),
    onSuccess: async () => {
      await invalidateHr();
      setBanner({ type: "ok", text: "Turno removido." });
    },
    onError: (e: unknown) => {
      setBanner({
        type: "err",
        text: e instanceof ApiError ? e.message : "Erro ao remover turno.",
      });
    },
  });

  const attendancePatchMut = useMutation({
    mutationFn: (p: { shiftId: string; body: PatchShiftAttendanceBody }) =>
      patchShiftAttendance(p.shiftId, p.body),
    onSuccess: async (updated) => {
      qc.setQueryData(
        hrQueryKeys.shifts(shiftScope),
        (old: HrWorkShift[] | undefined) => {
          if (!old) return [updated];
          return old.map((x) => (x.id === updated.id ? updated : x));
        },
      );
      await qc.invalidateQueries({ queryKey: hrQueryKeys.root });
      setAttendanceModal(null);
      setBanner({ type: "ok", text: "Conferência registada." });
    },
    onError: (e: unknown) => {
      setBanner({
        type: "err",
        text:
          e instanceof ApiError ? e.message : "Erro ao guardar conferência.",
      });
    },
  });

  const createPayMut = useMutation({
    mutationFn: ({
      employeeId: eid,
      values,
    }: {
      employeeId: string;
      values: PaymentFormValues;
    }) => createEmployeePayment(eid, paymentFormValuesToApiBody(values)),
    onSuccess: async () => {
      await invalidateHr();
      setPayModal(null);
      setBanner({ type: "ok", text: "Pagamento registado." });
    },
    onError: (e: unknown) => {
      setBanner({
        type: "err",
        text: e instanceof ApiError ? e.message : "Erro ao criar pagamento.",
      });
    },
  });

  const updatePayMut = useMutation({
    mutationFn: ({ pid, values }: { pid: string; values: PaymentFormValues }) =>
      patchPayment(pid, paymentFormValuesToApiBody(values)),
    onSuccess: async () => {
      await invalidateHr();
      setPayModal(null);
      setBanner({ type: "ok", text: "Pagamento atualizado." });
    },
    onError: (e: unknown) => {
      setBanner({
        type: "err",
        text:
          e instanceof ApiError ? e.message : "Erro ao atualizar pagamento.",
      });
    },
  });

  const deletePayMut = useMutation({
    mutationFn: (pid: string) => deletePayment(pid),
    onSuccess: async () => {
      await invalidateHr();
      setBanner({ type: "ok", text: "Pagamento removido." });
    },
    onError: (e: unknown) => {
      setBanner({
        type: "err",
        text: e instanceof ApiError ? e.message : "Erro ao remover pagamento.",
      });
    },
  });

  const setPinMut = useMutation({
    mutationFn: (pin: string) => setEmployeeKioskPin(id, pin),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: hrQueryKeys.employee(id) });
      setPinModalOpen(false);
      setPinInput("");
      setBanner({ type: "ok", text: "PIN de kiosk configurado." });
    },
    onError: (e: unknown) => {
      setBanner({
        type: "err",
        text: e instanceof ApiError ? e.message : "Erro ao definir PIN.",
      });
    },
  });

  const applyPreviewBodies = useMemo(() => {
    if (!employee?.weeklySchedule?.days?.length) return [];
    return buildCreateShiftBodiesFromWeeklySchedule(
      id,
      finalizeWeeklySchedule(employee.weeklySchedule),
      year,
      month,
      shifts ?? [],
    );
  }, [employee, id, year, month, shifts]);

  const applyScheduleMut = useMutation({
    mutationFn: async () => {
      if (!employee?.weeklySchedule?.days?.length) {
        throw new Error("Sem escala definida.");
      }
      const bodies = buildCreateShiftBodiesFromWeeklySchedule(
        id,
        finalizeWeeklySchedule(employee.weeklySchedule),
        year,
        month,
        shifts ?? [],
      );
      for (const b of bodies) {
        await createShift(b);
      }
      return { created: bodies.length };
    },
    onSuccess: async (data) => {
      await invalidateHr();
      setApplyMonthOpen(false);
      setBanner({
        type: "ok",
        text:
          data.created === 0
            ? "Nenhum turno novo neste mês (já existiam ou a escala não cobre estes dias)."
            : `${data.created} turno(s) criado(s).`,
      });
    },
    onError: (e: unknown) => {
      setBanner({
        type: "err",
        text:
          e instanceof ApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Erro ao criar turnos.",
      });
    },
  });

  const editForm = useForm<EmployeeEditFormValues>({
    resolver: zodResolver(employeeEditSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      roleOrNotes: "",
      status: "active",
      jobRole: "service",
      employmentType: "permanent",
      hiredAt: "",
      endedAt: "",
    },
  });

  const { dirtyFields } = useFormState({ control: editForm.control });
  const editSalaryType = useWatch({ control: editForm.control, name: "salaryType" }) ?? "fixed";

  useEffect(() => {
    if (!employee) return;
    editForm.reset({
      fullName: employee.fullName,
      email: employee.email ?? "",
      phone: employee.phone ?? "",
      roleOrNotes: employee.roleOrNotes ?? "",
      status: employee.status,
      jobRole: normalizeJobRole(employee.jobRole),
      employmentType: normalizeEmploymentType(employee.employmentType),
      hiredAt: isoDatetimeToDateInputValue(employee.hiredAt),
      endedAt: isoDatetimeToDateInputValue(employee.endedAt),
      salaryType: employee.salaryType ?? "fixed",
      baseSalary: employee.baseSalary ?? "",
      hourlyRate: employee.hourlyRate ?? "",
    });
  }, [employee, editForm]);

  function prevMonth() {
    if (month <= 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month >= 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  if (!id) {
    return (
      <div className="p-6 text-sm text-red-700">Identificador em falta.</div>
    );
  }

  if (empError) {
    const notFound = empError instanceof ApiError && empError.status === 404;
    return (
      <div className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-red-800">
          {notFound
            ? "Funcionário não encontrado."
            : empError instanceof Error
              ? empError.message
              : "Erro ao carregar."}
        </p>
        <Link
          to="/hr"
          className="mt-2 inline-block text-sm text-indigo-700 hover:underline"
        >
          ← Voltar à lista
        </Link>
      </div>
    );
  }

  if (empLoading || !employee) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <SkeletonBlock className="h-8 w-64" />
        <SkeletonBlock className="h-40 w-full" />
      </div>
    );
  }

  const monthTitle = `${String(month).padStart(2, "0")} / ${year}`;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/hr" className="text-sm text-indigo-700 hover:underline">
            ← Funcionários
          </Link>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            {employee.fullName}
          </h2>
        </div>
      </div>

      {banner ? (
        <div
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            banner.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["dados", "Dados"],
            ["turnos", "Turnos"],
            ["pagamentos", "Pagamentos"],
            ["ferias", "Férias & Ausências"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              tab === k
                ? "bg-indigo-100 text-indigo-900"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "dados" ? (
        <form
          className="mt-6 grid max-w-5xl grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2"
          onSubmit={editForm.handleSubmit((v) =>
            patchMut.mutate(toPatchEmployeeBody(v)),
          )}
        >
          <Field
            label="Nome completo *"
            error={editForm.formState.errors.fullName?.message}
            unsavedChange={Boolean(dirtyFields.fullName)}
            input={
              <input
                className={controlClass}
                {...editForm.register("fullName")}
              />
            }
          />
          <Field
            label="Email"
            error={editForm.formState.errors.email?.message}
            unsavedChange={Boolean(dirtyFields.email)}
            input={
              <input
                className={controlClass}
                type="email"
                {...editForm.register("email")}
              />
            }
          />
          <Field
            label="Telefone"
            error={editForm.formState.errors.phone?.message}
            unsavedChange={Boolean(dirtyFields.phone)}
            input={
              <input className={controlClass} {...editForm.register("phone")} />
            }
          />
          <Field
            label="Estado"
            error={editForm.formState.errors.status?.message}
            unsavedChange={Boolean(dirtyFields.status)}
            input={
              <select className={controlClass} {...editForm.register("status")}>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            }
          />
          <Field
            label="Vínculo *"
            error={editForm.formState.errors.employmentType?.message}
            unsavedChange={Boolean(dirtyFields.employmentType)}
            input={
              <select
                className={controlClass}
                {...editForm.register("employmentType")}
              >
                {(
                  Object.entries(HR_EMPLOYMENT_TYPE_LABELS) as [
                    keyof typeof HR_EMPLOYMENT_TYPE_LABELS,
                    string,
                  ][]
                ).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            }
          />
          <Field
            label="Função *"
            error={editForm.formState.errors.jobRole?.message}
            unsavedChange={Boolean(dirtyFields.jobRole)}
            input={
              <select
                className={controlClass}
                {...editForm.register("jobRole")}
              >
                {(
                  Object.entries(JOB_ROLE_LABELS) as [
                    keyof typeof JOB_ROLE_LABELS,
                    string,
                  ][]
                ).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            }
          />

          <Field
            label="Data de contratação"
            error={editForm.formState.errors.hiredAt?.message}
            unsavedChange={Boolean(dirtyFields.hiredAt)}
            input={
              <input
                className={controlClass}
                type="date"
                {...editForm.register("hiredAt")}
              />
            }
          />
          <Field
            label="Data de cessação"
            error={editForm.formState.errors.endedAt?.message}
            unsavedChange={Boolean(dirtyFields.endedAt)}
            input={
              <input
                className={controlClass}
                type="date"
                {...editForm.register("endedAt")}
              />
            }
          />
          <Field
            label="Tipo de remuneração"
            error={editForm.formState.errors.salaryType?.message}
            unsavedChange={Boolean(dirtyFields.salaryType)}
            input={
              <select className={controlClass} {...editForm.register("salaryType")}>
                <option value="fixed">Salário fixo mensal</option>
                <option value="hourly">Por horas trabalhadas</option>
              </select>
            }
          />
          {editSalaryType === "fixed" ? (
            <Field
              label="Salário base (€/mês)"
              error={editForm.formState.errors.baseSalary?.message}
              unsavedChange={Boolean(dirtyFields.baseSalary)}
              input={
                <input
                  className={controlClass}
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="ex: 1081.27"
                  {...editForm.register("baseSalary", { valueAsNumber: true })}
                />
              }
            />
          ) : (
            <Field
              label="Valor por hora (€/hora)"
              error={editForm.formState.errors.hourlyRate?.message}
              unsavedChange={Boolean(dirtyFields.hourlyRate)}
              input={
                <input
                  className={controlClass}
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="ex: 5.31"
                  {...editForm.register("hourlyRate", { valueAsNumber: true })}
                />
              }
            />
          )}
          <div className="md:col-span-2">
            <Field
              label="Notas"
              error={editForm.formState.errors.roleOrNotes?.message}
              unsavedChange={Boolean(dirtyFields.roleOrNotes)}
              input={
                <textarea
                  className={`${controlClass} min-h-[80px]`}
                  {...editForm.register("roleOrNotes")}
                />
              }
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={patchMut.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {patchMut.isPending ? "A guardar…" : "Guardar alterações"}
            </button>
          </div>
        </form>
      ) : null}

      {tab === "dados" ? (
        <div className="mt-8 max-w-5xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800">PIN de Kiosk</h3>
          <p className="mt-1 text-xs text-slate-500">
            O funcionário usa este PIN de 4 dígitos para registar o ponto
            através do QR code na loja.
          </p>
          <div className="mt-3 flex items-center gap-3">
            {employee.hasKioskPin ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                <span>●</span> PIN configurado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                <span>○</span> PIN não configurado
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setPinInput("");
                setPinModalOpen(true);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {employee.hasKioskPin ? "Alterar PIN" : "Definir PIN"}
            </button>
          </div>
          {pinModalOpen ? (
            <Modal
              title={
                employee.hasKioskPin
                  ? "Alterar PIN de Kiosk"
                  : "Definir PIN de Kiosk"
              }
              onClose={() => {
                setPinModalOpen(false);
                setPinInput("");
              }}
              footer={
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setPinModalOpen(false);
                      setPinInput("");
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={pinInput.length !== 4 || setPinMut.isPending}
                    onClick={() => setPinMut.mutate(pinInput)}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {setPinMut.isPending ? "A guardar…" : "Guardar PIN"}
                  </button>
                </>
              }
            >
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Introduz um PIN de exactamente 4 dígitos para o funcionário{" "}
                  <strong>{employee.fullName}</strong>.
                </p>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="\d{4}"
                  value={pinInput}
                  onChange={(e) =>
                    setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="••••"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-2xl tracking-[0.5em] shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />
                <p className="text-xs text-slate-400">
                  Cada funcionário deve ter um PIN único. O PIN é guardado de
                  forma segura.
                </p>
              </div>
            </Modal>
          ) : null}
        </div>
      ) : null}

      {tab === "turnos" ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              ←
            </button>
            <span className="text-sm font-semibold text-slate-800">
              {monthTitle}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            >
              →
            </button>
            <span className="text-xs text-slate-500">
              {formatIsoDateRangePt(range.from, range.to)}
            </span>
            <button
              type="button"
              disabled={
                !employee.weeklySchedule?.days?.length ||
                applyScheduleMut.isPending
              }
              onClick={() => setApplyMonthOpen(true)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                !employee.weeklySchedule?.days?.length
                  ? "Expanda «Escala base (semanal)» abaixo e defina os dias"
                  : undefined
              }
            >
              Aplicar escala ao mês
            </button>
            <button
              type="button"
              onClick={() => setShiftModal("create")}
              className="ml-auto rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Novo turno
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            {shiftsLoading ? (
              <SkeletonBlock className="h-[420px] w-full min-w-[720px]" />
            ) : (
              <div className="grid min-w-[720px] grid-cols-7 gap-px bg-slate-200">
                {WEEKDAYS_SHORT.map((d) => (
                  <div
                    key={d}
                    className="bg-slate-50 px-2 py-2 text-center text-xs font-semibold text-slate-600"
                  >
                    {d}
                  </div>
                ))}
                {weeks.flatMap((row, ri) =>
                  row.map((cell, ci) => {
                    if (cell.kind === "empty") {
                      return (
                        <div
                          key={`e-${ri}-${ci}`}
                          className="min-h-[110px] bg-slate-50"
                        />
                      );
                    }
                    const dayShifts = byDate.get(cell.iso) ?? [];
                    const isToday = cell.iso === todayIso;
                    const holidayName = holidaySet.get(cell.iso);
                    return (
                      <div
                        key={cell.iso}
                        className={`min-h-[110px] p-1.5 ${
                          holidayName ? "bg-amber-50" : "bg-white"
                        } ${isToday ? "ring-2 ring-inset ring-indigo-400" : ""}`}
                      >
                        <div className="flex items-center gap-1">
                          <div
                            className={`inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                              isToday
                                ? "bg-indigo-600 text-white"
                                : "text-slate-500"
                            }`}
                          >
                            {cell.day}
                          </div>
                          {holidayName && (
                            <span
                              title={holidayName}
                              className="truncate rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold text-amber-700"
                            >
                              {holidayName}
                            </span>
                          )}
                        </div>

                        {leavesByDate.get(cell.iso)?.map((leave) => (
                          <div
                            key={`leave-${leave.id}`}
                            title={LEAVE_TYPE_LABELS[leave.type]}
                            className={`mt-1 rounded border px-1.5 py-0.5 text-[11px] leading-snug ${LEAVE_TYPE_CALENDAR_COLORS[leave.type]}`}
                          >
                            {LEAVE_TYPE_LABELS[leave.type]}
                          </div>
                        ))}
                        {dayShifts.length === 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPrefillDate(cell.iso);
                              setShiftModal("create");
                            }}
                            className="mt-1 flex w-full items-center justify-center rounded border border-dashed border-slate-200 py-2.5 text-[10px] text-slate-400 hover:border-indigo-300 hover:text-indigo-500"
                          >
                            + turno
                          </button>
                        ) : (
                          dayShifts.map((s, sIdx) => (
                            <div key={s.id} className="mt-1">
                              {holidaySet.has(cell.iso) &&
                                s.attendance?.status !== "cancelled" &&
                                sIdx === 0 && (
                                  <div className="mb-0.5 rounded bg-violet-100 px-1 py-0.5 text-[9px] font-semibold text-violet-700">
                                    Folga devida
                                  </div>
                                )}
                              <button
                                type="button"
                                onClick={() => setAttendanceModal(s)}
                                className={`w-full rounded border px-1.5 py-1 text-left text-[11px] leading-snug hover:opacity-90 ${
                                  s.attendance?.status === "cancelled"
                                    ? "border-slate-200 bg-slate-50 text-slate-400"
                                    : isShiftAttendancePending(s)
                                      ? "border-amber-200 bg-amber-50 text-amber-900"
                                      : "border-emerald-200 bg-emerald-50 text-slate-800"
                                }`}
                              >
                                <div
                                  className={`font-medium tabular-nums ${s.attendance?.status === "cancelled" ? "line-through" : ""}`}
                                >
                                  {s.startTime} – {s.endTime}
                                </div>
                                {s.attendance?.status !== "cancelled" && (
                                  <>
                                    <div className="mt-0.5 tabular-nums">
                                      <ShiftRealizado shift={s} />
                                    </div>
                                    <div className="mt-0.5">
                                      <ShiftSaldo shift={s} />
                                    </div>
                                  </>
                                )}
                                <div className="mt-0.5">
                                  {s.attendance?.status === "cancelled" ? (
                                    <span className="text-[10px] font-medium text-slate-400">
                                      Cancelado
                                    </span>
                                  ) : isShiftAttendancePending(s) ? (
                                    <span className="text-[10px] font-medium text-amber-700">
                                      Pendente
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-emerald-700">
                                      {s.attendance
                                        ? SHIFT_ATTENDANCE_STATUS_LABELS[
                                            s.attendance.status
                                          ]
                                        : "—"}
                                    </span>
                                  )}
                                </div>
                              </button>
                              <div className="mt-0.5 flex gap-2 px-0.5">
                                <button
                                  type="button"
                                  className="text-[10px] text-indigo-600 hover:underline"
                                  onClick={() => setShiftModal(s)}
                                >
                                  editar
                                </button>
                                <button
                                  type="button"
                                  className="text-[10px] text-red-600 hover:underline"
                                  disabled={deleteShiftMut.isPending}
                                  onClick={() => {
                                    if (window.confirm("Remover este turno?"))
                                      deleteShiftMut.mutate(s.id);
                                  }}
                                >
                                  apagar
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    );
                  }),
                )}
              </div>
            )}
          </div>

          <details className="mt-6 rounded-xl border border-slate-200 bg-white open:shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <span>Escala base (semanal)</span>
              <span className="text-xs font-normal text-slate-500">
                Mostrar / ocultar
              </span>
            </summary>
            <div className="border-t border-slate-100 px-4 pb-4 pt-2">
              <WeeklyScheduleEditor
                key={`${employee.id}-${employee.updatedAt}`}
                embedded
                initial={employee.weeklySchedule}
                loading={patchMut.isPending}
                getSuggestedPreset={() =>
                  defaultWeeklyScheduleFor(
                    normalizeJobRole(employee.jobRole),
                    normalizeEmploymentType(employee.employmentType),
                  )
                }
                onSave={(ws) => patchMut.mutate({ weeklySchedule: ws })}
                onClear={() => patchMut.mutate({ weeklySchedule: null })}
              />
            </div>
          </details>
        </div>
      ) : null}

      {tab === "pagamentos" && id ? (
        <PaymentsTab
          employeeId={id}
          employee={employee ?? null}
          onCreatePayment={() => setPayModal("create")}
          onEditPayment={(p) => setPayModal(p)}
          onDeletePayment={(p) => {
            if (window.confirm("Remover este pagamento?")) deletePayMut.mutate(p.id);
          }}
        />
      ) : null}

      {tab === "ferias" && id ? (
        <LeaveTab employeeId={id} employee={employee ?? null} />
      ) : null}

      {applyMonthOpen ? (
        <Modal
          title="Aplicar escala ao mês"
          onClose={() => setApplyMonthOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setApplyMonthOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  applyScheduleMut.isPending || applyPreviewBodies.length === 0
                }
                onClick={() => applyScheduleMut.mutate()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {applyScheduleMut.isPending ? "A criar…" : "Confirmar"}
              </button>
            </div>
          }
        >
          <p className="text-sm text-slate-700">
            No mês <strong>{monthTitle}</strong> serão criados{" "}
            <strong>{applyPreviewBodies.length}</strong> turno(s) novo(s) a
            partir da escala base (turnos já existentes no mesmo dia e horas são
            ignorados).
          </p>
          {applyPreviewBodies.length === 0 ? (
            <p className="mt-2 text-sm text-amber-800">
              Não há turnos em falta: já existem para este mês ou a escala não
              cobre estes dias. Ajuste a escala base (secção abaixo) se
              precisar.
            </p>
          ) : null}
        </Modal>
      ) : null}

      {attendanceModal ? (
        <AttendanceConferenceModal
          key={attendanceModal.id}
          shift={attendanceModal}
          loading={attendancePatchMut.isPending}
          onClose={() => setAttendanceModal(null)}
          onSubmit={(values) =>
            attendancePatchMut.mutate({
              shiftId: attendanceModal.id,
              body: attendanceFormValuesToPatchBody(values),
            })
          }
        />
      ) : null}

      {shiftModal ? (
        <ShiftModal
          key={
            shiftModal === "create" ? `create-${prefillDate}` : shiftModal.id
          }
          mode={shiftModal === "create" ? "create" : "edit"}
          initial={shiftModal === "create" ? null : shiftModal}
          defaultEmployeeId={id}
          defaultWorkDate={
            shiftModal === "create" ? prefillDate || undefined : undefined
          }
          onClose={() => {
            setShiftModal(null);
            setPrefillDate("");
          }}
          loading={createShiftMut.isPending || updateShiftMut.isPending}
          onSubmit={(values) => {
            if (shiftModal === "create") {
              createShiftMut.mutate(values);
            } else {
              updateShiftMut.mutate({ sid: shiftModal.id, values });
            }
          }}
        />
      ) : null}

      {payModal ? (
        <PaymentModal
          key={payModal === "create" ? "create" : payModal.id}
          mode={payModal === "create" ? "create" : "edit"}
          initial={payModal === "create" ? null : payModal}
          onClose={() => setPayModal(null)}
          loading={createPayMut.isPending || updatePayMut.isPending}
          onSubmit={(values) => {
            if (payModal === "create") {
              createPayMut.mutate({ employeeId: id, values });
            } else {
              updatePayMut.mutate({ pid: payModal.id, values });
            }
          }}
        />
      ) : null}
    </div>
  );
}

function Field({
  label,
  error,
  input,
  unsavedChange,
}: {
  label: string;
  error?: string;
  input: ReactNode;
  /** Alteração local ainda não enviada ao servidor (formulário de dados). */
  unsavedChange?: boolean;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        {unsavedChange ? (
          <span className="shrink-0 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Não guardado
          </span>
        ) : null}
      </div>
      <div className="mt-1">{input}</div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

const controlClassModal =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

function ShiftModal({
  mode,
  initial,
  defaultEmployeeId,
  defaultWorkDate,
  onClose,
  loading,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial: HrWorkShift | null;
  defaultEmployeeId: string;
  defaultWorkDate?: string;
  onClose: () => void;
  loading: boolean;
  onSubmit: (v: ShiftFormValues) => void;
}) {
  const { data: employees } = useQuery({
    queryKey: hrQueryKeys.employees({ limit: 500, offset: 0 }),
    queryFn: () => fetchEmployees({ limit: 500, offset: 0 }),
  });

  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: initial
      ? {
          employeeId: initial.employeeId,
          workDate: initial.workDate,
          startTime: initial.startTime,
          endTime: initial.endTime,
          locationOrStation: initial.locationOrStation ?? "",
          notes: initial.notes ?? "",
        }
      : {
          employeeId: defaultEmployeeId,
          workDate:
            defaultWorkDate ??
            getCivilMonthRangeIso(
              getCurrentYearMonthLisbon().year,
              getCurrentYearMonthLisbon().month,
            ).from,
          startTime: "09:00",
          endTime: "17:00",
          locationOrStation: "",
          notes: "",
        },
  });

  return (
    <Modal
      title={mode === "create" ? "Novo turno" : "Editar turno"}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="shift-form"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "A guardar…" : "Guardar"}
          </button>
        </div>
      }
    >
      <form
        id="shift-form"
        className="space-y-3"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <Field
          label="Funcionário *"
          error={form.formState.errors.employeeId?.message}
          input={
            <select
              className={controlClassModal}
              {...form.register("employeeId")}
            >
              {(employees ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </select>
          }
        />
        <Field
          label="Data *"
          error={form.formState.errors.workDate?.message}
          input={
            <input
              type="date"
              className={controlClassModal}
              {...form.register("workDate")}
            />
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Início *"
            error={form.formState.errors.startTime?.message}
            input={
              <input
                className={controlClassModal}
                {...form.register("startTime")}
              />
            }
          />
          <Field
            label="Fim *"
            error={form.formState.errors.endTime?.message}
            input={
              <input
                className={controlClassModal}
                {...form.register("endTime")}
              />
            }
          />
        </div>
        <Field
          label="Local / estação"
          error={form.formState.errors.locationOrStation?.message}
          input={
            <input
              className={controlClassModal}
              {...form.register("locationOrStation")}
            />
          }
        />
        <Field
          label="Notas"
          error={form.formState.errors.notes?.message}
          input={
            <textarea
              className={`${controlClassModal} min-h-[72px]`}
              {...form.register("notes")}
            />
          }
        />
      </form>
    </Modal>
  );
}

function PaymentModal({
  mode,
  initial,
  onClose,
  loading,
  onSubmit,
}: {
  mode: "create" | "edit";
  initial: HrEmployeePayment | null;
  onClose: () => void;
  loading: boolean;
  onSubmit: (v: PaymentFormValues) => void;
}) {
  const ymNow = getCurrentYearMonthLisbon();
  const defaultSalaryPeriod = formatYearMonth(ymNow.year, ymNow.month);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: initial
      ? {
          paymentDate: initial.paymentDate,
          amount: initial.amount,
          paymentType: initial.paymentType,
          notes: initial.notes ?? "",
          salaryPeriod:
            salaryPeriodValueFromPayment(initial) || defaultSalaryPeriod,
        }
      : {
          paymentDate: getCivilMonthRangeIso(ymNow.year, ymNow.month).from,
          amount: 0,
          paymentType: "salary",
          notes: "",
          salaryPeriod: defaultSalaryPeriod,
        },
  });

  const paymentType = useWatch({
    control: form.control,
    name: "paymentType",
  });

  return (
    <Modal
      title={mode === "create" ? "Novo pagamento" : "Editar pagamento"}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="pay-form"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "A guardar…" : "Guardar"}
          </button>
        </div>
      }
    >
      <form
        id="pay-form"
        className="space-y-3"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <Field
          label="Data do pagamento *"
          error={form.formState.errors.paymentDate?.message}
          input={
            <input
              type="date"
              className={controlClassModal}
              {...form.register("paymentDate")}
            />
          }
        />
        <Field
          label="Valor (EUR) *"
          error={form.formState.errors.amount?.message}
          input={
            <input
              className={controlClassModal}
              type="number"
              step="0.01"
              {...form.register("amount", { valueAsNumber: true })}
            />
          }
        />
        <Field
          label="Tipo *"
          error={form.formState.errors.paymentType?.message}
          input={
            <select
              className={controlClassModal}
              {...form.register("paymentType")}
            >
              <option value="salary">Salário</option>
              <option value="bonus">Bónus</option>
              <option value="deduction">Desconto</option>
              <option value="other">Outro</option>
            </select>
          }
        />
        {(paymentType === "salary" || paymentType === "bonus") ? (
          <Field
            label={paymentType === "salary" ? "Salário referente a *" : "Mês de referência"}
            error={form.formState.errors.salaryPeriod?.message}
            input={
              <input
                type="month"
                className={controlClassModal}
                {...form.register("salaryPeriod")}
              />
            }
          />
        ) : null}
        <Field
          label="Notas"
          error={form.formState.errors.notes?.message}
          input={
            <textarea
              className={`${controlClassModal} min-h-[72px]`}
              {...form.register("notes")}
            />
          }
        />
      </form>
    </Modal>
  );
}
