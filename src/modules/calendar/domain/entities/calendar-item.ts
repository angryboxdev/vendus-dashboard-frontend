export type CalendarItemKind = "holiday" | "event" | "deadline";
export type HolidayType = "national" | "municipal" | "custom";
export type EventPriority = "normal" | "important" | "critical";
export type EventVisibility = "all" | "management";
export type EventCategory = "meeting" | "audit" | "training" | "maintenance" | "inspection" | "deadline" | "other";

/** Espelho de `CalendarItem` (backend, módulo `calendar`). */
export interface CalendarItem {
  key: string;
  id: string;
  kind: CalendarItemKind;
  date: string;
  title: string;
  locationId: string | null;
  priority: EventPriority | null;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  holidayType?: HolidayType;
  category?: EventCategory;
  description?: string | null;
  responsible?: string | null;
  visibility?: EventVisibility;
  source?: { type: "document"; id: string; category: string };
}

export interface CalendarFilter {
  kind: CalendarItemKind | "";
  locationId: string;
  priority: EventPriority | "";
}

export interface HolidayInput {
  date: string;
  name: string;
  type: HolidayType;
  locationId: string | null;
}

export interface EventInput {
  title: string;
  date: string;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  description: string | null;
  category: EventCategory;
  locationId: string | null;
  priority: EventPriority;
  responsible: string | null;
  visibility: EventVisibility;
}

export interface HolidayImportRow {
  date: string;
  name: string;
  status: "new" | "existing";
}

export const KIND_LABELS: Record<CalendarItemKind, string> = {
  holiday: "Feriados",
  event: "Eventos",
  deadline: "Prazos/Vencimentos",
};

export const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  national: "Nacional",
  municipal: "Municipal/Local",
  custom: "Personalizado",
};

export const PRIORITY_LABELS: Record<EventPriority, string> = {
  normal: "Normal",
  important: "Importante",
  critical: "Crítica",
};

export const VISIBILITY_LABELS: Record<EventVisibility, string> = {
  all: "Todos",
  management: "Gestão",
};

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  meeting: "Reunião",
  audit: "Auditoria",
  training: "Formação",
  maintenance: "Manutenção",
  inspection: "Inspeção",
  deadline: "Prazo",
  other: "Outro",
};
