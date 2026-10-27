import type { NavItem, SidebarNavEntry } from "../entities/nav-item.ts";
import type { SidebarUser } from "../entities/sidebar-user.ts";
import { canOpenPath } from "../../../access/domain/services/access-ui.service.ts";

const DRE_ITEMS: NavItem[] = [
  { kind: "item", path: "/dre/demonstrativo", label: "Mapa" },
  { kind: "item", path: "/dre/fluxo-caixa", label: "Fluxo de caixa" },
  { kind: "item", path: "/dre/receita-bruta", label: "Receitas" },
  { kind: "item", path: "/dre/custos-fixos", label: "Custos Fixos" },
  { kind: "item", path: "/dre/custos-variaveis", label: "Custos Variáveis" },
];

// Mesmas rotas e ecrãs; só os nomes e o agrupamento (task «Stock inteligente» V4 §1).
const STOCK_ITEMS: NavItem[] = [
  { kind: "item", path: "/stock/stock", label: "Artigos e ingredientes" },
  // Inventário: um só item; Stock atual, Movimentos, Contagens e Compras por rever são separadores dentro da página.
  { kind: "item", path: "/stock/inventario", label: "Inventário", match: ["/stock/movimentacoes", "/stock/historico-movimentos", "/stock/contagens", "/stock/compras-por-rever"] },
  { kind: "item", path: "/stock/planeamento", label: "Reposição e planeamento" },
  // Fichas técnicas (V7): página única com Pratos | Preparações | Análise de custos.
  { kind: "item", path: "/stock/fichas-tecnicas", label: "Fichas técnicas" },
];

/** Itens do grupo em blocos: soltos, ou um subgrupo com os seus itens seguidos. */
export function chunkBySubgroup(items: NavItem[]): ({ kind: "item"; item: NavItem } | { kind: "subgroup"; label: string; items: NavItem[] })[] {
  const out: ({ kind: "item"; item: NavItem } | { kind: "subgroup"; label: string; items: NavItem[] })[] = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (item.subgroup && last?.kind === "subgroup" && last.label === item.subgroup) last.items.push(item);
    else if (item.subgroup) out.push({ kind: "subgroup", label: item.subgroup, items: [item] });
    else out.push({ kind: "item", item });
  }
  return out;
}

/** Caminhos do RH antigo (hoje redirecionam para o Novo RH). */
export const LEGACY_HR_PATHS = ["/hr/overview", "/hr/people", "/hr/schedules", "/hr/calendar", "/hr/ferias", "/hr/assiduidade", "/hr/pedidos", "/hr/historico", "/hr/employees"] as const;

// Recursos Humanos: as áreas do Novo RH. «Mais» junta Documentos, Relatórios e Organograma;
// o «RH antigo» saiu do menu (pedido do utilizador em 2026-10-22; os caminhos antigos redirecionam).
const HR_ITEMS: NavItem[] = [
  { kind: "item", path: "/hr/novo", label: "Visão geral", end: true, icon: "overview" },
  { kind: "item", path: "/hr/novo/pessoas", label: "Colaboradores", icon: "people" },
  { kind: "item", path: "/hr/novo/escalas", label: "Escalas", icon: "rosters" },
  { kind: "item", path: "/hr/novo/assiduidade", label: "Assiduidade", icon: "attendance" },
  { kind: "item", path: "/hr/novo/ausencias", label: "Ausências", icon: "absences" },
  { kind: "item", path: "/hr/novo/documentos", label: "Mais", icon: "more", match: ["/hr/novo/documentos", "/hr/novo/relatorios", "/hr/novo/organograma"] },
];

const CRM_ITEMS: NavItem[] = [
  { kind: "item", path: "/crm", label: "Dashboard", end: true },
  { kind: "item", path: "/crm/customers", label: "Clientes" },
  { kind: "item", path: "/crm/parameters", label: "Parâmetros" },
];

const FINANCIAL_ITEMS: NavItem[] = [
  { kind: "item", path: "/financial/cost-centers", label: "Categorias" },
  { kind: "item", path: "/financial/suppliers", label: "Fornecedores" },
  { kind: "item", path: "/financial/invoices", label: "Faturas" },
  { kind: "item", path: "/financial/recurrences", label: "Recorrências" },
  { kind: "item", path: "/financial/bank-statements", label: "Conciliação Bancária" },
  { kind: "item", path: "/financial/accounting", label: "Contabilidade" },
  { kind: "item", path: "/financial/sales-declaration", label: "Declaração de Vendas" },
];

/**
 * Configurações (fim do menu, junto ao bloco do utilizador): as entradas que já existiam — mesmas rotas e
 * permissões — e as integrações técnicas. Sem página «Integrações» vazia: o subgrupo leva aos ecrãs reais.
 */
const SETTINGS_ITEMS: NavItem[] = [
  { kind: "item", path: "/empresa", label: "Empresa & Estrutura" },
  { kind: "item", path: "/admin/users", label: "Utilizadores e permissões", match: ["/admin/access-profiles"] },
  { kind: "item", path: "/configuracoes/integracoes/faturas-por-email", label: "Faturas por email", subgroup: "Integrações" },
  { kind: "item", path: "/admin/location-tokens", label: "Tokens de dispositivo", subgroup: "Integrações" },
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
    {
      kind: "group",
      id: "settings",
      label: "Configurações",
      icon: "settings",
      basePath: "/configuracoes",
      items: SETTINGS_ITEMS,
    },
  ];

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
  // Grupos com ecrãs de outros caminhos (Configurações: /empresa, /admin/…).
  for (const entry of tree) {
    if (entry.kind === "group" && entry.items.some((i) => [i.path, ...(i.match ?? [])].some((p) => isItemActive(p, currentPath)))) {
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
