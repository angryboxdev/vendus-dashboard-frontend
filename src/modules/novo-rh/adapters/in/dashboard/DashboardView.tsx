import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useOptionalAuth } from "../../../../../contexts/AuthContext.tsx";
import {
  Button,
  IconAlert,
  IconCalendar,
  IconChevronDown,
  IconFile,
  IconSliders,
  IconStore,
  IconUsers,
  SearchableSelect,
  SegmentedControl,
  Skeleton,
} from "../../../../../components/ui/index.ts";
import { hasLevel } from "../../../../access/domain/services/access-ui.service.ts";
import { ApiError } from "../../../../../lib/api.ts";
import type { TeamCategory, TeamChart, UnitRow, WidgetPref } from "../../../domain/entities/dashboard.ts";
import {
  rowColumns,
  dashboardRows,
  defaultLayout,
  SUMMARY_ITEMS,
  setTeamChart,
  TEAM_CHART_LABEL,
  TEAM_CHARTS,
  teamChartOf,
  isCalm,
  moveBy,
  moveTo,
  setSpan,
  spanLabel,
  summaryParts,
  toggleHidden,
  visibleWidgets,
  widgetDef,
  type SummaryPart,
  type WidgetId,
} from "../../../domain/services/dashboard.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { DashboardWidget, WidgetMessage, WidgetSkeleton } from "./DashboardWidget.tsx";
import { TeamDrawer, UnitDrawer } from "./DashboardDrawers.tsx";
import { GoogleReviewsBody, GoogleReviewsCompact } from "./GoogleReviews.tsx";
import { AttentionBody, BirthdaysBody, CompactKpi, CoverageBody, CoverageDetail, HolidaysBody, ReportsBody, RequestsBody, TeamBody, UnitsBody, UnitsSummary } from "./Widgets.tsx";

/** "A preparar" (503: o cálculo de hoje continua no servidor) ou falha de rede: tenta de novo sozinho. */
const warming = (e: unknown) => e instanceof ApiError && e.status === 503;
const retrySnapshot = (count: number, e: unknown) => (warming(e) ? count < 40 : !(e instanceof ApiError) && count < 3);
const SUMMARY_TONE: Record<SummaryPart["tone"], string> = { neutral: "", critical: "bg-red-500", warning: "bg-amber-500", info: "bg-sky-500" };
const longDate = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("pt-PT", { day: "numeric", month: "long", timeZone: "UTC" });

/**
 * Novo RH → Dashboard executivo. Um agregado (snapshot) alimenta resumo,
 * atenção, equipa, unidades e cobertura; listas só a pedido; layout pessoal
 * (só metadados). Personalizar não refaz consultas nem concede acesso.
 */
