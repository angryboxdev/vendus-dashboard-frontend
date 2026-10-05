import { apiDeleteNoContent, apiGet, apiPatch, apiPost } from "../../../../lib/api.ts";
import type {
  CalendarFilter,
  CalendarItem,
  EventInput,
  HolidayImportRow,
  HolidayInput,
} from "../../domain/entities/calendar-item.ts";
import type { CalendarApiPort } from "../../domain/ports/out/calendar-api.port.ts";

const BASE = "/api/calendar";

export class HttpCalendarApiAdapter implements CalendarApiPort {
  list(from: string, to: string, filter: CalendarFilter): Promise<CalendarItem[]> {
    const q = new URLSearchParams({ from, to });
    if (filter.kind) q.set("kinds", filter.kind);
    if (filter.locationId) q.set("locationId", filter.locationId);
    if (filter.priority) q.set("priority", filter.priority);
    return apiGet<CalendarItem[]>(`${BASE}?${q.toString()}`);
  }

  upcoming(): Promise<CalendarItem[]> {
    return apiGet<CalendarItem[]>(`${BASE}/upcoming`);
  }

  async createHoliday(input: HolidayInput): Promise<void> {
    await apiPost(`${BASE}/holidays`, input);
  }

  async updateHoliday(id: string, input: Partial<HolidayInput>): Promise<void> {
    await apiPatch(`${BASE}/holidays/${encodeURIComponent(id)}`, input);
  }

  deleteHoliday(id: string): Promise<void> {
    return apiDeleteNoContent(`${BASE}/holidays/${encodeURIComponent(id)}`);
  }

  previewHolidayImport(year: number): Promise<HolidayImportRow[]> {
    return apiPost<HolidayImportRow[]>(`${BASE}/holidays/import/preview`, { country: "PT", year });
  }

  importHolidays(year: number): Promise<{ created: number; skipped: number }> {
    return apiPost<{ created: number; skipped: number }>(`${BASE}/holidays/import`, { country: "PT", year });
  }

  async createEvent(input: EventInput): Promise<void> {
    await apiPost(`${BASE}/events`, input);
  }

  async updateEvent(id: string, input: Partial<EventInput>): Promise<void> {
    await apiPatch(`${BASE}/events/${encodeURIComponent(id)}`, input);
  }

  async cancelEvent(id: string): Promise<void> {
    await apiPatch(`${BASE}/events/${encodeURIComponent(id)}/cancel`, {});
  }
}
