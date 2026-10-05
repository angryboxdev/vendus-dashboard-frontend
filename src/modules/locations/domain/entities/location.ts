/**
 * A location (store/restaurant/space) belonging to the caller's
 * organization — espelho de `LocationDto` (backend). Desde a Base
 * Organizacional (ticket 02) é gerida pelo admin em Empresa & Estrutura →
 * Locais (criar, editar, ativar/inativar; nunca apagar).
 */
export interface LocationDTO {
  id: string;
  name: string;
  /** Código interno opcional. */
  code: string | null;
  timezone: string;
  isActive: boolean;
  address: string | null;
  postalCode: string | null;
  /** Localidade. */
  city: string | null;
  municipality: string | null;
  /** ISO 3166-1 alpha-2. */
  country: string;
  phone: string | null;
}

export type LocationField = "name" | "code" | "address" | "postalCode" | "city" | "municipality" | "country" | "timezone" | "phone";

/** Valores do formulário de criação/edição — tudo string (vazio = sem valor). */
export type LocationFormValues = Record<LocationField, string>;

/** Corpo enviado ao backend (criação: todos; edição: só os alterados). */
export type LocationPayload = Partial<Record<LocationField, string | null>>;

export const LOCATION_FIELD_LABELS: Record<LocationField, string> = {
  name: "Nome",
  code: "Código interno",
  address: "Morada",
  postalCode: "Código postal",
  city: "Localidade",
  municipality: "Município",
  country: "País",
  timezone: "Fuso horário",
  phone: "Telefone",
};

/** Países de operação atuais — o backend aceita qualquer código ISO de 2 letras. */
export const LOCATION_COUNTRY_OPTIONS: { code: string; label: string }[] = [
  { code: "PT", label: "Portugal" },
  { code: "ES", label: "Espanha" },
];

export const LOCATION_TIMEZONE_OPTIONS: string[] = ["Europe/Lisbon", "Atlantic/Madeira", "Atlantic/Azores", "Europe/Madrid", "Atlantic/Canary"];

export interface LocationFieldError {
  field: string;
  message: string;
}

export interface LocationHistoryEntry {
  id: string;
  createdAt: string;
  action: string;
  actor: string;
  before: unknown;
  after: unknown;
}

/** 400/409 do backend com erros por campo. */
export class LocationValidationError extends Error {
  readonly fieldErrors: LocationFieldError[];

  constructor(fieldErrors: LocationFieldError[]) {
    super("Há campos inválidos no local");
    this.name = "LocationValidationError";
    this.fieldErrors = fieldErrors;
  }
}
