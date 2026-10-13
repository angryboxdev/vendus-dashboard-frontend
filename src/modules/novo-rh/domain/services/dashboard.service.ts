/**
 * Dashboard executivo — regras de apresentação puras: registo de widgets,
 * frase "Hoje", rascunho do layout e geometria do donut. Nada aqui decide
 * estados de negócio (vêm do OperationalSnapshot do backend).
 */
import type { OperationalSnapshot, TeamCategory, TeamCounts, WidgetPref } from "../entities/dashboard.ts";

export type WidgetId =
  | "ATTENTION"
  | "TEAM_STATUS"
  | "LOCATIONS_STATUS"
  | "COVERAGE"
  | "REQUESTS"
  | "GOOGLE_REVIEWS"
  | "BIRTHDAYS"
  | "HOLIDAYS"
  | "REPORTS"
  | "VACANCIES"
  | "ARTICLES";

/** Camada de carregamento (1 = snapshot; 2 = segunda vaga; 3 = secundários). */
export type WidgetPriority = 1 | 2 | 3;

export interface WidgetDefinition {
  id: WidgetId;
  title: string;
  defaultOrder: number;
  defaultSpan: number;
  allowedSpans: number[];
  priority: WidgetPriority;
  /** Só faz sentido com mais de um local no contexto. */
  multiUnitOnly?: boolean;
  /** Fonte existe no sistema? (vagas e artigos ainda não têm) — sem fonte nunca é mostrado. */
  available: boolean;
  /** Permissão mínima (nível READ) para o widget aparecer; o backend volta a validar. */
  permission?: string;
}

/** Registo central (ids estáveis, iguais aos do backend). */
export const WIDGETS: WidgetDefinition[] = [
  { id: "ATTENTION", title: "Requer atenção", defaultOrder: 0, defaultSpan: 6, allowedSpans: [4, 6, 12], priority: 1, available: true },
  { id: "TEAM_STATUS", title: "Estado da equipa", defaultOrder: 1, defaultSpan: 6, allowedSpans: [6, 12], priority: 1, available: true },
  { id: "LOCATIONS_STATUS", title: "Estado das unidades", defaultOrder: 2, defaultSpan: 12, allowedSpans: [12], priority: 2, multiUnitOnly: true, available: true },
  { id: "COVERAGE", title: "Cobertura da escala", defaultOrder: 3, defaultSpan: 5, allowedSpans: [4, 5, 6, 12], priority: 2, available: true },
  { id: "REQUESTS", title: "Solicitações", defaultOrder: 4, defaultSpan: 7, allowedSpans: [6, 7, 12], priority: 2, available: true },
  { id: "GOOGLE_REVIEWS", title: "Avaliações Google", defaultOrder: 5, defaultSpan: 6, allowedSpans: [4, 6, 12], priority: 3, available: true },
  { id: "BIRTHDAYS", title: "Próximos aniversários", defaultOrder: 6, defaultSpan: 6, allowedSpans: [4, 6, 12], priority: 3, available: true },
  { id: "HOLIDAYS", title: "Próximos feriados", defaultOrder: 7, defaultSpan: 6, allowedSpans: [4, 6, 12], priority: 3, available: true },
  { id: "REPORTS", title: "Relatórios", defaultOrder: 8, defaultSpan: 6, allowedSpans: [4, 6, 12], priority: 3, available: true, permission: "hr.employees" },
  { id: "VACANCIES", title: "Vagas", defaultOrder: 9, defaultSpan: 4, allowedSpans: [4, 6], priority: 3, available: false },
  { id: "ARTICLES", title: "Artigos", defaultOrder: 10, defaultSpan: 4, allowedSpans: [4, 6, 12], priority: 3, available: false },
];

export const widgetDef = (id: string) => WIDGETS.find((w) => w.id === id);

/** Nome do tamanho predefinido (sem redimensionamento livre). */
export function spanLabel(span: number, def: WidgetDefinition): string {
  if (span === 12) return "Largo";
  if (span === def.defaultSpan) return "Padrão";
  return span < def.defaultSpan ? "Compacto" : "Médio";
}

export const defaultLayout = (): WidgetPref[] => WIDGETS.map((w) => ({ widgetId: w.id, order: w.defaultOrder, span: w.defaultSpan, hidden: false }));

/**
 * Widgets a mostrar: ordem do layout, só os que existem, com fonte, com
 * permissão e com sentido no contexto. O layout nunca concede acesso.
 */
export function visibleWidgets(layout: WidgetPref[], opts: { multiUnit: boolean; can: (permission: string) => boolean; editing: boolean }): (WidgetPref & { def: WidgetDefinition })[] {
  return [...layout]
    .sort((a, b) => a.order - b.order)
    .map((w) => ({ ...w, def: widgetDef(w.widgetId)! }))
    .filter((w) => w.def && w.def.available && (!w.def.permission || opts.can(w.def.permission)) && (!w.def.multiUnitOnly || opts.multiUnit) && (opts.editing || !w.hidden));
}

