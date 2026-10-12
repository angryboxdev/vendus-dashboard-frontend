import { apiGet, apiWrite } from "../../../../lib/api.ts";
import type { DeletePreview, HolidayCalendar, HolidayDay, ScheduleVersion, TheoreticalDay, TimeAssignment, VacationCalendar, WorkSchedule } from "../../domain/entities/time.ts";
import type { TimeApiPort, VersionInput } from "../../domain/ports/out/time-api.port.ts";

const T = "/api/novo-rh/time";
const path = (type: "holiday" | "vacation") => (type === "holiday" ? "holiday-calendars" : "vacation-calendars");

export class HttpTimeApiAdapter implements TimeApiPort {
  listSchedules() {
    return apiGet<WorkSchedule[]>(`${T}/schedules`);
  }
  async createSchedule(input: { name: string; kind: WorkSchedule["kind"]; version: VersionInput }) {
    return (await apiWrite<WorkSchedule>(`${T}/schedules`, { body: input })).data;
  }
  async addVersion(scheduleId: string, version: VersionInput) {
    return (await apiWrite<ScheduleVersion>(`${T}/schedules/${scheduleId}/versions`, { body: version })).data;
  }
  async archiveSchedule(id: string) {
    await apiWrite(`${T}/schedules/${id}/archive`, {});
  }

  listHolidayCalendars() {
    return apiGet<HolidayCalendar[]>(`${T}/holiday-calendars`);
  }
  async createHolidayCalendar(input: Omit<HolidayCalendar, "id" | "days">) {
    return (await apiWrite<HolidayCalendar>(`${T}/holiday-calendars`, { body: input })).data;
  }
  async addHoliday(calendarId: string, input: Omit<HolidayDay, "id" | "calendarId">) {
    return (await apiWrite<HolidayDay>(`${T}/holiday-calendars/${calendarId}/days`, { body: input })).data;
  }
  async updateHoliday(id: string, patch: Partial<Pick<HolidayDay, "status" | "name" | "coefficient" | "source">>) {
    return (await apiWrite<HolidayDay>(`${T}/holidays/${id}`, { method: "PATCH", body: patch })).data;
  }
  async removeHoliday(id: string) {
    await apiWrite(`${T}/holidays/${id}/remove`, {});
  }
  async importNational(calendarId: string, year: number) {
    return (await apiWrite<{ added: number; skipped: number }>(`${T}/holiday-calendars/${calendarId}/import`, { body: { year } })).data;
  }

  listVacationCalendars() {
    return apiGet<VacationCalendar[]>(`${T}/vacation-calendars`);
  }
  async createVacationCalendar(input: Omit<VacationCalendar, "id">) {
    return (await apiWrite<VacationCalendar>(`${T}/vacation-calendars`, { body: input })).data;
  }

  deletePreview(type: "holiday" | "vacation", id: string) {
    return apiGet<DeletePreview>(`${T}/${path(type)}/${id}/delete-preview`);
  }
  async deleteCalendar(type: "holiday" | "vacation", id: string, confirmName: string) {
    return (await apiWrite<DeletePreview>(`${T}/${path(type)}/${id}/delete`, { body: { confirmName } })).data;
  }

  listAssignments() {
    return apiGet<TimeAssignment[]>(`${T}/assignments`);
  }
  async assign(input: Omit<TimeAssignment, "id">) {
    return (await apiWrite<TimeAssignment>(`${T}/assignments`, { body: input })).data;
  }
  async endAssignment(id: string, validTo: string) {
    return (await apiWrite<TimeAssignment>(`${T}/assignments/${id}/end`, { body: { validTo } })).data;
  }

  theoretical(employeeId: string, from: string, to: string) {
    return apiGet<{ days: TheoreticalDay[]; totalMinutes: number }>(`${T}/theoretical?employeeId=${encodeURIComponent(employeeId)}&from=${from}&to=${to}`);
  }
}
