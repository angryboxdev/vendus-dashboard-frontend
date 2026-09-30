import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { LocationSelect } from "../../../../components/LocationSelect.tsx";
import { PlanningSubNav } from "./PlanningSubNav.tsx";
import { ForecastFeedbackDrawer } from "./ForecastFeedbackDrawer.tsx";
import { formatIsoDatePt } from "../../../../lib/format.ts";
import type { ForecastDeviationRowDTO } from "../../domain/entities/stock-planning.ts";

const inputCls =
  "rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-[#ED5C32]";

type SubTab = "overview" | "forecasted_sales" | "ingredient_consumption" | "deviations";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "overview", label: "Visão geral" },
  { key: "forecasted_sales", label: "Vendas previstas" },
  { key: "ingredient_consumption", label: "Consumo por ingrediente" },
  { key: "deviations", label: "Desvios e feedback" },
];

const PERIOD_OPTIONS = [
  { value: 14, label: "Últimos 14 dias" },
  { value: 30, label: "Últimos 30 dias" },
  { value: 60, label: "Últimos 60 dias" },
  { value: 90, label: "Últimos 90 dias" },
];

/** Mesmo limiar usado noutros pontos do módulo para "desvio relevante" — não vem do backend (não há flag própria), é uma leitura de exibição. */
const RELEVANT_DEVIATION_THRESHOLD = 0.1;

function fmtQty(n: number): string {
  return n.toLocaleString("pt-PT", { maximumFractionDigits: 1 });
}

