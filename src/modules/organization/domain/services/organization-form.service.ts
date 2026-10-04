import type {
  EditableOrganizationField,
  OrganizationFormValues,
  OrganizationProfile,
  OrganizationProfileChanges,
} from "../entities/organization-profile.ts";

const EDITABLE_FIELDS: EditableOrganizationField[] = [
  "name",
  "legalName",
  "nif",
  "niss",
  "address",
  "postalCode",
  "city",
  "country",
  "email",
  "phone",
  "website",
  "timezone",
];

/** Campos que o backend exige como texto não-nulo — nunca enviados como `null`. */
const NON_NULLABLE_FIELDS = new Set<EditableOrganizationField>(["name", "legalName", "nif", "country", "timezone"]);

export function toFormValues(profile: OrganizationProfile): OrganizationFormValues {
  const values = {} as OrganizationFormValues;
  for (const field of EDITABLE_FIELDS) values[field] = profile[field] ?? "";
  return values;
}

/**
 * Só os campos que mudaram (comparação após `trim`). Um opcional esvaziado
 * vai como `null` (limpar o valor); um obrigatório esvaziado vai como `""`
 * para o backend o rejeitar com erro no próprio campo.
 */
export function diffChanges(profile: OrganizationProfile, values: OrganizationFormValues): OrganizationProfileChanges {
  const changes: OrganizationProfileChanges = {};
  for (const field of EDITABLE_FIELDS) {
    const next = values[field].trim();
    const current = (profile[field] ?? "").trim();
    if (next === current) continue;
    changes[field] = next === "" && !NON_NULLABLE_FIELDS.has(field) ? null : next;
  }
  return changes;
}

export function hasChanges(changes: OrganizationProfileChanges): boolean {
  return Object.keys(changes).length > 0;
}

export const LOGO_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/** Devolve a mensagem de erro, ou `null` se o ficheiro é aceitável. */
export function validateLogoFile(file: { type: string; size: number }): string | null {
  if (!LOGO_ACCEPTED_TYPES.includes(file.type)) return "Formato não suportado — use JPG, PNG, WEBP ou SVG.";
  if (file.size > LOGO_MAX_BYTES) return "O logotipo não pode ter mais de 2 MB.";
  return null;
}
