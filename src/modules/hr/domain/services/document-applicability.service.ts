import type { DocumentCategoryDefinition } from "../entities/document-category.ts";
import type { JobRole } from "../entities/employee.ts";

/** O que decide se uma categoria se aplica a um colaborador (mesma regra do backend, `applicableCategoriesFor`). */
export interface CategoryApplicabilitySubject {
  positionId: string | null;
  jobRole: JobRole;
}

/**
 * Ticket 09 — "Todos os colaboradores" ou "Cargos selecionados":
 * ativa, nunca só da Empresa; `positionIds` preenchido → só esses cargos;
 * `jobRoles` (categorias antigas) → pela categoria operacional; vazio → todos.
 */
export function isCategoryApplicable(category: DocumentCategoryDefinition, subject: CategoryApplicabilitySubject): boolean {
  if (!category.active || category.scope === "company") return false;
  if (category.positionIds.length > 0) return subject.positionId !== null && category.positionIds.includes(subject.positionId);
  if (category.jobRoles.length > 0) return category.jobRoles.includes(subject.jobRole);
  return true;
}

export type ValidityFilter = "" | "with" | "without" | "expired" | "next30" | "next90";

export const VALIDITY_FILTER_LABELS: Record<Exclude<ValidityFilter, "">, string> = {
  with: "Com validade",
  without: "Sem validade",
  expired: "Validade ultrapassada",
  next30: "Vence nos próximos 30 dias",
  next90: "Vence nos próximos 90 dias",
};

/** Filtro "Validade" da vista global (ticket 09) — compara datas ISO (AAAA-MM-DD) com o dia de hoje. */
export function matchesValidityFilter(expiresAt: string | null, filter: ValidityFilter, today: string): boolean {
  if (filter === "") return true;
  if (filter === "with") return expiresAt !== null;
  if (filter === "without") return expiresAt === null;
  if (expiresAt === null) return false;
  const day = expiresAt.slice(0, 10);
  if (filter === "expired") return day < today;
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + (filter === "next30" ? 30 : 90));
  return day >= today && day <= limit.toISOString().slice(0, 10);
}
