import type { AccessLevel, CatalogModule, ModuleState, PermissionMap, UserListItem } from "../entities/access.ts";

/**
 * Regras puras de apresentação de permissões. O backend continua a ser a
 * fonte de verdade de cada pedido — isto só adapta menus e ecrãs.
 */

const RANK: Record<AccessLevel, number> = { NONE: 0, READ: 1, MANAGE: 2 };

export const LEVEL_LABELS: Record<AccessLevel, string> = { NONE: "Sem acesso", READ: "Ver", MANAGE: "Gerir" };
export const MODULE_STATE_LABELS: Record<ModuleState, string> = {
  none: "Sem acesso",
  read_all: "Ver tudo",
  manage_all: "Gerir tudo",
  mixed: "Parcial",
};

export function hasLevel(permissions: PermissionMap, key: string, level: Exclude<AccessLevel, "NONE">): boolean {
  return RANK[permissions[key] ?? "NONE"] >= RANK[level];
}

/** Permissão efetiva = exceção ?? perfil ?? NONE (herança dinâmica). */
export function effectiveOf(profile: PermissionMap, overrides: PermissionMap, isAdmin: boolean, catalog: CatalogModule[]): PermissionMap {
  const out: PermissionMap = {};
  for (const mod of catalog) {
    for (const f of [...mod.functions, ...mod.specials]) out[f.key] = isAdmin ? "MANAGE" : (overrides[f.key] ?? profile[f.key] ?? "NONE");
  }
  return out;
}

export function moduleStateOf(mod: CatalogModule, effective: PermissionMap): ModuleState {
  const levels = mod.functions.map((f) => effective[f.key] ?? "NONE");
  if (levels.every((l) => l === "NONE")) return "none";
  if (levels.every((l) => l === "MANAGE")) return "manage_all";
  if (levels.every((l) => l === "READ")) return "read_all";
  return "mixed";
}

export function moduleCustomized(mod: CatalogModule, overrides: PermissionMap): boolean {
  return [...mod.functions, ...mod.specials].some((f) => f.key in overrides);
}

export function grantedCount(mod: CatalogModule, effective: PermissionMap): number {
  return mod.functions.filter((f) => (effective[f.key] ?? "NONE") !== "NONE").length;
}

/**
 * Mudar uma funcionalidade num utilizador: se o valor escolhido é igual ao
 * do perfil, não fica exceção (continua a herdar); senão grava exceção.
 */
export function setUserLevel(overrides: PermissionMap, profile: PermissionMap, key: string, level: AccessLevel): PermissionMap {
  const next = { ...overrides };
  if ((profile[key] ?? "NONE") === level) delete next[key];
  else next[key] = level;
  return next;
}

/** "Restaurar padrão": remove a exceção e volta a herdar do perfil. */
export function restoreDefault(overrides: PermissionMap, key: string): PermissionMap {
  const next = { ...overrides };
  delete next[key];
  return next;
}

/** Controlo rápido por módulo (Sem acesso / Ver tudo / Gerir tudo) num utilizador. */
export function setUserModuleLevel(overrides: PermissionMap, profile: PermissionMap, mod: CatalogModule, level: AccessLevel): PermissionMap {
  return mod.functions.reduce((acc, f) => setUserLevel(acc, profile, f.key, level), overrides);
}

/** Controlo rápido por módulo num perfil. */
export function setProfileModuleLevel(permissions: PermissionMap, mod: CatalogModule, level: AccessLevel): PermissionMap {
  const next = { ...permissions };
  for (const f of mod.functions) next[f.key] = level;
  return next;
}

/** Texto da coluna "Acessos" na lista de utilizadores. */
export function accessSummary(user: Pick<UserListItem, "isAdmin" | "portalOnly" | "overridesCount" | "modules">): { title: string; detail: string; customized: boolean } {
  if (user.isAdmin) return { title: "Acesso total", detail: "Todos os módulos", customized: false };
  if (user.portalOnly) return { title: "Portal apenas", detail: "Escala · Picagens · Documentos", customized: false };
  const withAccess = user.modules.filter((m) => m.state !== "none").map((m) => m.label);
  const detail = withAccess.length > 3 ? `${withAccess.slice(0, 3).join(" · ")} +${withAccess.length - 3}` : withAccess.join(" · ") || "Sem módulos";
  if (user.overridesCount > 0) return { title: "Personalizado", detail: `${detail} · ${user.overridesCount} ${user.overridesCount === 1 ? "alteração" : "alterações"}`, customized: true };
  return { title: "Padrão do perfil", detail, customized: false };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase() || "?";
}

