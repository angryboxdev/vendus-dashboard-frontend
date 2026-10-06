import type { LocationDTO, LocationField, LocationFormValues, LocationHistoryEntry, LocationPayload } from "../entities/location.ts";
import { LOCATION_FIELD_LABELS } from "../entities/location.ts";

const FIELDS: LocationField[] = ["name", "code", "address", "postalCode", "city", "municipality", "country", "timezone", "phone"];
/** O backend exige texto não-nulo nestes campos — nunca enviados como `null`. */
const NON_NULLABLE = new Set<LocationField>(["name", "country", "timezone"]);

export const EMPTY_LOCATION_FORM: LocationFormValues = {
  name: "",
  code: "",
  address: "",
  postalCode: "",
  city: "",
  municipality: "",
  country: "PT",
  timezone: "Europe/Lisbon",
  phone: "",
};

export function toLocationFormValues(location: LocationDTO): LocationFormValues {
  const values = { ...EMPTY_LOCATION_FORM };
  for (const field of FIELDS) values[field] = location[field] ?? "";
  return values;
}

function toPayloadValue(field: LocationField, raw: string): string | null {
  const value = raw.trim();
  return value === "" && !NON_NULLABLE.has(field) ? null : value;
}

/** Criação: todos os campos. */
export function toCreatePayload(values: LocationFormValues): LocationPayload {
  const payload: LocationPayload = {};
  for (const field of FIELDS) payload[field] = toPayloadValue(field, values[field]);
  return payload;
}

/** Edição: só os campos que mudaram (comparação após trim). */
export function toUpdatePayload(location: LocationDTO, values: LocationFormValues): LocationPayload {
  const payload: LocationPayload = {};
  for (const field of FIELDS) {
    if (values[field].trim() === (location[field] ?? "").trim()) continue;
    payload[field] = toPayloadValue(field, values[field]);
  }
  return payload;
}

/** Ativos primeiro, depois por nome — inativos ficam no fim da lista de gestão. */
export function sortLocationsForAdmin(locations: LocationDTO[]): LocationDTO[] {
  return [...locations].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, "pt"));
}

const ACTION_LABELS: Record<string, string> = {
  create: "Local criado",
  update: "Dados alterados",
  activate: "Local ativado",
  deactivate: "Local inativado",
  geofence: "Zona de picagem alterada",
};

export function locationHistoryLabel(entry: LocationHistoryEntry): string {
  const label = ACTION_LABELS[entry.action] ?? entry.action;
  if (entry.action !== "update") return label;
  const before = (entry.before ?? {}) as Record<string, unknown>;
  const after = (entry.after ?? {}) as Record<string, unknown>;
  const changed = FIELDS.filter((f) => (before[f] ?? null) !== (after[f] ?? null)).map((f) => LOCATION_FIELD_LABELS[f]);
  return changed.length > 0 ? `${label} — ${changed.join(", ")}` : label;
}