export function DashboardView() {
  const { dashboard } = useNovoRh();
  const user = useOptionalAuth()?.user ?? null;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const perms = user?.access?.permissions ?? {};
  // Só esconde o que não faz sentido mostrar; quem decide é o backend (sem sessão carregada, mostra e o backend recusa).
  const can = (key: string) => !user?.access || user.access.isAdmin || hasLevel(perms, key, "READ");
  const ctxKey = `novo-rh-dashboard-context:${user?.id ?? "-"}`;
  const [chosenLocation, setLocationId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ctxKey) || null;
    } catch {
      return null;
    }
  });
  const [teamCat, setTeamCat] = useState<TeamCategory | null>(null);
  const [unit, setUnit] = useState<UnitRow | null>(null);
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WidgetPref[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // Detalhe expandido (só um; transitório — nunca vai para o layout guardado).
  const [expanded, setExpanded] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // Camada 1: o snapshot (polling 60 s só com a aba visível — o TanStack pausa em segundo plano).
  const org = useQuery({ queryKey: ["novo-rh", "dashboard", "snapshot", null], queryFn: ({ signal }) => dashboard.snapshot(null, signal), staleTime: 30_000, refetchInterval: 60_000, retry: retrySnapshot, retryDelay: 3_000 });
  // Contexto lembrado mas já sem acesso (ou local fechado): vale a organização.
  const locationId = chosenLocation && (!org.data || org.data.locations.some((l) => l.locationId === chosenLocation)) ? chosenLocation : null;
  const local = useQuery({
    queryKey: ["novo-rh", "dashboard", "snapshot", locationId],
    queryFn: ({ signal }) => dashboard.snapshot(locationId, signal),
    enabled: !!locationId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: retrySnapshot,
    retryDelay: 3_000,
  });
  const layoutQ = useQuery({ queryKey: ["novo-rh", "dashboard", "layout"], queryFn: () => dashboard.layout(), staleTime: Infinity });
  const snap = locationId ? local : org;
  const s = snap.data;
  // Carregamento longo (muitas pessoas): avisa em vez de parecer vazio.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!snap.isLoading) return;
    const t = setTimeout(() => setSlow(true), 15_000);
    return () => clearTimeout(t);
  }, [snap.isLoading]);
  const units = org.data?.locations ?? [];
  const multiUnit = !locationId && units.length > 1;

  useEffect(() => {
    try {
      if (locationId) localStorage.setItem(ctxKey, locationId);
      else localStorage.removeItem(ctxKey);
    } catch {
      /* sem armazenamento: o contexto não é lembrado */
    }
  }, [locationId, ctxKey]);

  const saved = layoutQ.data?.widgets.length ? layoutQ.data.widgets : defaultLayout();
  const current = draft ?? saved;
  const shown = visibleWidgets(current, { multiUnit, can, editing });

  const save = useMutation({
    mutationFn: (w: WidgetPref[]) => dashboard.saveLayout(w.map((x, i) => ({ ...x, order: i }))),
    onSuccess: (l) => (qc.setQueryData(["novo-rh", "dashboard", "layout"], l), setEditing(false), setDraft(null)),
  });
  const reset = useMutation({
    mutationFn: () => dashboard.resetLayout(),
    onSuccess: (l) => (qc.setQueryData(["novo-rh", "dashboard", "layout"], l), setDraft(null)),
  });
  // Formato do gráfico: preferência do utilizador guardada com o layout (sobrevive a atualizar, ocultar e reordenar).
  const chart = teamChartOf(current);
  const saveChart = useMutation({
    mutationFn: (c: TeamChart) => dashboard.saveLayout(setTeamChart([...saved].sort((a, b) => a.order - b.order), c).map((x, i) => ({ ...x, order: i }))),
    onMutate: (c) => {
      // Mostra logo o novo formato; se falhar, volta ao que estava guardado.
      const prev = qc.getQueryData(["novo-rh", "dashboard", "layout"]);
      if (layoutQ.data) qc.setQueryData(["novo-rh", "dashboard", "layout"], { ...layoutQ.data, widgets: setTeamChart(saved, c) });
      return { prev };
    },
    onError: (_e, _c, ctx) => qc.setQueryData(["novo-rh", "dashboard", "layout"], ctx?.prev),
    onSuccess: (l) => qc.setQueryData(["novo-rh", "dashboard", "layout"], l),
  });
  const chooseChart = (c: TeamChart) => (editing ? setDraft((d) => setTeamChart(d ?? saved, c)) : saveChart.mutate(c));
  const startEditing = () => (setDraft([...saved].sort((a, b) => a.order - b.order)), setEditing(true), setSelected(null));
  const cancel = () => (setDraft(null), setEditing(false), setSelected(null));

  const goTo = (p: SummaryPart) => {
    if (p.target === "units" || p.target === "units_attention") {
      setOnlyAttention(p.target === "units_attention");
      setExpanded("LOCATIONS_STATUS");
      document.getElementById("widget-LOCATIONS_STATUS")?.focus();
      document.getElementById("widget-LOCATIONS_STATUS")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else navigate(p.target === "rosters" ? "/hr/novo/escalas" : p.target === "requests" ? "/hr/novo/pedidos" : "/hr/novo/assiduidade");
  };

  const editProps = (w: WidgetPref) =>
    editing
      ? {
          editing: true,
          hidden: w.hidden,
          dragging: dragId === w.widgetId,
          dropTarget: overId === w.widgetId && dragId !== w.widgetId,
          selected: selected === w.widgetId,
          onSelect: () => setSelected(w.widgetId),
          onToggleHidden: () => setDraft((d) => toggleHidden(d ?? saved, w.widgetId)),
          onDragStart: (e: DragEvent) => {
            e.dataTransfer?.setData("text/plain", w.widgetId);
            if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
            setDragId(w.widgetId);
          },
          onDragEnd: () => (setDragId(null), setOverId(null)),
          onDragOver: (e: DragEvent) => {
            if (!dragId) return;
            e.preventDefault();
            if (overId !== w.widgetId) setOverId(w.widgetId);
          },
          onDrop: (e: DragEvent) => {
            e.preventDefault();
            if (dragId) setDraft((d) => moveTo(d ?? saved, dragId, w.widgetId));
            setDragId(null);
            setOverId(null);
          },
        }
      : undefined;

  /** Recolhe e devolve o foco ao «Expandir» do widget (sem saltar o scroll). */
  const collapse = () => {
    const id = expanded;
    setExpanded(null);
    if (id) requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`[data-expand="${id}"]`)?.focus({ preventScroll: true }));
  };
  const toggleExpanded = (id: string) => (expanded === id ? collapse() : setExpanded(id));
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // Escape dentro de um menu/diálogo fecha esse primeiro.
      if ((e.target as HTMLElement | null)?.closest?.('[role="dialog"],[role="menu"],[role="listbox"]')) return;
      collapse();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || !root.current) return;
      // Só cliques na grelha do Dashboard contam como «fora»: menus, popovers e diálogos
      // em portal (fora da grelha) e o próprio detalhe ou o seu botão nunca recolhem.
      if (!root.current.contains(t)) return;
      if (t.closest(`#widget-${expanded}`) || t.closest('[data-state="compact"]') || t.closest("[data-expand]")) return;
      collapse();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);
  // «Personalizar» não expande: ao entrar, fecha o detalhe.
  useEffect(() => {
    if (editing) setExpanded(null);
  }, [editing]);

  const compactOf = (id: WidgetId): ReactNode => {
    if (!s) return null;
    const present = s.team.working + s.team.remote + s.team.break;
    switch (id) {
      case "ATTENTION":
        return <CompactKpi value={s.attention.reduce((n, a) => n + a.count, 0)} label="ocorrências" sub={s.attention[0] ? `${s.attention[0].count} ${s.attention[0].label}` : "Sem pendências críticas"} tone="critical" />;
      case "TEAM_STATUS":
        return <CompactKpi value={s.team.total} label="colaboradores" sub={`${present} presentes · ${s.team.absent} ausentes`} />;
      case "LOCATIONS_STATUS":
        return <CompactKpi value={s.units.operational} label="unidades" sub={s.units.requiringAttention ? `${s.units.requiringAttention} com exceções` : "Sem exceções"} />;
      case "COVERAGE":
        return s.partial?.includes("coverage") ? <p className="text-sm text-ink-secondary">Indisponível agora.</p> : <CompactKpi value={s.coverage.uncoveredTotal} label="turnos a rever" sub={`Hoje ${s.coverage.uncoveredToday} · Amanhã ${s.coverage.uncoveredTomorrow}`} tone="critical" />;
      case "REQUESTS":
        return s.partial?.includes("requests") ? <p className="text-sm text-ink-secondary">Indisponível agora.</p> : <CompactKpi value={s.requests.decidable} label="pendentes" sub="Aprovar ou recusar ao expandir" />;
      case "GOOGLE_REVIEWS":
        return <GoogleReviewsCompact />;
      case "BIRTHDAYS":
        return birthdays.data ? <CompactKpi value={birthdays.data.length} label="nos próximos 30 dias" sub={birthdays.data[0] ? `Próximo: ${birthdays.data[0].name}` : undefined} /> : null;
      case "HOLIDAYS":
        return <CompactKpi value={s.holidays.length} label="próximos" sub={s.holidays[0] ? `${s.holidays[0].name} (${s.holidays[0].date.slice(8, 10)}/${s.holidays[0].date.slice(5, 7)})` : "Sem feriados próximos"} />;
      default:
        return null;
    }
  };

  const body = (id: WidgetId): { icon: ReactNode; node: ReactNode; detail?: ReactNode; count?: number; critical?: boolean; subtitle?: ReactNode; action?: ReactNode } => {
    if (!s) return { icon: null, node: snap.isError ? <WidgetMessage text="Sem dados (o resumo não carregou)." /> : <WidgetSkeleton /> };
    switch (id) {
      case "ATTENTION":
        return {
          icon: <IconAlert size={18} />,
          node: <AttentionBody s={s} limit={SUMMARY_ITEMS} />,
          detail: s.attention.length > SUMMARY_ITEMS ? <AttentionBody s={s} /> : undefined,
          count: s.attention.reduce((n, a) => n + a.count, 0),
          critical: true,
        };
      case "TEAM_STATUS":
        return {
          icon: <IconUsers size={18} />,
          node: <TeamBody s={s} onOpen={setTeamCat} format={chart} />,
          subtitle: `Hoje, ${longDate(s.localDate)}`,
          action: (
            <SegmentedControl size="sm" label="Formato do gráfico" value={chart} onChange={chooseChart} items={TEAM_CHARTS.map((k) => ({ key: k, label: TEAM_CHART_LABEL[k] }))} />
          ),
        };
      case "LOCATIONS_STATUS":
        return {
          icon: <IconStore size={18} />,
          node: <UnitsSummary s={s} onOpen={setUnit} limit={SUMMARY_ITEMS} />,
          detail: <UnitsBody s={s} onOpen={setUnit} onlyAttention={onlyAttention} onClearFilter={() => setOnlyAttention(false)} />,
        };
      case "COVERAGE":
        return { icon: <IconCalendar size={18} />, node: <CoverageBody s={s} onRetry={() => void snap.refetch()} />, detail: s.locations.length > 0 ? <CoverageDetail s={s} /> : undefined };
      case "REQUESTS":
        return {
          icon: <IconFile size={18} />,
          node: <RequestsBody editing={editing} limit={SUMMARY_ITEMS} unavailable={!!s.partial?.includes("requests")} onRetry={() => void snap.refetch()} />,
          detail: s.requests.decidable > SUMMARY_ITEMS ? <RequestsBody editing={editing} limit={50} unavailable={!!s.partial?.includes("requests")} onRetry={() => void snap.refetch()} /> : undefined,
          count: s.partial?.includes("requests") ? undefined : s.requests.decidable,
          critical: true,
          action: (
            <Link to="/hr/novo/pedidos" className="text-sm font-medium text-brand-600 hover:underline">
              Ver todas
            </Link>
          ),
        };
      case "GOOGLE_REVIEWS":
        return { icon: <span aria-hidden="true" className="text-base">★</span>, node: <GoogleReviewsBody limit={SUMMARY_ITEMS} />, detail: <GoogleReviewsBody /> };
      case "BIRTHDAYS":
        return { icon: <IconUsers size={18} />, node: <BirthdaysBody today={s.localDate} limit={SUMMARY_ITEMS} />, detail: <BirthdaysBody today={s.localDate} limit={50} /> };
      case "HOLIDAYS":
        return { icon: <IconCalendar size={18} />, node: <HolidaysBody s={s} limit={SUMMARY_ITEMS} />, detail: s.holidays.length > SUMMARY_ITEMS ? <HolidaysBody s={s} /> : undefined };
      case "REPORTS":
        return { icon: <IconFile size={18} />, node: <ReportsBody limit={SUMMARY_ITEMS} />, detail: <ReportsBody limit={50} /> };
      default:
        return { icon: null, node: null };
    }
  };

  // Aniversários: só a quem pode ver a data de nascimento (o backend responde 403 aos outros).
  const birthdays = useQuery({ queryKey: ["novo-rh", "dashboard", "birthdays"], queryFn: () => dashboard.birthdays(), staleTime: 60 * 60_000, retry: false, enabled: !!s });
  const hide = (id: string) => id === "BIRTHDAYS" && birthdays.isError;
  const selDef = selected ? widgetDef(selected) : undefined;
  const parts = useMemo(() => (s ? summaryParts(s) : []), [s]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-navy-900 sm:text-[32px]">Dashboard</h1>
          <p className="text-sm text-ink-secondary">{editing ? "Arraste os módulos, ajuste o tamanho e escolha o que mostrar." : "Visão geral da sua operação"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {units.length > 1 && !editing && (
            <SearchableSelect
              label="Contexto"
              allLabel="Toda a organização"
              icon={<IconStore size={18} />}
              value={locationId ?? ""}
              options={units.map((u) => ({ id: u.locationId, label: u.name }))}
              onChange={(v) => (setLocationId(v || null), setOnlyAttention(false))}
              triggerClassName="h-10"
            />
          )}
          {editing ? (
            <>
              <Button variant="tertiary" loading={reset.isPending} onClick={() => reset.mutate()}>
                Restaurar padrão
              </Button>
              <Button onClick={cancel}>Cancelar</Button>
              <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(current)}>
                Guardar layout
              </Button>
            </>
          ) : (
            <Button icon={<IconSliders size={16} />} onClick={startEditing} disabled={!layoutQ.data}>
              Personalizar
            </Button>
          )}
        </div>
      </header>

      {/* Resumo "Hoje": frase determinística a partir do mesmo agregado dos widgets. */}
      <section aria-label="Resumo de hoje" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm motion-safe:animate-motion-fade-up">
        <span className="flex items-center gap-2 font-semibold uppercase tracking-wide text-brand-600">
          <IconCalendar size={16} /> Hoje
        </span>
        {!s ? (
          <Skeleton className="h-4 w-72" />
        ) : (
          <>
            {parts.map((p, i) => (
              <span key={p.key} className="flex items-center gap-3">
                {i > 0 && <span aria-hidden="true" className="text-ink-muted">·</span>}
                <button type="button" onClick={() => goTo(p)} className="flex items-center gap-1.5 rounded-md text-ink hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">
                  {p.tone !== "neutral" && <span aria-hidden="true" className={`h-2 w-2 rounded-full ${SUMMARY_TONE[p.tone]}`} />}
                  <strong className="font-semibold tabular-nums text-navy-900">{p.count}</strong> {p.label}
                </button>
              </span>
            ))}
            {isCalm(s) && (
              <span className="flex items-center gap-3">
                <span aria-hidden="true" className="text-ink-muted">·</span>
                <span className="text-emerald-700">operação sem pendências críticas</span>
              </span>
            )}
            {s.context.name && <span className="ml-auto text-xs text-ink-secondary">{s.context.name}</span>}
          </>
        )}
      </section>

      {snap.isError && !s && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>
            Não foi possível carregar o Dashboard agora.
            <span className="block text-xs text-red-700/80">{snap.error instanceof ApiError ? `${snap.error.status} · ${snap.error.message}` : snap.error instanceof Error ? snap.error.message : ""}</span>
          </span>
          <Button size="sm" onClick={() => void snap.refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}
      {snap.isLoading && (slow || warming(snap.failureReason)) && (
        <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          A calcular o estado de hoje para toda a equipa — está a demorar mais do que o normal. Os dados aparecem assim que terminar.
        </p>
      )}

      <div className="flex items-start gap-4">
        {/*
          Duas colunas por linha, com a mesma altura na linha. O detalhe expandido
          entra logo a seguir à linha, a toda a largura (em telemóvel, logo a seguir
          ao widget), e empurra o resto para baixo — sem modal nem sobreposição.
        */}
        <div ref={root} className="min-w-0 flex-1 space-y-4">
          {dashboardRows(shown.filter((w) => !hide(w.widgetId))).map((row) => {
            const open = editing ? -1 : row.findIndex((w) => w.widgetId === expanded);
            return (
              <div
                key={row.map((w) => w.widgetId).join("|")}
                data-row=""
                style={{ "--cols": rowColumns(row.length, open) } as CSSProperties}
                className="grid grid-cols-1 items-stretch gap-4 lg:[grid-template-columns:var(--cols)] motion-safe:transition-[grid-template-columns] motion-safe:duration-[240ms] motion-safe:ease-[cubic-bezier(.2,.7,.2,1)]"
              >
                {row.map((w, i) => {
                  const b = body(w.widgetId as WidgetId);
                  const state = open < 0 ? "normal" : open === i ? "expanded" : "compact";
                  return (
                    <DashboardWidget
                      key={w.widgetId}
                      def={w.def}
                      full={false}
                      icon={b.icon}
                      count={b.count}
                      countTone={b.critical ? "critical" : "neutral"}
                      subtitle={b.subtitle}
                      action={b.action}
                      edit={editProps(w)}
                      detail={b.detail}
                      compact={compactOf(w.widgetId as WidgetId)}
                      expand={editing ? undefined : { state, canExpand: !!b.detail, onToggle: () => toggleExpanded(w.widgetId) }}
                    >
                      {b.node}
                    </DashboardWidget>
                  );
                })}
              </div>
            );
          })}
        </div>

        {editing && (
          <aside aria-label="Personalizar painel" className="sticky top-4 hidden w-72 shrink-0 space-y-4 rounded-2.5xl border border-line bg-surface-card p-4 shadow-pop lg:block">
            <div>
              <h2 className="text-base font-semibold text-navy-900">Personalizar painel</h2>
              <p className="text-xs text-ink-secondary">Ordem, visibilidade e tamanho de cada módulo.</p>
            </div>
            <ol className="space-y-1">
              {shown.map((w, i) => (
                <li key={w.widgetId} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${selected === w.widgetId ? "bg-brand-50" : ""}`}>
                  <input type="checkbox" aria-label={`Mostrar ${w.def.title}`} checked={!w.hidden} onChange={() => setDraft((d) => toggleHidden(d ?? saved, w.widgetId))} />
                  <button type="button" className="min-w-0 flex-1 truncate text-left text-ink" onClick={() => setSelected(w.widgetId)}>
                    {i + 1}. {w.def.title}
                  </button>
                  <button type="button" aria-label={`Subir ${w.def.title}`} disabled={i === 0} onClick={() => setDraft((d) => moveBy(d ?? saved, w.widgetId, -1))} className="rounded px-1 text-ink-secondary hover:text-navy-900 disabled:opacity-30">
                    <IconChevronDown size={14} className="rotate-180" />
                  </button>
                  <button type="button" aria-label={`Descer ${w.def.title}`} disabled={i === shown.length - 1} onClick={() => setDraft((d) => moveBy(d ?? saved, w.widgetId, 1))} className="rounded px-1 text-ink-secondary hover:text-navy-900 disabled:opacity-30">
                    <IconChevronDown size={14} />
                  </button>
                </li>
              ))}
            </ol>
            {selDef && (
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Tamanho — {selDef.title}</h3>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Tamanho de ${selDef.title}`}>
                  {selDef.allowedSpans.map((sp) => {
                    const on = current.find((w) => w.widgetId === selDef.id)?.span === sp;
                    return (
                      <button key={sp} type="button" role="radio" aria-checked={on} onClick={() => setDraft((d) => setSpan(d ?? saved, selDef.id, sp))} className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${on ? "border-brand-500 bg-brand-50 text-brand-600" : "border-line text-ink-secondary hover:text-navy-900"}`}>
                        {spanLabel(sp, selDef)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {save.isError && <p className="text-xs text-red-700">Não foi possível guardar o layout.</p>}
          </aside>
        )}
      </div>

      <TeamDrawer category={teamCat} s={s ?? emptySnapshot} onClose={() => setTeamCat(null)} />
      <UnitDrawer unit={unit} onClose={() => setUnit(null)} onFocusUnit={(id) => setLocationId(id)} />
    </div>
  );
}

const emptySnapshot = {
  generatedAt: "",
  context: { type: "organization" as const, locationId: null, name: null },
  localDate: "",
  tomorrow: "",
  units: { operational: 0, requiringAttention: 0 },
  team: { total: 0, working: 0, remote: 0, break: 0, finished: 0, not_started: 0, vacation: 0, absent: 0, late: 0, missing: 0 },
  coverage: { uncoveredToday: 0, uncoveredTomorrow: 0, uncoveredTotal: 0 },
  requests: { pending: 0, decidable: 0 },
  attention: [],
  locations: [],
  holidays: [],
};