function DeviationTable({
  deviations,
  onOpen,
}: {
  deviations: ForecastDeviationRowDTO[];
  onOpen: (d: ForecastDeviationRowDTO) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-stone-200 bg-stone-50">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
            <th className="px-4 py-2.5">Data</th>
            <th className="px-4 py-2.5 text-right">Previsto</th>
            <th className="px-4 py-2.5 text-right">Realizado</th>
            <th className="px-4 py-2.5 text-right">Desvio</th>
            <th className="px-4 py-2.5 text-right">% Desvio</th>
            <th className="px-4 py-2.5">Estado</th>
            <th className="px-4 py-2.5 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {deviations.length === 0 ? (
            <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-400">Sem desvios registados.</td></tr>
          ) : (
            deviations.map((d) => (
              <tr key={d.feedbackId} className="hover:bg-stone-50/60">
                <td className="px-4 py-2.5 text-stone-600">{formatIsoDatePt(d.periodDate)}</td>
                <td className="px-4 py-2.5 text-right text-stone-600">{fmtQty(d.forecastValue)}</td>
                <td className="px-4 py-2.5 text-right text-stone-600">{fmtQty(d.actualValue)}</td>
                <td className="px-4 py-2.5 text-right text-stone-600">{fmtQty(d.actualValue - d.forecastValue)}</td>
                <td className={`px-4 py-2.5 text-right font-medium ${d.deviationPercent != null && Math.abs(d.deviationPercent) > RELEVANT_DEVIATION_THRESHOLD ? "text-red-600" : "text-stone-600"}`}>
                  {d.deviationPercent != null ? `${(d.deviationPercent * 100).toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%` : "—"}
                </td>
                <td className="px-4 py-2.5 text-xs font-medium text-stone-600">{d.hasFeedback ? "Com feedback" : "Por rever"}</td>
                <td className="px-4 py-2.5 text-right">
                  <button type="button" onClick={() => onOpen(d)} className="rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
                    Ver
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ForecastHistoryView() {
  const { api } = useStockPlanningModule();
  const { locations } = useLocations();

  const [locationId, setLocationId] = useState<string | null>(locations[0]?.id ?? null);
  const [period, setPeriod] = useState(30);
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const [openDeviation, setOpenDeviation] = useState<ForecastDeviationRowDTO | null>(null);

  const effectiveLocationId = locationId ?? locations[0]?.id ?? null;

  const { data: history, isLoading, isError } = useQuery({
    queryKey: ["stock-planning-history", effectiveLocationId, period],
    queryFn: () => api.getForecastHistory(effectiveLocationId!, period),
    enabled: !!effectiveLocationId,
  });

  const latestRun = useMemo(() => history?.runs.find((r) => r.isLatest) ?? history?.runs[0] ?? null, [history]);

  const chartData = useMemo(
    () => (history?.recentDeviations ?? []).map((d) => ({ date: d.periodDate, Previsto: d.forecastValue, Realizado: d.actualValue })),
    [history],
  );

  const metrics = useMemo(() => {
    const deviations = history?.recentDeviations ?? [];
    const avgSales = deviations.length > 0 ? deviations.reduce((s, d) => s + d.actualValue, 0) / deviations.length : null;
    const relevantCount = deviations.filter((d) => d.deviationPercent != null && Math.abs(d.deviationPercent) > RELEVANT_DEVIATION_THRESHOLD).length;
    return { avgSales, relevantCount };
  }, [history]);

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <PlanningSubNav current="Histórico de previsões" />

      <div className="border-b border-stone-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-stone-900">Histórico de previsões</h1>
        <p className="mt-0.5 text-sm text-stone-500">Qualidade do forecast diário ao longo do tempo — desvios e feedback ajudam a calibrar o modelo.</p>
      </div>

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <LocationSelect value={locationId} onChange={setLocationId} className={inputCls} />
          <select value={period} onChange={(e) => setPeriod(Number(e.target.value))} className={inputCls}>
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-1 rounded-lg border border-stone-200 bg-white p-1 text-sm">
          {SUB_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSubTab(t.key)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${subTab === t.key ? "bg-[#ED5C32] text-white" : "text-stone-600 hover:bg-stone-100"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!effectiveLocationId ? (
          <p className="text-sm text-stone-400">Sem loja selecionada.</p>
        ) : isLoading ? (
          <p className="text-sm text-stone-400">A carregar…</p>
        ) : isError || !history ? (
          <p className="text-sm text-stone-400">Não foi possível carregar o histórico de previsões.</p>
        ) : subTab === "overview" ? (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-medium text-stone-500">Média de vendas diárias</p>
                <p className="mt-1 text-xl font-bold text-stone-800">{metrics.avgSales != null ? fmtQty(metrics.avgSales) : "—"}</p>
              </div>
              <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-medium text-stone-500">Qualidade da última previsão</p>
                <p className="mt-1 text-xl font-bold text-stone-800">{latestRun?.qualityScore != null ? latestRun.qualityScore.toLocaleString("pt-PT", { maximumFractionDigits: 2 }) : "—"}</p>
              </div>
              <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-medium text-stone-500">Dias com desvio relevante</p>
                <p className="mt-1 text-xl font-bold text-red-600">{metrics.relevantCount}</p>
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-stone-700">Vendas previstas vs. reais</h3>
              {chartData.length === 0 ? (
                <p className="text-xs text-stone-400">Sem pontos suficientes neste período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                    <XAxis dataKey="date" tickFormatter={(d: string) => formatIsoDatePt(d)} tick={{ fontSize: 10, fill: "#78716c" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#78716c" }} axisLine={false} tickLine={false} width={45} />
                    <Tooltip labelFormatter={(d: string) => formatIsoDatePt(d)} />
                    <Legend formatter={(v) => <span style={{ fontSize: 12, color: "#57534e" }}>{v}</span>} />
                    <Bar dataKey="Previsto" fill="#EF8935" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Realizado" fill="#ED5C32" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <h3 className="text-sm font-semibold text-stone-700">Desvios recentes</h3>
            <DeviationTable deviations={history.recentDeviations} onOpen={setOpenDeviation} />
          </>
        ) : subTab === "forecasted_sales" ? (
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-stone-700">Vendas previstas vs. reais</h3>
            <p className="mb-3 text-xs text-stone-400">
              Reaproveita os mesmos pontos agregados de "Desvios recentes" — o backend não expõe uma curva diária própria de vendas previstas ao nível do histórico (só ao nível de cada item, na drawer de detalhe). Ver README.
            </p>
            {chartData.length === 0 ? (
              <p className="text-xs text-stone-400">Sem pontos suficientes neste período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                  <XAxis dataKey="date" tickFormatter={(d: string) => formatIsoDatePt(d)} tick={{ fontSize: 10, fill: "#78716c" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#78716c" }} axisLine={false} tickLine={false} width={45} />
                  <Tooltip labelFormatter={(d: string) => formatIsoDatePt(d)} />
                  <Legend formatter={(v) => <span style={{ fontSize: 12, color: "#57534e" }}>{v}</span>} />
                  <Bar dataKey="Previsto" fill="#EF8935" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Realizado" fill="#ED5C32" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        ) : subTab === "ingredient_consumption" ? (
          <div className="rounded-xl border border-stone-200 bg-white p-6 text-center">
            <p className="text-sm text-stone-500">Consumo por ingrediente ainda não tem uma API própria de histórico agregado.</p>
            <p className="mt-1 text-xs text-stone-400">
              Para ver a projeção de consumo de um ingrediente específico, abre o item em "Planeamento &gt; Itens" e consulta o separador "Projeção e forecast".
            </p>
          </div>
        ) : (
          <DeviationTable deviations={history.recentDeviations} onOpen={setOpenDeviation} />
        )}
      </div>

      {openDeviation && (
        <ForecastFeedbackDrawer
          deviation={openDeviation}
          locationLabel={locations.find((l) => l.id === effectiveLocationId)?.name}
          onClose={() => setOpenDeviation(null)}
        />
      )}
    </div>
  );
}
