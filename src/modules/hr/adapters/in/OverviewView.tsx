import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useHrModule } from "../../hr.module.tsx";
import { SeverityBadge } from "./components/SeverityBadge.tsx";
import { ShiftReviewModal } from "./ShiftReviewModal.tsx";
import { PendencyDrawer, type PendencyPanelKind } from "./PendencyDrawer.tsx";
import type { BlockResult, OverviewAlert, OverviewOperationRow } from "../../domain/entities/overview.ts";
import {
  MOTION_CARD_HOVER,
  MOTION_ROW_HOVER,
  MotionFade,
  MotionNumber,
  MotionPresence,
  MotionStagger,
  motionRiseItem,
  useFirstBatch,
  useRetained,
} from "../../../../components/motion/index.ts";

const PENDENCY_PANELS = new Set<string>(["missing-fields", "missing-documents", "expiring-documents"]);

const REFRESH_INTERVAL_MS = 60_000;

const OPERATION_STATE_STYLES: Record<string, string> = {
  AGENDADO: "bg-sky-50 text-sky-700",
  EM_TOLERANCIA: "bg-violet-50 text-violet-700",
  PRESENTE: "bg-emerald-50 text-emerald-700",
  ATRASADO: "bg-amber-50 text-amber-700",
  AUSENTE: "bg-red-50 text-red-700",
  INTERVALO: "bg-indigo-50 text-indigo-700",
  FINALIZADO: "bg-stone-100 text-stone-600",
  FERIAS: "bg-sky-50 text-sky-700",
  BAIXA: "bg-stone-100 text-stone-600",
  FOLGA: "bg-stone-100 text-stone-600",
  CONFLITO: "bg-red-100 text-red-800",
};

const OPERATION_STATE_LABELS: Record<string, string> = {
  AGENDADO: "Agendado",
  EM_TOLERANCIA: "Em tolerância",
  PRESENTE: "Presente",
  ATRASADO: "Atrasado",
  AUSENTE: "Ausente",
  INTERVALO: "Intervalo",
  FINALIZADO: "Concluído",
  FERIAS: "Férias",
  BAIXA: "Baixa",
  FOLGA: "Folga",
  CONFLITO: "Conflito",
};

function OperationStateBadge({ state }: { state: string }) {
  const cls = OPERATION_STATE_STYLES[state] ?? "bg-stone-100 text-stone-600";
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{OPERATION_STATE_LABELS[state] ?? state}</span>;
}

/** Primeiro + segundo nome — mesma convenção de `SchedulesView.tsx`/`DaySummaryPanel.tsx` (ex: "Gabriel Gomes Souza" → "Gabriel Gomes"), para o mesmo colaborador aparecer sempre com o mesmo nome curto em toda a parte do módulo. */
function shortName(fullName: string): string {
  return fullName.trim().split(/\s+/).slice(0, 2).join(" ");
}

/**
 * Nome curto por linha, com desambiguação: quando duas ou mais linhas
 * partilham o mesmo nome curto (1º + 2º nome), essas linhas passam a
 * mostrar também o último nome. Não é um algoritmo de desambiguação
 * mínima rigoroso (ex: 2 colisões com o mesmo último nome continuam
 * iguais) — suficiente para o volume de equipa deste ecrã.
 */
function computeShortNames(rows: OverviewOperationRow[]): Map<string, string> {
  const countByShort = new Map<string, number>();
  for (const row of rows) {
    const short = shortName(row.employeeName);
    countByShort.set(short, (countByShort.get(short) ?? 0) + 1);
  }
  const result = new Map<string, string>();
  for (const row of rows) {
    const short = shortName(row.employeeName);
    if ((countByShort.get(short) ?? 0) <= 1) {
      result.set(row.employeeId, short);
      continue;
    }
    const parts = row.employeeName.trim().split(/\s+/);
    result.set(row.employeeId, parts.length <= 2 ? short : `${short} ${parts[parts.length - 1]}`);
  }
  return result;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  return `Hoje, ${date} · Atualizado às ${time}`;
}

/** Chave estável de um alerta — um alerta novo num refresh anima sozinho; os outros não reanimam. */
const ALERTS_RISE_START_MS = 450;
const alertKey = (a: OverviewAlert) => `${a.employeeId}:${a.message}`;

