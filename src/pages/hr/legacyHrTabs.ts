import { canOpenPath } from "../../modules/access/domain/services/access-ui.service.ts";
import type { UserAccess } from "../../contexts/AuthContext.tsx";

/** "RH antigo": os ecrãs anteriores, lado a lado (mesmas rotas e permissões de sempre). */
export const LEGACY_HR_TABS: { path: string; label: string; also?: string[] }[] = [
  { path: "/hr/overview", label: "Visão Geral" },
  { path: "/hr/people", label: "Colaboradores", also: ["/hr/employees"] },
  { path: "/hr/schedules", label: "Escalas & Turnos", also: ["/hr/calendar"] },
  { path: "/hr/ferias", label: "Férias & Ausências" },
  { path: "/hr/assiduidade", label: "Assiduidade" },
  { path: "/hr/pedidos", label: "Caixa de pedidos" },
  { path: "/hr/historico", label: "Histórico de alterações" },
];

/** Separadores que o utilizador pode abrir (sem acesso carregado: todos, como antes; o backend decide sempre). */
export function legacyTabsFor(access: UserAccess | null) {
  if (!access) return LEGACY_HR_TABS;
  return LEGACY_HR_TABS.filter((t) => canOpenPath({ isAdmin: access.isAdmin, portalOnly: access.portalOnly, permissions: { ...access.permissions } }, t.path));
}

/** Destino de "/hr": o Novo RH para quem o pode abrir; senão o primeiro ecrã antigo permitido. */
export function hrHomeFor(access: UserAccess | null, legacyOnly = false): string {
  if (!legacyOnly && access && canOpenPath({ isAdmin: access.isAdmin, portalOnly: access.portalOnly, permissions: { ...access.permissions } }, "/hr/novo")) return "/hr/novo";
  return legacyTabsFor(access)[0]?.path ?? "/hr/overview";
}
