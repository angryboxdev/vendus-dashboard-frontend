import type { MessageKey } from "../../../../i18n/i18n.ts";

/**
 * FE-002: registo único dos ecrãs do Novo RH — alimenta a navegação principal,
 * os separadores de cada área, a pesquisa "Ir para…" e o título do documento.
 *
 * Navegação MVP: 6 áreas (Visão geral | Colaboradores | Escalas | Assiduidade |
 * Ausências | Documentos) + Pedidos e Configurações à direita. O resto vive
 * dentro da área certa; os caminhos antigos redirecionam (`LEGACY_REDIRECTS`).
 * Só navegação: as permissões continuam a ser validadas no servidor.
 */
export type Area = "overview" | "people" | "rosters" | "attendance" | "absences" | "documents" | "inbox" | "settings" | "other";

export interface Screen {
  path: string;
  label: MessageKey;
  area: Area;
  /** Separador dentro da área (os restantes abrem-se por ligação ou pesquisa). */
  tab: boolean;
  end?: boolean;
}

export interface MainNavItem {
  area: Area;
  path: string;
  label: MessageKey;
  end?: boolean;
}

export const MAIN_NAV: MainNavItem[] = [
  { area: "overview", path: "/hr/novo", label: "novoRh.tab.overview", end: true },
  { area: "people", path: "/hr/novo/pessoas", label: "novoRh.tab.people" },
  { area: "rosters", path: "/hr/novo/escalas", label: "novoRh.tab.rosters" },
  { area: "attendance", path: "/hr/novo/assiduidade", label: "novoRh.tab.attendance" },
  { area: "absences", path: "/hr/novo/ausencias", label: "novoRh.tab.absences" },
  { area: "documents", path: "/hr/novo/documentos", label: "novoRh.tab.documents" },
];

export const SCREENS: Screen[] = [
  { path: "/hr/novo", label: "novoRh.tab.overview", area: "overview", tab: false, end: true },
  { path: "/hr/novo/painel-anterior", label: "novoRh.previousOverview.title", area: "overview", tab: false },
  { path: "/hr/novo/pessoas", label: "novoRh.tab.peopleList", area: "people", tab: true, end: true },
  { path: "/hr/novo/pessoas/transferencias", label: "novoRh.tab.transfers", area: "people", tab: true },
  { path: "/hr/novo/pessoas/relatorios", label: "novoRh.tab.reports", area: "people", tab: true },
  { path: "/hr/novo/pessoas", label: "novoRh.tab.people", area: "people", tab: false },
  { path: "/hr/novo/escalas", label: "novoRh.tab.rosters", area: "rosters", tab: false },
  { path: "/hr/novo/assiduidade", label: "novoRh.tab.attendanceReview", area: "attendance", tab: true, end: true },
  { path: "/hr/novo/assiduidade/registos", label: "novoRh.tab.time", area: "attendance", tab: true },
  { path: "/hr/novo/assiduidade/banco-de-horas", label: "novoRh.tab.timeBank", area: "attendance", tab: true },
  { path: "/hr/novo/assiduidade/fecho", label: "novoRh.tab.periods", area: "attendance", tab: true },
  { path: "/hr/novo/assiduidade/relatorios", label: "novoRh.tab.reports", area: "attendance", tab: true },
  { path: "/hr/novo/ausencias", label: "novoRh.tab.absences", area: "absences", tab: true, end: true },
  { path: "/hr/novo/ausencias/relatorios", label: "novoRh.tab.reports", area: "absences", tab: true },
  { path: "/hr/novo/documentos", label: "novoRh.tab.documents", area: "documents", tab: false },
  { path: "/hr/novo/pedidos", label: "novoRh.tab.inbox", area: "inbox", tab: false },
  { path: "/hr/novo/notificacoes", label: "notifications.title", area: "other", tab: false },
  { path: "/hr/novo/configuracoes", label: "novoRh.tab.settingsGeneral", area: "settings", tab: true },
  { path: "/hr/novo/estrutura", label: "novoRh.tab.structure", area: "settings", tab: true },
  { path: "/hr/novo/entidades", label: "novoRh.tab.legalEntities", area: "settings", tab: true },
  { path: "/hr/novo/acessos", label: "novoRh.tab.access", area: "settings", tab: true },
  { path: "/hr/novo/convites", label: "novoRh.tab.invitations", area: "settings", tab: true },
  { path: "/hr/novo/alertas", label: "novoRh.tab.alerts", area: "settings", tab: true },
  { path: "/hr/novo/auditoria", label: "novoRh.tab.audit", area: "settings", tab: true },
  // Ocultos no MVP (implementação mantida; abrem por ligação ou pesquisa).
  { path: "/hr/novo/relatorios", label: "novoRh.tab.reportsAll", area: "other", tab: false },
  { path: "/hr/novo/comunicados", label: "novoRh.tab.announcements", area: "other", tab: false },
  { path: "/hr/novo/tarefas", label: "novoRh.tab.workspace", area: "other", tab: false },
];

/** Caminhos antigos → novos (bookmarks, notificações e ligações continuam a funcionar). */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/hr/novo/tempo": "/hr/novo/assiduidade/registos",
  "/hr/novo/banco-de-horas": "/hr/novo/assiduidade/banco-de-horas",
  "/hr/novo/fecho": "/hr/novo/assiduidade/fecho",
  "/hr/novo/transferencias": "/hr/novo/pessoas/transferencias",
};

/** Relatórios contextualizados: grupos do catálogo mostrados em cada área. */
export const REPORT_GROUPS: Partial<Record<Area, string[]>> = {
  attendance: ["time"],
  absences: ["leave"],
  people: ["people", "history"],
};

/** O ecrã de um caminho (o prefixo mais longo; `end` só quando é exato). */
export function screenFor(pathname: string): Screen | null {
  const p = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  let best: Screen | null = null;
  for (const s of SCREENS) {
    const hit = s.end ? p === s.path : p === s.path || p.startsWith(`${s.path}/`);
    if (hit && (!best || s.path.length > best.path.length || (s.path.length === best.path.length && s.end && !best.end))) best = s;
  }
  return best;
}

/** Área do caminho atual (para marcar a navegação principal e mostrar os separadores certos). */
export function areaFor(pathname: string): Area | null {
  return screenFor(pathname)?.area ?? null;
}

/** Separadores de uma área (vazio quando a área tem um só ecrã). */
export function areaTabs(area: Area | null): Screen[] {
  if (!area) return [];
  const tabs = SCREENS.filter((s) => s.area === area && s.tab);
  return tabs.length > 1 ? tabs : [];
}

/** Pesquisa de ecrãs: sem acentos nem maiúsculas; um resultado por caminho. */
export function searchScreens(query: string, label: (s: Screen) => string): Screen[] {
  const norm = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  const q = norm(query);
  if (!q) return [];
  const seen = new Set<string>();
  return SCREENS.filter((s) => {
    if (seen.has(s.path) || !norm(label(s)).includes(q)) return false;
    seen.add(s.path);
    return true;
  });
}

/** Destino de um caminho antigo, mantendo o resto do caminho, a query e o hash. */
export function legacyTarget(pathname: string, search = "", hash = ""): string | null {
  for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
    if (pathname === from || pathname.startsWith(`${from}/`)) return `${to}${pathname.slice(from.length)}${search}${hash}`;
  }
  return null;
}
