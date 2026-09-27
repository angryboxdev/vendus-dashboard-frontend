import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useHrModule } from "../../hr.module.tsx";
import { SeverityBadge } from "./components/SeverityBadge.tsx";
import { ShiftReviewModal } from "./ShiftReviewModal.tsx";
import type { BlockResult, OverviewOperationRow } from "../../domain/entities/overview.ts";

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

function KpiCard({
  label,
  block,
  format,
  valueCls = "text-stone-800",
  to,
}: {
  label: string;
  block: BlockResult<number>;
  format?: (n: number) => string;
  valueCls?: string;
  to?: string;
}) {
  const content = (
    <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm transition-colors hover:bg-[#FDF8F5]">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      {block.status === "ok" ? (
        <p className={`mt-1 text-xl font-bold ${valueCls}`}>{format ? format(block.data) : block.data}</p>
      ) : (
        <p className="mt-1 text-sm font-medium text-stone-400" title={block.reason}>
          Indisponível
        </p>
      )}
    </div>
  );
  if (!to || block.status !== "ok") return content;
  return (
    <Link to={to} className="block">
      {content}
    </Link>
  );
}

export function OverviewView() {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [reviewShiftId, setReviewShiftId] = useState<string | null>(null);

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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Equipa */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Equipa</h2>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Funcionários ativos"
                block={team.status === "ok" ? { status: "ok", data: team.data.activeEmployees } : team}
                valueCls="text-emerald-600"
                to="/hr/people?status=active"
              />
              <KpiCard
                label="Admissões este mês"
                block={team.status === "ok" ? { status: "ok", data: team.data.admissionsThisMonth } : team}
                to="/hr/people?status=active"
              />
              <KpiCard
                label="Dados incompletos"
                block={team.status === "ok" ? { status: "ok", data: team.data.incompleteProfiles } : team}
                valueCls="text-amber-600"
                to="/hr/people?profileComplete=incomplete"
              />
              <KpiCard
                label="Documentos a expirar"
                block={team.status === "ok" ? { status: "ok", data: team.data.documentsExpiringSoon } : team}
                valueCls="text-red-600"
                to="/hr/people?documentSituation=expiring"
              />
            </div>
          </div>

          {/* Operação hoje */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Operação hoje</h2>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Escalados hoje"
                block={today.status === "ok" ? { status: "ok", data: today.data.scheduledCount } : today}
                to="/hr/calendar"
              />
              <KpiCard
                label="Presentes agora"
                block={today.status === "ok" ? { status: "ok", data: today.data.presentCount } : today}
                valueCls="text-emerald-600"
                to="/hr/calendar"
              />
              <KpiCard
                label="Atrasos hoje"
                block={today.status === "ok" ? { status: "ok", data: today.data.lateCount } : today}
                valueCls="text-amber-600"
                to="/hr/calendar"
              />
              <KpiCard
                label="Ausentes hoje"
                block={today.status === "ok" ? { status: "ok", data: today.data.absentCount } : today}
                valueCls="text-red-600"
                to="/hr/calendar"
              />
            </div>
          </div>

          {/* Pendências */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Pendências</h2>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Turnos por conferir"
                block={pending.status === "ok" ? { status: "ok", data: pending.data.shiftsToReviewCount } : pending}
                valueCls="text-violet-600"
                to="/hr/overview/shifts-to-review"
              />
              <KpiCard
                label="Pagamentos pendentes"
                block={pending.status === "ok" ? { status: "ok", data: pending.data.unpaidPaymentsCount } : pending}
                valueCls="text-stone-600"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Alertas prioritários */}
          <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-stone-800">Alertas prioritários</h2>
            <p className="mb-3 text-xs text-stone-500">Principais situações que requerem atenção imediata.</p>
            {alerts.status !== "ok" ? (
              <p className="text-sm text-stone-400" title={alerts.reason}>
                Indisponível
              </p>
            ) : alerts.data.length === 0 ? (
              <p className="text-sm text-stone-400">Sem alertas no momento.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.data.map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={a.severity} />
                      <Link to={`/hr/people/${a.employeeId}`} className="font-medium text-stone-700 hover:text-[#ED5C32] hover:underline">
                        {a.message}
                      </Link>
                    </div>
                    <span className="shrink-0 text-xs text-stone-400">{a.employeeName}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Hoje na operação */}
          <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4 shadow-sm">
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
                        <tr key={row.employeeId} className={row.state === "CONFLITO" ? "bg-red-50/40" : undefined}>
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
          </div>
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
    </div>
  );
}
