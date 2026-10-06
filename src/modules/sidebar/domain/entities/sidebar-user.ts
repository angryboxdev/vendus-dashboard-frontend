export interface SidebarUser {
  readonly email: string;
  readonly role: string;
  /** Acesso efetivo (Utilizadores & Perfis 2.0); ausente/null = comportamento antigo por papel. */
  readonly access?: {
    readonly isAdmin: boolean;
    readonly portalOnly: boolean;
    readonly permissions: Readonly<Record<string, "NONE" | "READ" | "MANAGE">>;
  } | null;
}
