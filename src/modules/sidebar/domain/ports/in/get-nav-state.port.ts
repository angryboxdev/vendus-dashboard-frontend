import type { SidebarNavEntry } from "../../entities/nav-item.ts";
import type { SidebarUser } from "../../entities/sidebar-user.ts";

export interface SidebarState {
  readonly tree: SidebarNavEntry[];
  readonly activeGroupId: string | null;
  readonly user: SidebarUser | null;
}

export interface GetNavStatePort {
  execute(currentPath: string): SidebarState;
}
