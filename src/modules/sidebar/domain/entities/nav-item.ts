export interface NavItem {
  readonly kind: "item";
  readonly path: string;
  readonly label: string;
  readonly end?: boolean;
  /** Contador ao lado do rótulo (ex.: pedidos por decidir). */
  readonly badgeKey?: "hr-requests";
}

export interface NavGroup {
  readonly kind: "group";
  readonly id: string;
  readonly label: string;
  readonly basePath: string;
  readonly items: NavItem[];
}

export type SidebarNavEntry = NavItem | NavGroup;
