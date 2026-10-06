import type {
  CalendarFilter,
  CalendarItem,
  EventInput,
  HolidayImportRow,
  HolidayInput,
} from "../../domain/entities/calendar-item.ts";
import type { CalendarApiPort } from "../../domain/ports/out/calendar-api.port.ts";

/**
 * Casos de uso do calendário. A lógica de negócio (deduplicação,
 * visibilidade, validações) vive no backend; aqui só se orquestra o pedido.
 * Agrupados numa classe por serem finos — uma por intenção seria só ruído.
 */
export class CalendarUseCases {
  private readonly api: CalendarApiPort;

  constructor(api: CalendarApiPort) {
    this.api = api;
  }

  list(from: string, to: string, filter: CalendarFilter): Promise<CalendarItem[]> {
    return this.api.list(from, to, filter);
  }

  upcoming(): Promise<CalendarItem[]> {
    return this.api.upcoming();
  }

  saveHoliday(id: string | null, input: HolidayInput): Promise<void> {
    return id ? this.api.updateHoliday(id, input) : this.api.createHoliday(input);
  }

  deleteHoliday(id: string): Promise<void> {
    return this.api.deleteHoliday(id);
  }

  previewHolidayImport(year: number): Promise<HolidayImportRow[]> {
    return this.api.previewHolidayImport(year);
  }

  importHolidays(year: number): Promise<{ created: number; skipped: number }> {
    return this.api.importHolidays(year);
  }

  saveEvent(id: string | null, input: EventInput): Promise<void> {
    return id ? this.api.updateEvent(id, input) : this.api.createEvent(input);
  }

  cancelEvent(id: string): Promise<void> {
    return this.api.cancelEvent(id);
  }
}
