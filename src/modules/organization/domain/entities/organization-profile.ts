export type OrganizationStatus = "active" | "inactive";

/** Espelho de `OrganizationProfileDTO` (backend, módulo `organization`). */
export interface OrganizationProfile {
  id: string;
  /** Nome comercial. */
  name: string;
  /** Razão social — `null` em organizações provisionadas antes da Base Organizacional. */
  legalName: string | null;
  nif: string;
  niss: string | null;
  /** Morada fiscal. */
  address: string | null;
  postalCode: string | null;
  city: string | null;
  /** ISO 3166-1 alpha-2. */
  country: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  timezone: string;
  /** URL assinado temporário (1 h). */
  logoUrl: string | null;
  status: OrganizationStatus;
  updatedAt: string;
}

export type EditableOrganizationField =
  | "name"
  | "legalName"
  | "nif"
  | "niss"
  | "address"
  | "postalCode"
  | "city"
  | "country"
  | "email"
  | "phone"
  | "website"
  | "timezone";

/** Alteração parcial — só os campos que mudaram são enviados ao backend. */
export type OrganizationProfileChanges = Partial<Record<EditableOrganizationField, string | null>>;

/** Valores do formulário: tudo string (vazio = sem valor). */
export type OrganizationFormValues = Record<EditableOrganizationField, string>;

export const ORGANIZATION_STATUS_LABELS: Record<OrganizationStatus, string> = {
  active: "Ativa",
  inactive: "Inativa",
};

export const ORGANIZATION_FIELD_LABELS: Record<EditableOrganizationField, string> = {
  name: "Nome comercial",
  legalName: "Razão social",
  nif: "NIF",
  niss: "NISS",
  address: "Morada fiscal",
  postalCode: "Código postal",
  city: "Localidade",
  country: "País",
  email: "Email",
  phone: "Telefone",
  website: "Website",
  timezone: "Fuso horário",
};

/** Países de operação atuais — o backend aceita qualquer código ISO de 2 letras. */
export const COUNTRY_OPTIONS: { code: string; label: string }[] = [
  { code: "PT", label: "Portugal" },
  { code: "ES", label: "Espanha" },
];

export const TIMEZONE_OPTIONS: string[] = ["Europe/Lisbon", "Atlantic/Madeira", "Atlantic/Azores", "Europe/Madrid", "Atlantic/Canary"];

export interface OrganizationFieldError {
  field: string;
  message: string;
}

export interface OrganizationHistoryEntry {
  id: string;
  createdAt: string;
  action: string;
  actor: string;
  before: unknown;
  after: unknown;
}
