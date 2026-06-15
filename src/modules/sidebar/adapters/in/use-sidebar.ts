import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSidebarModule } from "../../sidebar.module.tsx";
import type { SidebarNavEntry } from "../../domain/entities/nav-item.ts";

export interface UseSidebarResult {
  tree: SidebarNavEntry[];
  isGroupExpanded: (id: string) => boolean;
  isGroupActive: (id: string) => boolean;
  toggleGroup: (id: string) => void;
  userEmail: string;
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  signOut: () => void;
}

export function useSidebar(): UseSidebarResult {
  const { getNavState, signOut: signOutUseCase } = useSidebarModule();
  const location = useLocation();
  const navigate = useNavigate();
  const [manualExpanded, setManualExpanded] = useState<Set<string>>(new Set());
  const [manualCollapsed, setManualCollapsed] = useState<Set<string>>(new Set());
  const [mobileOpen, setMobileOpen] = useState(false);

  const state = getNavState.execute(location.pathname);

  function isGroupActive(groupId: string): boolean {
    return state.activeGroupId === groupId;
  }

  function isGroupExpanded(groupId: string): boolean {
    if (manualCollapsed.has(groupId)) return false;
    if (manualExpanded.has(groupId)) return true;
    return state.activeGroupId === groupId;
  }

  function toggleGroup(groupId: string): void {
    if (isGroupExpanded(groupId)) {
      if (isGroupActive(groupId)) {
        // active group: collapse it manually
        setManualCollapsed((prev) => new Set(prev).add(groupId));
        setManualExpanded((prev) => {
          const n = new Set(prev);
          n.delete(groupId);
          return n;
        });
      } else {
        // manually expanded: close it
        setManualExpanded((prev) => {
          const n = new Set(prev);
          n.delete(groupId);
          return n;
        });
      }
    } else {
      // collapsed: open it and clear any manual-collapsed flag
      setManualCollapsed((prev) => {
        const n = new Set(prev);
        n.delete(groupId);
        return n;
      });
      setManualExpanded((prev) => new Set(prev).add(groupId));
    }
  }

  function signOut(): void {
    void signOutUseCase.execute().then(() => {
      navigate("/login", { replace: true });
    });
  }

  return {
    tree: state.tree,
    isGroupExpanded,
    isGroupActive,
    toggleGroup,
    userEmail: state.user?.email ?? "",
    mobileOpen,
    openMobile: () => setMobileOpen(true),
    closeMobile: () => setMobileOpen(false),
    signOut,
  };
}
