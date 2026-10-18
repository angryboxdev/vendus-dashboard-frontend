import type { NavItem, SidebarNavEntry } from "../entities/nav-item.ts";
import type { SidebarUser } from "../entities/sidebar-user.ts";
import { canOpenPath } from "../../../access/domain/services/access-ui.service.ts";

const DRE_ITEMS: NavItem[] = [
  { kind: "item", path: "/dre/demonstrativo", label: "Mapa" },
  { kind: "item", path: "/dre/receita-bruta", label: "Receitas" },
  { kind: "item", path: "/dre/custos-fixos", label: "Custos Fixos" },
  { kind: "item", path: "/dre/custos-variaveis", label: "Custos Variáveis" },
];

const STOCK_ITEMS: NavItem[] = [
  { kind: "item", path: "/stock/movimentacoes", label: "Balanço de stock" },
  {
    kind: "item",
    path: "/stock/historico-movimentos",
    label: "Histórico de movimentos",
  },
  { kind: "item", path: "/stock/stock", label: "Itens de stock" },
  { kind: "item", path: "/stock/pizzas", label: "Fichas Técnicas" },
  { kind: "item", path: "/stock/contagens", label: "Contagens de stock" },
  { kind: "item", path: "/stock/planeamento", label: "Planeamento" },
];

/** Ecrãs do RH antigo: juntos em "RH antigo", com separadores no topo (`HrLayout`). */
export const LEGACY_HR_PATHS = ["/hr/overview", "/hr/people", "/hr/schedules", "/hr/calendar", "/hr/ferias", "/hr/assiduidade", "/hr/pedidos", "/hr/historico", "/hr/employees"] as const;

// Recursos Humanos: as áreas do Novo RH são os módulos principais; "RH antigo" fica no fim
// (pedido do utilizador em 2026-10-14: manter visível para consulta).
const HR_ITEMS: NavItem[] = [
  { kind: "item", path: "/hr/novo", label: "Visão geral", end: true, icon: "overview" },
  { kind: "item", path: "/hr/novo/pessoas", label: "Colaboradores", icon: "people" },
  { kind: "item", path: "/hr/novo/escalas", label: "Escalas", icon: "rosters" },
  { kind: "item", path: "/hr/novo/assiduidade", label: "Assiduidade", icon: "attendance" },
  { kind: "item", path: "/hr/novo/ausencias", label: "Ausências", icon: "absences" },
  { kind: "item", path: "/hr/novo/documentos", label: "Documentos", icon: "documents" },
  { kind: "item", path: "/hr/antigo", label: "RH antigo", icon: "legacy", badgeKey: "hr-requests", match: LEGACY_HR_PATHS },
];

const CRM_ITEMS: NavItem[] = [
  { kind: "item", path: "/crm", label: "Dashboard", end: true },
  { kind: "item", path: "/crm/customers", label: "Clientes" },
  { kind: "item", path: "/crm/parameters", label: "Parâmetros" },
];

const FINANCIAL_ITEMS: NavItem[] = [
  { kind: "item", path: "/financial/cost-centers", label: "Centros de Custo" },
  { kind: "item", path: "/financial/suppliers", label: "Fornecedores" },
  { kind: "item", path: "/financial/invoices", label: "Faturas" },
  { kind: "item", path: "/financial/recurrences", label: "Recorrências" },
  { kind: "item", path: "/financial/bank-statements", label: "Conciliação Bancária" },
  { kind: "item", path: "/financial/accounting", label: "Contabilidade" },
  { kind: "item", path: "/financial/sales-declaration", label: "Declaração de Vendas" },
];

export function buildTree(user: SidebarUser): SidebarNavEntry[] {
  const entries: SidebarNavEntry[] = [
    {
      kind: "group",
      id: "dre",
      label: "Mapa de rentabilidade",
      icon: "profitability",
      basePath: "/dre",
      items: DRE_ITEMS,
    },
    {
      kind: "group",
      id: "stock",
      label: "Gestão de Stock",
      icon: "stock",
      basePath: "/stock",
      items: STOCK_ITEMS,
    },
    {
      kind: "group",
      id: "hr",
      label: "Recursos Humanos",
      icon: "people",
      basePath: "/hr",
      items: HR_ITEMS,
    },
    {
      kind: "group",
      id: "crm",
      label: "CRM",
      icon: "crm",
      basePath: "/crm",
      items: CRM_ITEMS,
    },
    {
      kind: "group",
      id: "financial",
      label: "Financeiro",
      icon: "financial",
      basePath: "/financial",
      items: FINANCIAL_ITEMS,
    },
    { kind: "item", path: "/cash-closings", label: "Fechos de Caixa", icon: "cashClosings" },
    { kind: "item", path: "/air-menu", label: "Air Menu", icon: "airMenu" },
    { kind: "item", path: "/vendus", label: "Vendus", icon: "vendus" },
    // Base Organizacional — fora de RH; abas internas (Empresa | …) na própria página.
    { kind: "item", path: "/empresa", label: "Empresa & Estrutura", icon: "company" },
  ];

  entries.push({ kind: "item", path: "/admin/users", label: "Utilizadores", icon: "users" });
  entries.push({ kind: "item", path: "/admin/location-tokens", label: "Tokens de dispositivo", icon: "deviceTokens" });

  const access = user.access;
  // Sem acesso efetivo carregado: comportamento antigo (itens de administração só para admin).
  const allowed = (path: string) =>
    access ? canOpenPath({ isAdmin: access.isAdmin, portalOnly: access.portalOnly, permissions: { ...access.permissions } }, path) : !path.startsWith("/admin") || user.role === "admin";

  return entries.flatMap((entry): SidebarNavEntry[] => {
    if (entry.kind === "item") return allowed(entry.path) ? [entry] : [];
    const items = entry.items.filter((i) => allowed(i.path));
    return items.length > 0 ? [{ ...entry, items }] : [];
  });
}

export function resolveActiveGroup(
  tree: SidebarNavEntry[],
  currentPath: string,
): string | null {
  for (const entry of tree) {
    if (entry.kind === "group" && currentPath.startsWith(entry.basePath)) {
      return entry.id;
    }
  }
  return null;
}

export function isItemActive(
  path: string,
  currentPath: string,
  end = false,
): boolean {
  if (end) return currentPath === path;
  return currentPath === path || currentPath.startsWith(path + "/");
}
