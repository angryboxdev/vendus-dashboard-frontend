import type { SidebarUser } from "../../entities/sidebar-user.ts";

export interface AuthPort {
  getUser(): SidebarUser | null;
  signOut(): Promise<void>;
}
