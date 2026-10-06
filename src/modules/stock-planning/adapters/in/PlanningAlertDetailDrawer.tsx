import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStockPlanningModule } from "../../stock-planning.module.tsx";
import { SeverityBadge, StateBadge } from "./ConfidenceBadge.tsx";
import { ProjectionChartCard } from "./ProjectionChartCard.tsx";
import { QualityChecklist, AffectedProductsGrid } from "./QualityChecklist.tsx";
import { formatIsoDatePt } from "../../../../lib/format.ts";
import {
  PLANNING_ALERT_TYPE_LABELS,
  PLANNING_ALERT_SEVERITY_LABELS,
  PLANNING_ALERT_STATE_LABELS,
} from "../../domain/entities/stock-planning.ts";

type Tab = "details" | "history" | "affected";

const TABS: { key: Tab; label: string }[] = [
  { key: "details", label: "Detalhes" },
  { key: "history", label: "Histórico" },
  { key: "affected", label: "Produtos afetados" },
];

function readNumber(snapshot: Record<string, unknown>, key: string): number | null {
  const v = snapshot[key];
  return typeof v === "number" ? v : null;
}

export function PlanningAlertDetailDrawer({ alertId, onClose }: { alertId: string; onClose: () => void }) {
  const { api } = useStockPlanningModule();
  const [tab, setTab] = useState<Tab>("details");

  const { data: alert, isLoading, isError } = useQuery({
    queryKey: ["stock-planning-alert-detail", alertId],
    queryFn: () => api.getAlertDetail(alertId),
  });

  const currentStock = alert ? readNumber(alert.contextSnapshot, "currentStock") ?? readNumber(alert.contextSnapshot, "currentQuantity") : null;
  const coverageDays = alert ? readNumber(alert.contextSnapshot, "coverageDays") : null;
  const nextWindow = alert ? (alert.contextSnapshot["nextDeliveryDate"] as string | undefined) ?? null : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-stone-200 px-5 py-4">
          <div>
            {isLoading ? (
              <p className="text-sm text-stone-400">A carregar…</p>
            ) : isError || !alert ? (
              <p className="text-sm text-stone-400">Alerta não encontrado.</p>
            ) : (
              <>
                <h2 className="text-lg font-bold text-stone-900">{alert.itemName}</h2>
                <p className="text-xs text-stone-400">{PLANNING_ALERT_TYPE_LABELS[alert.alertType]}</p>
                <div className="mt-1 flex items-center gap-2">
                  <SeverityBadge severity={alert.severity} label={PLANNING_ALERT_SEVERITY_LABELS[alert.severity]} />
                  <StateBadge state={alert.state} label={PLANNING_ALERT_STATE_LABELS[alert.state]} />
                </div>
              </>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">✕</button>
        </div>

        {alert && (
          <>
            <div className="flex gap-1 border-b border-stone-200 bg-stone-50/60 px-5 py-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${tab === t.key ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {tab === "details" && (
                <>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-stone-700">
                    {alert.explanation || "Sem explicação adicional disponível para este alerta."}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-stone-200 bg-white p-3">
                      <p className="text-xs text-stone-500">Stock atual</p>
                      <p className="mt-0.5 text-lg font-bold text-stone-800">{currentStock != null ? currentStock.toLocaleString("pt-PT", { maximumFractionDigits: 2 }) : "—"}</p>
                    </div>
                    <div className="rounded-xl border border-stone-200 bg-white p-3">
                      <p className="text-xs text-stone-500">Cobertura estimada</p>
                      <p className="mt-0.5 text-lg font-bold text-stone-800">{coverageDays != null ? `${coverageDays.toLocaleString("pt-PT", { maximumFractionDigits: 1 })} dias` : "—"}</p>
                    </div>
                    <div className="rounded-xl border border-stone-200 bg-white p-3">
                      <p className="text-xs text-stone-500">Próxima janela</p>
                      <p className="mt-0.5 text-lg font-bold text-stone-800">{nextWindow ? formatIsoDatePt(nextWindow) : "—"}</p>
                    </div>
                  </div>

                  <ProjectionChartCard title="Projeção de stock" projection={alert.projection} />
                  <QualityChecklist quality={alert.quality} />
                </>
              )}

              {tab === "history" && (
                <div className="rounded-xl border border-stone-200 bg-white p-4">
                  <p className="text-sm text-stone-600">
                    Alerta detetado em {formatIsoDatePt(alert.firstDetectedAt)}, última atualização em {formatIsoDatePt(alert.lastUpdatedAt)}
                    {alert.resolvedAt ? `, resolvido em ${formatIsoDatePt(alert.resolvedAt)}` : ""}.
                  </p>
                  <p className="mt-2 text-xs text-stone-400">
                    Histórico detalhado de transições deste alerta (reconhecimentos/silenciamentos anteriores) não é exposto por uma API própria nesta versão — ver README do módulo.
                  </p>
                </div>
              )}

              {tab === "affected" && <AffectedProductsGrid products={alert.affectedProducts} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
