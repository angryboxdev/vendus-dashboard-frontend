import { z } from "zod";

import { isStartBeforeEndSameDay, isValidIsoDate } from "./dates";

const isoDate = z.string().refine(isValidIsoDate, "Data inválida (use YYYY-MM-DD)");

const timeStr = z
  .string()
  .trim()
  .regex(
    /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/,
    "Hora inválida (HH:mm ou HH:mm:ss)",
  );

const employmentTypeEnum = z.enum(["permanent", "contract", "extra"]);

const jobRoleEnum = z.enum(["manager", "prep", "service"]);

const optionalDatePicker = z
  .string()
  .refine((s) => s === "" || isValidIsoDate(s), "Data inválida");

export const createEmployeeSchema = z.object({
  fullName: z.string().trim().min(1, "Nome obrigatório"),
  email: z.union([z.literal(""), z.string().email()]),
  phone: z.string().optional().or(z.literal("")),
  roleOrNotes: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]).optional(),
  jobRole: jobRoleEnum,
  employmentType: employmentTypeEnum,
  hiredAt: optionalDatePicker,
  endedAt: optionalDatePicker,
});

export type CreateEmployeeFormValues = z.infer<typeof createEmployeeSchema>;

export const patchEmployeeSchema = createEmployeeSchema.partial();

/** Formulário de edição no detalhe — nome obrigatório, restantes opcionais. */
export const employeeEditSchema = createEmployeeSchema;

export type EmployeeEditFormValues = z.infer<typeof employeeEditSchema>;

export const shiftFormSchema = z
  .object({
    employeeId: z.string().uuid("Selecione um funcionário"),
    workDate: isoDate,
    startTime: timeStr,
    endTime: timeStr,
    locationOrStation: z.string().optional().or(z.literal("")),
    notes: z.string().optional().or(z.literal("")),
  })
  .refine((d) => isStartBeforeEndSameDay(d.startTime, d.endTime), {
    message: "A hora de início deve ser antes do fim (mesmo dia)",
    path: ["endTime"],
  });

export type ShiftFormValues = z.infer<typeof shiftFormSchema>;

export const paymentFormSchema = z
  .object({
    paymentDate: isoDate,
    amount: z
      .number({ error: "Valor inválido" })
      .finite("Valor inválido"),
    paymentType: z.enum(["salary", "bonus", "deduction", "other"]),
    notes: z.string().optional().or(z.literal("")),
    /** `YYYY-MM` para `<input type="month" />`; obrigatório quando o tipo é salário. */
    salaryPeriod: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentType !== "salary") return;
    const raw = data.salaryPeriod.trim();
    const match = /^(\d{4})-(\d{2})$/.exec(raw);
    if (!match) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indique o mês de referência do salário",
        path: ["salaryPeriod"],
      });
      return;
    }
    const monthNum = Number(match[2]);
    if (monthNum < 1 || monthNum > 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Mês inválido",
        path: ["salaryPeriod"],
      });
    }
  });

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

const attendanceStatusEnum = z.enum([
  "worked_as_planned",
  "late",
  "left_early",
  "absent_justified",
  "absent_unjustified",
  "cancelled",
]);

export const attendanceFormSchema = z
  .object({
    status: attendanceStatusEnum,
    actualStartTime: z.string(),
    actualEndTime: z.string(),
    lateMinutes: z.string(),
    absenceReason: z.string(),
    notes: z.string(),
  })
  .superRefine((data, ctx) => {
    const ast = data.actualStartTime.trim();
    const aen = data.actualEndTime.trim();
    if (ast && aen && !isStartBeforeEndSameDay(ast, aen)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Hora de fim real deve ser depois do início (mesmo dia)",
        path: ["actualEndTime"],
      });
    }
    if (data.status === "absent_justified" && !data.absenceReason.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indique o motivo da falta justificada",
        path: ["absenceReason"],
      });
    }
    const lm = data.lateMinutes.trim();
    if (lm !== "") {
      const n = Number(lm);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Use um número inteiro ≥ 0",
          path: ["lateMinutes"],
        });
      }
    }
  });

export type AttendanceFormValues = z.infer<typeof attendanceFormSchema>;
