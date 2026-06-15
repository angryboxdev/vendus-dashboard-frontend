import type {
  GetNavStatePort,
  SidebarState,
} from "../../domain/ports/in/get-nav-state.port.ts";
import type { AuthPort } from "../../domain/ports/out/auth.port.ts";
import {
  buildTree,
  resolveActiveGroup,
} from "../../domain/services/nav-state.service.ts";

export class GetNavStateUseCase implements GetNavStatePort {
  private readonly auth: AuthPort;

  constructor(auth: AuthPort) {
    this.auth = auth;
  }

  execute(currentPath: string): SidebarState {
    const user = this.auth.getUser();
    if (!user) return { tree: [], activeGroupId: null, user: null };
    const tree = buildTree(user);
    const activeGroupId = resolveActiveGroup(tree, currentPath);
    return { tree, activeGroupId, user };
  }
}