const renumber = (ws: WidgetPref[]) => ws.map((w, i) => ({ ...w, order: i }));
const sorted = (ws: WidgetPref[]) => [...ws].sort((a, b) => a.order - b.order);

/** Move `id` para a posição de `targetId` (arrastar e largar). */
export function moveTo(ws: WidgetPref[], id: string, targetId: string): WidgetPref[] {
  if (id === targetId) return ws;
  const list = sorted(ws);
  const from = list.findIndex((w) => w.widgetId === id);
  const to = list.findIndex((w) => w.widgetId === targetId);
  if (from < 0 || to < 0) return ws;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item!);
  return renumber(list);
}

/** Alternativa por teclado: sobe/desce uma posição. */
export function moveBy(ws: WidgetPref[], id: string, delta: -1 | 1): WidgetPref[] {
  const list = sorted(ws);
  const i = list.findIndex((w) => w.widgetId === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return ws;
  [list[i], list[j]] = [list[j]!, list[i]!];
  return renumber(list);
}

export function setSpan(ws: WidgetPref[], id: string, span: number): WidgetPref[] {
  const def = widgetDef(id);
  if (!def?.allowedSpans.includes(span)) return ws;
  return ws.map((w) => (w.widgetId === id ? { ...w, span } : w));
}

export function toggleHidden(ws: WidgetPref[], id: string): WidgetPref[] {
  return ws.map((w) => (w.widgetId === id ? { ...w, hidden: !w.hidden } : w));
}

// ── Resumo "Hoje" ────────────────────────────────────────────────────

export type SummaryTarget = "units" | "units_attention" | "rosters" | "requests" | "attendance";
export interface SummaryPart {
  key: string;
  count: number;
  label: string;
  tone: "neutral" | "critical" | "warning" | "info";
  target: SummaryTarget;
}

const pl = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Frase determinística (nunca gerada por IA) a partir do mesmo agregado dos
 * widgets. Zeros que não acrescentam valor são omitidos.
 */
export function summaryParts(s: OperationalSnapshot): SummaryPart[] {
  const parts: SummaryPart[] = [];
  if (s.context.type === "organization") {
    parts.push({ key: "units", count: s.units.operational, label: pl(s.units.operational, "unidade operacional", "unidades operacionais"), tone: "neutral", target: "units" });
    if (s.units.requiringAttention) parts.push({ key: "attention", count: s.units.requiringAttention, label: pl(s.units.requiringAttention, "precisa de atenção", "precisam de atenção"), tone: "critical", target: "units_attention" });
  } else {
    const present = s.team.working + s.team.remote + s.team.break;
    parts.push({ key: "present", count: present, label: pl(present, "presente", "presentes"), tone: "neutral", target: "attendance" });
    if (s.team.late) parts.push({ key: "late", count: s.team.late, label: pl(s.team.late, "atraso", "atrasos"), tone: "warning", target: "attendance" });
    if (s.team.missing) parts.push({ key: "missing", count: s.team.missing, label: "em falta", tone: "critical", target: "attendance" });
  }
  if (s.coverage.uncoveredToday) parts.push({ key: "uncovered", count: s.coverage.uncoveredToday, label: pl(s.coverage.uncoveredToday, "turno sem cobertura", "turnos sem cobertura"), tone: "warning", target: "rosters" });
  if (s.requests.decidable) parts.push({ key: "requests", count: s.requests.decidable, label: pl(s.requests.decidable, "pedido pendente", "pedidos pendentes"), tone: "info", target: "requests" });
  return parts;
}

/** Sem exceções: a frase termina com "operação sem pendências críticas". */
export const isCalm = (s: OperationalSnapshot) => s.attention.length === 0;

// ── Donut ────────────────────────────────────────────────────────────

export const TEAM_LABEL: Record<TeamCategory, string> = { working: "Trabalhando", remote: "Remoto", break: "Em pausa", vacation: "Férias", absent: "Ausentes" };

export interface DonutSegment {
  category: TeamCategory;
  value: number;
  /** Comprimento do arco e deslocamento (stroke-dasharray / stroke-dashoffset). */
  length: number;
  offset: number;
}

/** Arcos do donut (circunferência `c`); pequenos espaços entre segmentos. */
export function donutSegments(team: TeamCounts, c: number, gap = 2): DonutSegment[] {
  const cats: TeamCategory[] = ["working", "remote", "break", "vacation", "absent"];
  const total = cats.reduce((s, k) => s + team[k], 0);
  if (!total) return [];
  const used = cats.filter((k) => team[k] > 0);
  const g = used.length > 1 ? gap : 0;
  let acc = 0;
  return used.map((k) => {
    const raw = (team[k] / total) * c;
    const seg = { category: k, value: team[k], length: Math.max(raw - g, 0.5), offset: -acc };
    acc += raw;
    return seg;
  });
}
