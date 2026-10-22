/** Chave do ícone (o domínio não conhece React; a vista resolve-a no catálogo de ícones do kit). */
export type NavIcon =
  | "profitability" | "stock" | "people" | "crm" | "financial" | "cashClosings" | "airMenu" | "vendus" | "company" | "users" | "deviceTokens"
  | "overview" | "rosters" | "attendance" | "absences" | "documents" | "more" | "legacy";

export interface NavItem {
  readonly kind: "item";
  readonly path: string;
  readonly label: string;
  readonly icon?: NavIcon;
  readonly end?: boolean;
  /** Contador ao lado do rótulo (ex.: pedidos por decidir). */
  readonly badgeKey?: "hr-requests";
  /** Outros caminhos que também marcam este item como ativo (ex.: "RH antigo" cobre os ecrãs antigos). */
  readonly match?: readonly string[];
}

export interface NavGroup {
  readonly kind: "group";
  readonly id: string;
  readonly label: string;
  readonly icon?: NavIcon;
  readonly basePath: string;
  readonly items: NavItem[];
}

export type SidebarNavEntry = NavItem | NavGroup;
