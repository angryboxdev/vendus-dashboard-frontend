import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";

import { formatIsoDatePt } from "../../../lib/format";
import {
  SHIFT_ATTENDANCE_STATUS_LABELS,
  type HrWorkShift,
  type ShiftAttendanceStatus,
} from "../hr.types";
import {
  attendanceFormSchema,
  type AttendanceFormValues,
} from "../hrSchemas";
import { toTimeInputValue } from "../weeklyScheduleUtils";

const controlClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

function attendanceDefaults(shift: HrWorkShift): AttendanceFormValues {
  const a = shift.attendance;
  if (!a) {
    return {
      status: "worked_as_planned",
      actualStartTime: "",
      actualEndTime: "",
      lateMinutes: "",
      notes: "",
    };
  }
  return {
    status: a.status,
    actualStartTime: a.actualStartTime
      ? toTimeInputValue(a.actualStartTime)
      : "",
    actualEndTime: a.actualEndTime ? toTimeInputValue(a.actualEndTime) : "",
    lateMinutes: a.lateMinutes != null ? String(a.lateMinutes) : "",
    notes: a.notes ?? "",
  };
}

const STATUS_ORDER: ShiftAttendanceStatus[] = [
  "worked_as_planned",
  "late",
  "left_early",
  "cancelled",
];

export function AttendanceConferenceModal({
  shift,
  onClose,
  loading,
  onSubmit,
}: {
  shift: HrWorkShift;
  onClose: () => void;
  loading: boolean;
  onSubmit: (values: AttendanceFormValues) => void;
}) {
  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: attendanceDefaults(shift),
  });

  useEffect(() => {
    form.reset(attendanceDefaults(shift));
  }, [shift, form]);

  const status = useWatch({ control: form.control, name: "status" });

  useEffect(() => {
    if (status !== "late") {
      form.setValue("lateMinutes", "");
    }
    if (status === "cancelled") {
      form.setValue("actualStartTime", "");
      form.setValue("actualEndTime", "");
    }
  }, [status, form]);

  const showActualTimes =
    status === "worked_as_planned" ||
    status === "late" ||
    status === "left_early";
  const showLateMinutes = status === "late";

  return (
    <ModalShell
      title="Conferência de turno"
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
            form="attendance-form"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "A guardar…" : "Guardar conferência"}
          </button>
        </div>
      }
    >
      <p className="text-sm text-slate-600">
        <span className="font-medium text-slate-800">Planeado:</span>{" "}
        {formatIsoDatePt(shift.workDate)} · {shift.startTime} –{" "}
        {shift.endTime}
      </p>
      <form
        id="attendance-form"
        className="mt-4 space-y-3"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <Field
          label="Estado da conferência *"
          error={form.formState.errors.status?.message}
          input={
            <select className={controlClass} {...form.register("status")}>
              {STATUS_ORDER.map((v) => (
                <option key={v} value={v}>
                  {SHIFT_ATTENDANCE_STATUS_LABELS[v]}
                </option>
              ))}
            </select>
          }
        />

        {showLateMinutes ? (
          <Field
            label="Minutos de atraso"
            error={form.formState.errors.lateMinutes?.message}
            input={
              <input
                className={controlClass}
                type="number"
                min={0}
                step={1}
                placeholder="ex.: 15"
                {...form.register("lateMinutes")}
              />
            }
          />
        ) : null}

        {showActualTimes ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Início real"
              error={form.formState.errors.actualStartTime?.message}
              input={
                <input
                  type="time"
                  className={controlClass}
                  {...form.register("actualStartTime")}
                />
              }
            />
            <Field
              label="Fim real"
              error={form.formState.errors.actualEndTime?.message}
              input={
                <input
                  type="time"
                  className={controlClass}
                  {...form.register("actualEndTime")}
                />
              }
            />
          </div>
        ) : null}

        <Field
          label="Notas (conferência)"
          error={form.formState.errors.notes?.message}
          input={
            <textarea
              className={`${controlClass} min-h-[64px]`}
              {...form.register("notes")}
            />
          }
        />
      </form>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2
            id="attendance-modal-title"
            className="text-lg font-semibold text-slate-900"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer ? (
          <div className="border-t border-slate-100 px-4 py-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  input,
}: {
  label: string;
  error?: string;
  input: ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="mt-1">{input}</div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
