import type {
  CalendarFilter,
  CalendarItem,
  EventInput,
  HolidayImportRow,
  HolidayInput,
} from "../../entities/calendar-item.ts";

/** Contrato com `/api/calendar*` (backend, módulo `calendar`). */
export interface CalendarApiPort {
  list(from: string, to: string, filter: CalendarFilter): Promise<CalendarItem[]>;
  upcoming(): Promise<CalendarItem[]>;
  createHoliday(input: HolidayInput): Promise<void>;
  updateHoliday(id: string, input: Partial<HolidayInput>): Promise<void>;
  deleteHoliday(id: string): Promise<void>;
  previewHolidayImport(year: number): Promise<HolidayImportRow[]>;
  importHolidays(year: number): Promise<{ created: number; skipped: number }>;
  createEvent(input: EventInput): Promise<void>;
  updateEvent(id: string, input: Partial<EventInput>): Promise<void>;
  cancelEvent(id: string): Promise<void>;
}
