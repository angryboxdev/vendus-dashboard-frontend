import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useHrModule } from "../../hr.module.tsx";
import { SeverityBadge } from "./components/SeverityBadge.tsx";
import type { BlockResult } from "../../domain/entities/overview.ts";

const REFRESH_INTERVAL_MS = 60_000;

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

  const { data: overview, isLoading } = useQuery({
    queryKey: ["hr-overview"],
    queryFn: () => api.getOverview(),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

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
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-stone-400">
                    <th className="pb-2">Funcionário</th>
                    <th className="pb-2">Estado</th>
                    <th className="pb-2">Último evento</th>
                    <th className="pb-2">Local</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {operation.data.map((row) => (
                    <tr key={row.employeeId}>
                      <td className="py-2">
                        <Link to={`/hr/people/${row.employeeId}`} className="font-medium text-stone-700 hover:text-[#ED5C32] hover:underline">
                          {row.employeeName}
                        </Link>
                      </td>
                      <td className="py-2 text-stone-600">{row.state}</td>
                      <td className="py-2 text-stone-500">{row.lastEvent}</td>
                      <td className="py-2 text-stone-400">{row.locationId ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