type KpiTone = "neutral" | "positive" | "warning" | "danger";

const TONE_CLASS: Record<KpiTone, string> = {
  neutral: "text-stone-800",
  positive: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-red-600",
};

/** Cores com significado (task "Reorganização dos KPIs", §5): com valor 0 o KPI fica neutro. */
function toneClass(tone: KpiTone, value: number): string {
  return value > 0 ? TONE_CLASS[tone] : TONE_CLASS.neutral;
}

/** Grupo de KPIs com título centrado e divisor subtil (sem card extra à volta). */
function KpiGroup({
  title,
  startIndex,
  gridClassName,
  className = "",
  children,
}: {
  title: string;
  startIndex: number;
  gridClassName: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className={className}>
      <h2 className="text-center text-xs font-semibold uppercase tracking-wide text-stone-400">{title}</h2>
      <div className="mb-3 mt-1.5 h-px w-full bg-[#F5C992]/50" aria-hidden="true" />
      <MotionStagger className={`grid gap-3 ${gridClassName}`} startIndex={startIndex}>
        {children}
      </MotionStagger>
    </section>
  );
}

function KpiCard({
  label,
  block,
  format,
  tone = "neutral",
  to,
  onClick,
}: {
  label: string;
  block: BlockResult<number>;
  format?: (n: number) => string;
  /** Cor semântica do valor — só aplicada quando o valor é > 0 (zero sem problema fica neutro). */
  tone?: KpiTone;
  to?: string;
  /** Abre um drawer sobreposto em vez de navegar (pendências — task "Melhorar Visão Geral e reorganizar Pessoas", secção 6: "abrir primeiro um drawer lateral, sem sair da Visão Geral"). Tem prioridade sobre `to` quando os dois são passados. */
  onClick?: () => void;
}) {
  const interactive = block.status === "ok" && (to !== undefined || onClick !== undefined);
  const content = (
    <div
      className={`flex h-full min-h-[88px] flex-col justify-between rounded-xl border border-[#F5C992]/40 bg-white px-4 py-3 shadow-sm hover:bg-[#FDF8F5] ${interactive ? MOTION_CARD_HOVER : "transition-colors"}`}
    >
      <p className="text-xs font-medium text-stone-500">{label}</p>
      {block.status === "ok" ? (
        <p className={`mt-1 text-2xl font-bold ${toneClass(tone, block.data)}`}>
          <MotionNumber value={block.data} format={format} />
        </p>
      ) : (
        <p className="mt-1 text-sm font-medium text-stone-400" title={block.reason}>
          Indisponível
        </p>
      )}
    </div>
  );
  if (block.status !== "ok" || (!to && !onClick)) return content;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left">
        {content}
      </button>
    );
  }
  return (
    <Link to={to!} className="block">
      {content}
    </Link>
  );
}

