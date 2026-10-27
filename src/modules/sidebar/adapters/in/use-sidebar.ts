import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  /** Contadores por `badgeKey` (0 = sem contador). */
  badges: Partial<Record<"hr-requests", number>>;
  /** Desktop: barra recolhida (só ícones). Preferência deste navegador. */
  collapsed: boolean;
  toggleCollapsed: () => void;
}

const COLLAPSED_KEY = "sidebar.collapsed";

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function useSidebar(): UseSidebarResult {
  const { getNavState, signOut: signOutUseCase, badgeCounts } = useSidebarModule();
  const location = useLocation();
  const navigate = useNavigate();
  const [choice, setChoice] = useState<{ pathname: string; groupId: string | null } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  function toggleCollapsed(): void {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1");
      } catch {
        // Sem armazenamento: vale só nesta página.
      }
      return !c;
    });
  }

  const state = getNavState.execute(location.pathname);
  const showsRequests = state.tree.some((e) => (e.kind === "group" ? e.items.some((i) => i.badgeKey === "hr-requests") : e.badgeKey === "hr-requests"));
  const { data: pendingRequests } = useQuery({
    queryKey: ["hr-requests-count"],
    queryFn: () => badgeCounts!.pendingHrRequests(),
    enabled: showsRequests && !!badgeCounts,
    refetchInterval: 60_000,
    retry: false,
  });

  function isGroupActive(groupId: string): boolean {
    return state.activeGroupId === groupId;
  }

  // Acordeão: só um grupo aberto de cada vez. A escolha manual vale até mudar de ecrã;
  // depois volta a abrir-se o grupo ativo.
  const openGroupId = choice && choice.pathname === location.pathname ? choice.groupId : state.activeGroupId;

  function isGroupExpanded(groupId: string): boolean {
    return openGroupId === groupId;
  }

  function toggleGroup(groupId: string): void {
    setChoice({ pathname: location.pathname, groupId: openGroupId === groupId ? null : groupId });
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
    badges: { "hr-requests": pendingRequests ?? 0 },
    collapsed,
    toggleCollapsed,
  };
}
