import type { Position } from "../entities/position.ts";

/** Forma mínima de um local que este serviço precisa — o RH não depende do tipo do módulo `locations`. */
export interface LocationOption {
  id: string;
  name: string;
  isActive: boolean;
}

/** Nome do cargo, ou "—" quando não há cargo (ou ainda não carregou). */
export function positionNameOf(positions: Position[], positionId: string | null): string {
  if (!positionId) return "—";
  return positions.find((p) => p.id === positionId)?.name ?? "—";
}

export function locationNameOf(locations: LocationOption[], locationId: string | null): string {
  if (!locationId) return "—";
  return locations.find((l) => l.id === locationId)?.name ?? "—";
}

/**
 * Opções de um seletor de atribuição: só ativos, mais o valor atual mesmo
 * que entretanto inativado (quem já o tem mantém-no — mesma regra do
 * backend), assinalado como inativo.
 */
export function assignableOptions<T extends { id: string; name: string }>(
  items: T[],
  isActive: (item: T) => boolean,
  currentIds: string[],
): { id: string; label: string }[] {
  return items
    .filter((item) => isActive(item) || currentIds.includes(item.id))
    .map((item) => ({ id: item.id, label: isActive(item) ? item.name : `${item.name} (inativo)` }));
}

/** Outros locais autorizados nunca incluem o principal, nem repetidos. */
export function normalizeAuthorizedLocations(authorized: string[], primaryLocationId: string | null): string[] {
  return [...new Set(authorized)].filter((id) => id !== primaryLocationId);
}
