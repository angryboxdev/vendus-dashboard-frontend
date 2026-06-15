export interface NavItem {
  readonly kind: "item";
  readonly path: string;
  readonly label: string;
  readonly end?: boolean;
}

export interface NavGroup {
  readonly kind: "group";
  readonly id: string;
  readonly label: string;
  readonly basePath: string;
  readonly items: NavItem[];
}

export type SidebarNavEntry = NavItem | NavGroup;