export function OverviewView() {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reviewShiftId, setReviewShiftId] = useState<string | null>(null);

  // Estado do drawer de pendências vive no URL (`?panel=...`) — Back funciona, refresh preserva o contexto, e é deep-linkável (task "Melhorar Visão Geral e reorganizar Pessoas", secção 13).
  const panelParam = searchParams.get("panel");
  const activePanel = panelParam && PENDENCY_PANELS.has(panelParam) ? (panelParam as PendencyPanelKind) : null;
  // O drawer continua com o mesmo conteúdo durante a animação de saída.
  const shownPanel = useRetained(activePanel);
  function openPanel(panel: PendencyPanelKind) {
    const next = new URLSearchParams(searchParams);
    next.set("panel", panel);
    setSearchParams(next);
  }
  function closePanel() {
    const next = new URLSearchParams(searchParams);
    next.delete("panel");
    setSearchParams(next);
  }

  const { data: overview, isLoading } = useQuery({
    queryKey: ["hr-overview"],
    queryFn: () => api.getOverview(),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const { data: reviewingShift } = useQuery({
    queryKey: ["hr-shift-to-review", reviewShiftId],
    queryFn: () => api.getShiftToReview(reviewShiftId!),
    enabled: reviewShiftId !== null,
  });

  function openEmployeeSchedule(row: OverviewOperationRow) {
    navigate(`/hr/schedules?employeeId=${row.employeeId}`);
  }

  // 1.º lote de alertas: sobem em sequência; os que surgirem depois sobem sozinhos (task §10).
  const firstAlerts = useFirstBatch(overview?.alerts.status === "ok" ? overview.alerts.data.map(alertKey) : []);

  if (isLoading || !overview) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#FAF6F3]">
        <p className="text-sm text-stone-400">A carregar…</p>
      </div>
    );
  }

  const { team, today, pending, alerts, operation } = overview;

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Visão Geral</h1>
            <p className="mt-0.5 text-sm text-stone-500">Resumo da operação de hoje e principais indicadores da equipa.</p>
          </div>
          <p className="text-xs text-stone-400">{formatDateTime(overview.generatedAt)}</p>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {/* 3 grupos numa faixa (24% | 38% | 38%); em ecrãs menores quebram, sem perder o agrupamento. */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-[24fr_38fr_38fr]">
          <KpiGroup title="Equipa" startIndex={0} gridClassName="grid-cols-2 xl:grid-cols-1">
            <KpiCard
              label="Funcionários ativos"
              block={team.status === "ok" ? { status: "ok", data: team.data.activeEmployees } : team}
              tone="positive"
              to="/hr/people?status=active"
            />
            <KpiCard
              label="Admissões este mês"
              block={team.status === "ok" ? { status: "ok", data: team.data.admissionsThisMonth } : team}
              to="/hr/people?status=active"
            />
          </KpiGroup>

          <KpiGroup title="Operação hoje" startIndex={1} gridClassName="grid-cols-2">
            <KpiCard
              label="Escalados hoje"
              block={today.status === "ok" ? { status: "ok", data: today.data.scheduledCount } : today}
              to="/hr/calendar"
            />
            <KpiCard
              label="Presentes agora"
              block={today.status === "ok" ? { status: "ok", data: today.data.presentCount } : today}
              tone="positive"
              to="/hr/calendar"
            />
            <KpiCard
              label="Atrasos hoje"
              block={today.status === "ok" ? { status: "ok", data: today.data.lateCount } : today}
              tone="warning"
              to="/hr/calendar"
            />
            <KpiCard
              label="Ausentes hoje"
              block={today.status === "ok" ? { status: "ok", data: today.data.absentCount } : today}
              tone="danger"
              to="/hr/calendar"
            />
          </KpiGroup>

          <KpiGroup title="Pendências" startIndex={2} gridClassName="grid-cols-2" className="md:col-span-2 xl:col-span-1">
            <KpiCard
              label="Dados incompletos"
              block={team.status === "ok" ? { status: "ok", data: team.data.incompleteProfiles } : team}
              tone="warning"
              onClick={() => openPanel("missing-fields")}
            />
            <KpiCard
              label="Documentos em falta"
              block={team.status === "ok" ? { status: "ok", data: team.data.missingDocumentsCount } : team}
              tone="danger"
              onClick={() => openPanel("missing-documents")}
            />
            <KpiCard
              label="Documentos a expirar"
              block={team.status === "ok" ? { status: "ok", data: team.data.documentsExpiringSoon } : team}
              tone="warning"
              onClick={() => openPanel("expiring-documents")}
            />
            <KpiCard
              label="Turnos por conferir"
              block={pending.status === "ok" ? { status: "ok", data: pending.data.shiftsToReviewCount } : pending}
              tone="warning"
              to="/hr/overview/shifts-to-review"
            />
          </KpiGroup>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Alertas prioritários */}
          <MotionFade delayMs={200} className="rounded-xl border border-[#F5C992]/40 bg-white p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-stone-800">Alertas prioritários</h2>
            <p className="mb-3 text-xs text-stone-500">Principais situações que requerem atenção imediata.</p>
            {alerts.status !== "ok" ? (
              <p className="text-sm text-stone-400" title={alerts.reason}>
                Indisponível
              </p>
            ) : alerts.data.length === 0 ? (
              <p className="text-sm text-stone-400">Sem alertas no momento.</p>
            ) : (
              // Altura máxima + scroll (como "Hoje na operação"); a <ul> recorta as linhas enquanto sobem — nada sai do painel.
              <div className="max-h-80 overflow-y-auto">
                <ul className="space-y-2 overflow-hidden">
                  {alerts.data.map((a, i) => {
                    const key = alertKey(a);
                    // Só começam depois de o painel acabar de aparecer (fade com 200 ms de atraso + ~220 ms), senão a subida não se vê.
                    const motion = motionRiseItem(i, firstAlerts.has(key), ALERTS_RISE_START_MS);
                    return (
                  <li key={key} className={`flex items-center justify-between gap-3 text-sm ${motion.className}`} style={motion.style}>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={a.severity} />
                      <Link to={`/hr/people/${a.employeeId}`} className="font-medium text-stone-700 hover:text-[#ED5C32] hover:underline">
                        {a.message}
                      </Link>
                    </div>
                    <span className="shrink-0 text-xs text-stone-400">{a.employeeName}</span>
                  </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </MotionFade>

          {/* Hoje na operação */}
          <MotionFade delayMs={250} className="rounded-xl border border-[#F5C992]/40 bg-white p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-stone-800">Hoje na operação</h2>
            <p className="mb-3 text-xs text-stone-500">Estado atual da equipa e últimos eventos de assiduidade.</p>
            {operation.status !== "ok" ? (
              <p className="text-sm text-stone-400" title={operation.reason}>
                Indisponível
              </p>
            ) : operation.data.length === 0 ? (
              <p className="text-sm text-stone-400">Sem eventos hoje.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                      <th className="pb-2">Funcionário</th>
                      <th className="pb-2">Estado</th>
                      <th className="pb-2">Turno hoje</th>
                      <th className="pb-2">Situação</th>
                      <th className="pb-2">Local</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {(() => {
                      const shortNames = computeShortNames(operation.data);
                      return operation.data.map((row) => (
                        <tr key={row.employeeId} className={`${MOTION_ROW_HOVER} ${row.state === "CONFLITO" ? "bg-red-50/40" : ""}`}>
                          <td className="py-2 pr-2">
                            <button
                              type="button"
                              onClick={() => openEmployeeSchedule(row)}
                              className="text-left font-medium text-stone-700 hover:text-[#ED5C32] hover:underline"
                              title={row.employeeName}
                            >
                              {shortNames.get(row.employeeId) ?? row.employeeName}
                            </button>
                          </td>
                          <td className="py-2 pr-2">
                            <OperationStateBadge state={row.state} />
                          </td>
                          <td className="py-2 pr-2 text-[12px] leading-snug text-stone-500">
                            {row.shiftToday ? row.shiftToday.map((s, i) => <div key={i}>{s}</div>) : "—"}
                          </td>
                          <td className="py-2 pr-2 text-[12px]">
                            {row.reviewShiftId ? (
                              <button
                                type="button"
                                onClick={() => setReviewShiftId(row.reviewShiftId)}
                                className="font-medium text-red-600 hover:underline"
                                title="Requer conferência — clique para abrir"
                              >
                                {row.situation}
                              </button>
                            ) : (
                              <span className={row.state === "CONFLITO" ? "font-medium text-red-700" : "text-stone-500"}>{row.situation}</span>
                            )}
                            {row.situationWarning &&
                              (row.reviewShiftId ? (
                                <div className="text-[11px] text-amber-600">⚠ {row.situationWarning}</div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openEmployeeSchedule(row)}
                                  className="block text-[11px] text-amber-600 hover:underline"
                                  title="Ver na escala"
                                >
                                  ⚠ {row.situationWarning}
                                </button>
                              ))}
                          </td>
                          <td className="py-2 text-[12px] text-stone-400">{row.locationName ?? "—"}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </MotionFade>
        </div>
      </div>

      {reviewShiftId && reviewingShift && (
        <ShiftReviewModal
          shift={reviewingShift}
          onClose={() => setReviewShiftId(null)}
          onConfirmed={() => {
            setReviewShiftId(null);
            void qc.invalidateQueries({ queryKey: ["hr-overview"] });
          }}
        />
      )}

      <MotionPresence show={activePanel !== null}>
        {shownPanel && <PendencyDrawer panel={shownPanel} onClose={closePanel} />}
      </MotionPresence>
    </div>
  );
}
