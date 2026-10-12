/** Contrato com `/api/novo-rh/time` (backend, módulo time-base). */

export type ScheduleKind = "fixed" | "flexible";
export type Weekday = "1" | "2" | "3" | "4" | "5" | "6" | "7";
export interface TimeRange {
  start: string;
  end: string;
}

export interface ScheduleVersion {
  id: string;
  scheduleId: string;
  validFrom: string;
  validTo: string | null;
  days: Partial<Record<Weekday, TimeRange[] | number>>;
  night: boolean;
  halfDayMinutes: number | null;
}

export interface WorkSchedule {
  id: string;
  name: string;
  kind: ScheduleKind;
  archived: boolean;
  versions: ScheduleVersion[];
}

export type HolidayKind = "national" | "regional" | "municipal" | "custom";
export interface HolidayDay {
  id: string;
  calendarId: string;
  date: string;
  name: string;
  kind: HolidayKind;
  status: "to_confirm" | "confirmed";
  coefficient: number | null;
  source: string | null;
}

export interface HolidayCalendar {
  id: string;
  name: string;
  country: string | null;
  compensationCoefficient: number;
  approvalRequired: boolean;
  accruedExpires: boolean;
  halfDayCompensation: boolean;
  days: HolidayDay[];
}

export interface VacationCalendar {
  id: string;
  name: string;
  unit: "days" | "hours";
  counting: "working" | "calendar";
  limited: boolean;
  maxAmount: number | null;
  renewal: "calendar_year" | "work_year" | "custom";
  renewalStart: string | null;
  seniorityRules: { afterYears: number; extra: number }[];
  cumulative: boolean;
  halfDay: boolean;
  allowNegative: boolean;
  minConsecutive: number | null;
  maxConsecutive: number | null;
  advanceMonths: number | null;
  blockedDates: string[];
}

export type TimeResource = "schedule" | "holiday_calendar" | "vacation_calendar";
export type TimeTarget = "employee" | "group" | "department" | "location";

export interface TimeAssignment {
  id: string;
  resourceType: TimeResource;
  resourceId: string;
  targetType: TimeTarget;
  targetId: string;
  validFrom: string;
  validTo: string | null;
}

export interface TheoreticalDay {
  date: string;
  minutes: number;
  reason: "schedule" | "contract" | "rest_day" | "holiday" | "no_schedule" | "no_contract_hours";
  scheduleName: string | null;
  holidayName: string | null;
  warnings: ("holiday_to_confirm" | "half_day")[];
}

export interface DeletePreview {
  name: string;
  days: number;
  employees: number;
  assignments: number;
}
