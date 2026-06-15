import type { NavItem, SidebarNavEntry } from "../entities/nav-item.ts";
import type { SidebarUser } from "../entities/sidebar-user.ts";

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
];

const HR_ITEMS: NavItem[] = [
  { kind: "item", path: "/hr", label: "Funcionários", end: true },
  { kind: "item", path: "/hr/calendar", label: "Calendário de turnos" },
  { kind: "item", path: "/hr/ferias", label: "Férias & Ausências" },
  { kind: "item", path: "/hr/relatorio", label: "Relatório de assiduidade" },
  { kind: "item", path: "/hr/historico", label: "Histórico de alterações" },
];

const CRM_ITEMS: NavItem[] = [
  { kind: "item", path: "/crm", label: "Dashboard", end: true },
  { kind: "item", path: "/crm/customers", label: "Clientes" },
  { kind: "item", path: "/crm/parameters", label: "Parâmetros" },
];

export function buildTree(user: SidebarUser): SidebarNavEntry[] {
  const entries: SidebarNavEntry[] = [
    { kind: "item", path: "/", label: "Dashboard", end: true },
    { kind: "item", path: "/analytics", label: "Vendus Analytics" },
    {
      kind: "group",
      id: "dre",
      label: "Mapa de rentabilidade",
      basePath: "/dre",
      items: DRE_ITEMS,
    },
    {
      kind: "group",
      id: "stock",
      label: "Gestão de Stock",
      basePath: "/stock",
      items: STOCK_ITEMS,
    },
    {
      kind: "group",
      id: "hr",
      label: "Recursos Humanos",
      basePath: "/hr",
      items: HR_ITEMS,
    },
    {
      kind: "group",
      id: "crm",
      label: "CRM",
      basePath: "/crm",
      items: CRM_ITEMS,
    },
    { kind: "item", path: "/cash-closings", label: "Fechos de Caixa" },
  ];

  if (user.role === "admin") {
    entries.push({ kind: "item", path: "/admin/users", label: "Utilizadores" });
  }

  return entries;
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
