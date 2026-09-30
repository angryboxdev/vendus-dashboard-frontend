import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useStockPlanningModule } from "../../stock-planning.module.tsx";
import { RiskBadge } from "./RiskBadge.tsx";
import { ConfidenceBadge } from "./ConfidenceBadge.tsx";
import { ProjectionChartCard } from "./ProjectionChartCard.tsx";
import { QualityChecklist, AffectedProductsGrid } from "./QualityChecklist.tsx";
import { formatIsoDatePt } from "../../../../lib/format.ts";

type Tab = "overview" | "forecast" | "recommendation" | "affected" | "history";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Visão geral" },
  { key: "forecast", label: "Projeção e forecast" },
  { key: "recommendation", label: "Recomendação" },
  { key: "affected", label: "Produtos afetados" },
  { key: "history", label: "Histórico e preço" },
];

function fmt(n: number | null | undefined, unit?: string): string {
  if (n == null) return "—";
  return `${n.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
}

function fmtEUR(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

export function PlanningItemDetailDrawer({
  stockItemId,
  locationId,
  onClose,
}: {
  stockItemId: string;
  locationId: string;
  onClose: () => void;
}) {
  const { api } = useStockPlanningModule();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");

  const { data: item, isLoading, isError } = useQuery({
    queryKey: ["stock-planning-item-detail", stockItemId, locationId],
    queryFn: () => api.getItemDetail(stockItemId, locationId),
  });

  const demandChartData = (item?.demandPoints ?? []).map((p) => ({
    date: p.date,
    Previsto: p.predictedQuantity,
    Realizado: p.actualQuantity,
  }));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-stone-200 px-5 py-4">
          <div>
            {isLoading ? (
              <p className="text-sm text-stone-400">A carregar…</p>
            ) : isError || !item ? (
              <p className="text-sm text-stone-400">Item não encontrado.</p>
            ) : (
              <>
                <h2 className="text-lg font-bold text-stone-900">{item.name}</h2>
                <div className="mt-1 flex items-center gap-2">
                  <RiskBadge risk={item.riskLevel} />
                  <ConfidenceBadge confidence={item.confidence} />
                </div>
              </>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
            ✕
          </button>
        </div>

        {item && (
          <>
            <div className="flex gap-1 overflow-x-auto border-b border-stone-200 bg-stone-50/60 px-5 py-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    tab === t.key ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {tab === "overview" && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-stone-200 bg-white p-3">
                      <p className="text-xs text-stone-500">Stock atual</p>
                      <p className="mt-0.5 text-lg font-bold text-stone-800">{fmt(item.currentQuantity, item.baseUnit)}</p>
                    </div>
                    <div className="rounded-xl border border-stone-200 bg-white p-3">
                      <p className="text-xs text-stone-500">Cobertura estimada</p>
                      <p className="mt-0.5 text-lg font-bold text-stone-800">{item.coverageDays != null ? `${fmt(item.coverageDays)} dias` : "—"}</p>
                    </div>
                    <div className="rounded-xl border border-stone-200 bg-white p-3">
                      <p className="text-xs text-stone-500">Próxima janela de entrega</p>
                      <p className="mt-0.5 text-lg font-bold text-stone-800">{formatIsoDatePt(item.recommendation?.nextDeliveryDate ?? null)}</p>
                    </div>
                  </div>
                  <ProjectionChartCard projection={item.projection} ruptureDate={item.ruptureDate} baseUnit={item.baseUnit} />
                  <QualityChecklist quality={item.quality} confidence={item.confidence} />
                  <AffectedProductsGrid products={item.affectedProducts} />
                </>
              )}

              {tab === "forecast" && (
                <>
                  <ProjectionChartCard title="Projeção de stock" projection={item.projection} ruptureDate={item.ruptureDate} baseUnit={item.baseUnit} />
                  <div className="rounded-xl border border-stone-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-stone-700">Vendas/consumo previsto vs. real</h3>
                    {demandChartData.length === 0 ? (
                      <p className="text-xs text-stone-400">Sem pontos de procura disponíveis.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={demandChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                          <XAxis dataKey="date" tickFormatter={(d: string) => formatIsoDatePt(d)} tick={{ fontSize: 10, fill: "#78716c" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#78716c" }} axisLine={false} tickLine={false} width={40} />
                          <Tooltip labelFormatter={(d: string) => formatIsoDatePt(d)} />
                          <Legend formatter={(v) => <span style={{ fontSize: 12, color: "#57534e" }}>{v}</span>} />
                          <Bar dataKey="Previsto" fill="#EF8935" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="Realizado" fill="#ED5C32" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </>
              )}

              {tab === "recommendation" && (
                item.recommendation ? (
                  <div className="rounded-xl border border-stone-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-stone-700">
                      Por que comprar {fmt(item.recommendation.suggestedPurchaseQty ?? item.recommendation.suggestedBaseQty, item.recommendation.purchaseUnit ?? item.baseUnit)}?
                    </h3>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-xs text-stone-400">Stock atual</dt><dd className="font-medium text-stone-700">{fmt(item.recommendation.stockNow, item.baseUnit)}</dd></div>
                      <div><dt className="text-xs text-stone-400">Stock alvo</dt><dd className="font-medium text-stone-700">{fmt(item.recommendation.targetStock, item.baseUnit)}</dd></div>
                      <div><dt className="text-xs text-stone-400">Stock de segurança</dt><dd className="font-medium text-stone-700">{fmt(item.recommendation.safetyStock, item.baseUnit)}</dd></div>
                      <div><dt className="text-xs text-stone-400">Projetado na janela</dt><dd className="font-medium text-stone-700">{fmt(item.recommendation.projectedAtWindow, item.baseUnit)}</dd></div>
                      <div><dt className="text-xs text-stone-400">Quantidade sugerida (base)</dt><dd className="font-medium text-stone-700">{fmt(item.recommendation.suggestedBaseQty, item.baseUnit)}</dd></div>
                      <div><dt className="text-xs text-stone-400">Quantidade sugerida (compra)</dt><dd className="font-medium text-stone-700">{fmt(item.recommendation.suggestedPurchaseQty, item.recommendation.purchaseUnit ?? undefined)}</dd></div>
                      <div><dt className="text-xs text-stone-400">Custo estimado</dt><dd className="font-medium text-stone-700">{fmtEUR(item.recommendation.estimatedCost)}</dd></div>
                      <div><dt className="text-xs text-stone-400">Próxima entrega</dt><dd className="font-medium text-stone-700">{formatIsoDatePt(item.recommendation.nextDeliveryDate)}</dd></div>
                      <div><dt className="text-xs text-stone-400">Entrega seguinte</dt><dd className="font-medium text-stone-700">{formatIsoDatePt(item.recommendation.followingDeliveryDate)}</dd></div>
                    </dl>
                    <button
                      type="button"
                      onClick={() => navigate(`/stock/planeamento/lista-compras?highlight=${item.recommendation!.recommendationId ?? ""}`)}
                      className="mt-4 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                      Ver na lista de compras
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-stone-400">Sem recomendação de compra ativa para este item.</p>
                )
              )}

              {tab === "affected" && <AffectedProductsGrid products={item.affectedProducts} />}

              {tab === "history" && (
                <div className="rounded-xl border border-stone-200 bg-white p-4">
                  <h3 className="mb-2 text-sm font-semibold text-stone-700">Histórico e preço</h3>
                  {item.recommendation?.estimatedCost != null && item.recommendation.suggestedPurchaseQty ? (
                    <p className="text-sm text-stone-600">
                      Custo unitário estimado mais recente: <span className="font-medium">{fmtEUR(item.recommendation.estimatedCost / item.recommendation.suggestedPurchaseQty)}</span> / {item.recommendation.purchaseUnit ?? item.baseUnit}
                    </p>
                  ) : (
                    <p className="text-xs text-stone-400">Sem custo estimado disponível.</p>
                  )}
                  <p className="mt-2 text-xs text-stone-400">
                    Histórico de preço por item ainda não é exposto por uma API própria nesta versão — ver README do módulo.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