/** "Hoje, 14:32" / "Ontem, 18:21" / "03/10/2026, 09:14" / "Nunca". */
export function formatLastAccess(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  const time = d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  const day = (x: Date) => x.toLocaleDateString("pt-PT");
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (day(d) === day(now)) return `Hoje, ${time}`;
  if (day(d) === day(yesterday)) return `Ontem, ${time}`;
  return `${day(d)}, ${time}`;
}

/**
 * Rota do frontend → funcionalidade necessária (READ) — espelha o menu.
 * Usado pela barra lateral e pela guarda de rotas. `null` = livre para
 * qualquer utilizador da área de gestão; `"admin"` = só Admin.
 */
/** Uma permissão, "qualquer uma de" (lista), só Admin, ou livre (`null`). */
type PathPermission = string | string[] | "admin" | null;

const PATH_PERMISSIONS: Array<[RegExp, PathPermission]> = [
  [/^\/admin\/(users|access-profiles)/, "admin"],
  [/^\/admin\/location-tokens/, "company.devices"],
  [/^\/(vendus|analytics)/, "sales.dashboard"],
  [/^\/cash-closings/, "sales.cash_closings"],
  [/^\/air-menu/, "sales.air_menu"],
  [/^\/dre\/(demonstrativo|receita-bruta)/, "dre.statement"],
  [/^\/dre\/custos-fixos/, "dre.fixed_costs"],
  [/^\/dre\/custos-variaveis/, "dre.variable_costs"],
  [/^\/stock\/(movimentacoes|historico-movimentos)/, "stock.movements"],
  [/^\/stock\/stock/, "stock.items"],
  [/^\/stock\/pizzas/, "stock.recipes"],
  [/^\/stock\/contagens/, "stock.counts"],
  [/^\/stock\/planeamento/, "stock.planning"],
  [/^\/stock\/compras-por-rever/, "stock.purchase_reviews"],
  [/^\/hr\/overview/, "hr.overview"],
  [/^\/hr\/people/, "hr.employees"],
  [/^\/hr\/schedules/, "hr.schedules"],
  [/^\/hr\/ferias/, "hr.leave"],
  [/^\/hr\/assiduidade/, "hr.attendance"],
  [/^\/hr\/historico/, "hr.history"],
  // Caixa de pedidos: quem decide documentos, faltas ou folgas.
  [/^\/hr\/pedidos/, ["hr.documents", "hr.attendance", "hr.schedules"]],
  [/^\/crm\/parameters/, "crm.settings"],
  [/^\/crm/, "crm.customers"],
  // Declaração de Vendas (Excel do MBS a partir de SAF-T) — o backend classifica-a em Vendas (Ver).
  [/^\/financial\/sales-declaration/, "sales.dashboard"],
  [/^\/financial\/cost-centers/, "finance.cost_centers"],
  [/^\/financial\/suppliers/, "finance.suppliers"],
  [/^\/financial\/invoices/, "finance.invoices"],
  [/^\/financial\/recurrences/, "finance.recurrences"],
  [/^\/financial\/bank-statements/, "finance.banking"],
  [/^\/financial\/accounting/, "finance.accounting"],
];

export function requiredPermissionForPath(path: string): PathPermission {
  for (const [re, perm] of PATH_PERMISSIONS) if (re.test(path)) return perm;
  return null;
}

export function canOpenPath(access: { isAdmin: boolean; portalOnly: boolean; permissions: PermissionMap }, path: string): boolean {
  if (access.portalOnly) return false;
  if (access.isAdmin) return true;
  const perm = requiredPermissionForPath(path);
  if (perm === null) return true;
  if (perm === "admin") return false;
  if (Array.isArray(perm)) return perm.some((p) => hasLevel(access.permissions, p, "READ"));
  return hasLevel(access.permissions, perm, "READ");
}
