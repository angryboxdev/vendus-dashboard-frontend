import type {
  DeletePreview,
  HolidayCalendar,
  HolidayDay,
  ScheduleKind,
  ScheduleVersion,
  TheoreticalDay,
  TimeAssignment,
  VacationCalendar,
  WorkSchedule,
} from "../../entities/time.ts";

export type VersionInput = Omit<ScheduleVersion, "id" | "scheduleId">;

/** Novo RH → Tempo. */
export interface TimeApiPort {
  listSchedules(): Promise<WorkSchedule[]>;
  createSchedule(input: { name: string; kind: ScheduleKind; version: VersionInput }): Promise<WorkSchedule>;
  addVersion(scheduleId: string, version: VersionInput): Promise<ScheduleVersion>;
  archiveSchedule(id: string): Promise<void>;

  listHolidayCalendars(): Promise<HolidayCalendar[]>;
  createHolidayCalendar(input: Omit<HolidayCalendar, "id" | "days">): Promise<HolidayCalendar>;
  addHoliday(calendarId: string, input: Omit<HolidayDay, "id" | "calendarId">): Promise<HolidayDay>;
  updateHoliday(id: string, patch: Partial<Pick<HolidayDay, "status" | "name" | "coefficient" | "source">>): Promise<HolidayDay>;
  removeHoliday(id: string): Promise<void>;
  importNational(calendarId: string, year: number): Promise<{ added: number; skipped: number }>;

  listVacationCalendars(): Promise<VacationCalendar[]>;
  createVacationCalendar(input: Omit<VacationCalendar, "id">): Promise<VacationCalendar>;

  deletePreview(type: "holiday" | "vacation", id: string): Promise<DeletePreview>;
  deleteCalendar(type: "holiday" | "vacation", id: string, confirmName: string): Promise<DeletePreview>;

  listAssignments(): Promise<TimeAssignment[]>;
  assign(input: Omit<TimeAssignment, "id">): Promise<TimeAssignment>;
  endAssignment(id: string, validTo: string): Promise<TimeAssignment>;

  theoretical(employeeId: string, from: string, to: string): Promise<{ days: TheoreticalDay[]; totalMinutes: number }>;
}
