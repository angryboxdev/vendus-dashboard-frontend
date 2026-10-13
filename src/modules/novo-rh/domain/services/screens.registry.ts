import type { MessageKey } from "../../../../i18n/i18n.ts";

/**
 * FE-002: registo único dos ecrãs do Novo RH — alimenta os separadores, a
 * pesquisa "Ir para…" e o título do documento.
 */
export interface Screen {
  path: string;
  label: MessageKey;
  /** Aparece nos separadores (os restantes abrem-se por ligação ou pesquisa). */
  nav: boolean;
  end?: boolean;
}

export const SCREENS: Screen[] = [
  { path: "/hr/novo", label: "novoRh.tab.overview", nav: true, end: true },
  { path: "/hr/novo/painel-anterior", label: "novoRh.previousOverview.title", nav: false },
  { path: "/hr/novo/pedidos", label: "novoRh.tab.inbox", nav: true },
  { path: "/hr/novo/pessoas", label: "novoRh.tab.people", nav: true },
  { path: "/hr/novo/tempo", label: "novoRh.tab.time", nav: true },
  { path: "/hr/novo/assiduidade", label: "novoRh.tab.attendance", nav: true },
  { path: "/hr/novo/ausencias", label: "novoRh.tab.absences", nav: true },
  { path: "/hr/novo/banco-de-horas", label: "novoRh.tab.timeBank", nav: true },
  { path: "/hr/novo/escalas", label: "novoRh.tab.rosters", nav: true },
  { path: "/hr/novo/fecho", label: "novoRh.tab.periods", nav: true },
  { path: "/hr/novo/comunicados", label: "novoRh.tab.announcements", nav: true },
  { path: "/hr/novo/documentos", label: "novoRh.tab.documents", nav: true },
  { path: "/hr/novo/alertas", label: "novoRh.tab.alerts", nav: true },
  { path: "/hr/novo/tarefas", label: "novoRh.tab.workspace", nav: true },
  { path: "/hr/novo/relatorios", label: "novoRh.tab.reports", nav: true },
  { path: "/hr/novo/transferencias", label: "novoRh.tab.transfers", nav: true },
  { path: "/hr/novo/notificacoes", label: "notifications.title", nav: false },
  { path: "/hr/novo/configuracoes", label: "novoRh.tab.settings", nav: true },
  { path: "/hr/novo/estrutura", label: "novoRh.tab.structure", nav: true },
  { path: "/hr/novo/entidades", label: "novoRh.tab.legalEntities", nav: false },
  { path: "/hr/novo/convites", label: "novoRh.tab.invitations", nav: false },
  { path: "/hr/novo/acessos", label: "novoRh.tab.access", nav: true },
  { path: "/hr/novo/auditoria", label: "novoRh.tab.audit", nav: true },
];

/** O ecrã de um caminho (o prefixo mais longo; "/hr/novo" só quando é exato). */
export function screenFor(pathname: string): Screen | null {
  let best: Screen | null = null;
  for (const s of SCREENS) {
    const hit = s.end ? pathname === s.path || pathname === `${s.path}/` : pathname === s.path || pathname.startsWith(`${s.path}/`);
    if (hit && (!best || s.path.length > best.path.length)) best = s;
  }
  return best;
}

/** Pesquisa de ecrãs: sem acentos nem maiúsculas. */
export function searchScreens(query: string, label: (s: Screen) => string): Screen[] {
  const norm = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  const q = norm(query);
  if (!q) return [];
  return SCREENS.filter((s) => norm(label(s)).includes(q));
}
