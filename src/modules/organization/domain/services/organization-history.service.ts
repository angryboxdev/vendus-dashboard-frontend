import {
  ORGANIZATION_FIELD_LABELS,
  type EditableOrganizationField,
  type OrganizationHistoryEntry,
} from "../entities/organization-profile.ts";

const ACTION_LABELS: Record<string, string> = {
  update: "Dados da empresa alterados",
  logo_update: "Logotipo substituído",
};

export function historyActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** Rótulos dos campos que mudaram entre `before` e `after` (só campos editáveis conhecidos). */
export function changedFieldLabels(entry: OrganizationHistoryEntry): string[] {
  if (entry.action !== "update") return [];
  const before = (entry.before ?? {}) as Record<string, unknown>;
  const after = (entry.after ?? {}) as Record<string, unknown>;
  return (Object.keys(ORGANIZATION_FIELD_LABELS) as EditableOrganizationField[])
    .filter((field) => (before[field] ?? null) !== (after[field] ?? null))
    .map((field) => ORGANIZATION_FIELD_LABELS[field]);
}
