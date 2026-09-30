import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useStockPlanningModule } from "../../stock-planning.module.tsx";
import { useFinancialBaseModule } from "../../../financial-base/financial-base.module.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { LocationSelect } from "../../../../components/LocationSelect.tsx";
import { PlanningSubNav } from "./PlanningSubNav.tsx";
import { RiskBadge } from "./RiskBadge.tsx";
import { PlanningItemDetailDrawer } from "./PlanningItemDetailDrawer.tsx";
import type { PlanningItemRowDTO, RiskLevel } from "../../domain/entities/stock-planning.ts";

const inputCls =
  "rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-[#ED5C32]";

const RISK_FILTER_OPTIONS: { value: RiskLevel | "all"; label: string }[] = [
  { value: "all", label: "Todos os níveis" },
  { value: "critico", label: "Crítico" },
  { value: "atencao", label: "Atenção" },
  { value: "excesso", label: "Excesso" },
  { value: "ok", label: "OK" },
];

const PAGE_SIZE = 20;

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent ?? "text-stone-800"}`}>{value}</p>
    </div>
  );
}

export function PlanningMainView() {
  const { api } = useStockPlanningModule();
  const { api: fbApi } = useFinancialBaseModule();
  const { locations } = useLocations();
  const navigate = useNavigate();

  const [locationId, setLocationId] = useState<string | null>(locations[0]?.id ?? null);
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  const effectiveLocationId = locationId ?? locations[0]?.id ?? null;

  const { data: categories = [] } = useQuery({
    queryKey: ["stock-planning-categories"],
    queryFn: () => api.listStockCategoryOptions(),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["financial-base-suppliers"],
    queryFn: () => fbApi.listSuppliers(),
  });

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ["stock-planning-items", effectiveLocationId, categoryId, supplierId, riskLevel, search],
    queryFn: () =>
      api.listItems({
        locationId: effectiveLocationId!,
        categoryId: categoryId || undefined,
        supplierId: supplierId || undefined,
        riskLevel: riskLevel === "all" ? undefined : riskLevel,
        search: search.trim() || undefined,
      }),
    enabled: !!effectiveLocationId,
  });

  const { data: purchaseList } = useQuery({
    queryKey: ["stock-planning-purchase-list-summary", effectiveLocationId],
    queryFn: () => api.getPurchaseList(effectiveLocationId!),
    enabled: !!effectiveLocationId,
  });

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const supplierMap = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);

  const summary = useMemo(() => {
    const critical = items.filter((i) => i.riskLevel === "critico").length;
    const withSuggestion = items.filter((i) => i.suggestedPurchaseQty != null && i.suggestedPurchaseQty > 0).length;
    const excess = items.filter((i) => i.riskLevel === "excesso").length;
    return { critical, withSuggestion, excess };
  }, [items]);

  const estimatedCost = useMemo(() => {
    if (!purchaseList) return null;
    const total = purchaseList.groups.reduce((sum, g) => (g.totalEstimatedCost != null ? sum + g.totalEstimatedCost : sum), 0);
    return total;
  }, [purchaseList]);

  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pagedItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function resetPage() {
    setPage(0);
  }

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <PlanningSubNav current="Itens" />

      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Planeamento de stock</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            Previsão de procura, projeção de cobertura e sugestões de compra por item — nunca cria encomendas sozinho.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/stock/planeamento/lista-compras")}
          className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Gerar lista de compras
        </button>
      </div>

      <div className="space-y-4 p-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <SummaryCard label="Riscos críticos" value={String(summary.critical)} accent="text-red-600" />
          <SummaryCard label="Itens com sugestão" value={String(summary.withSuggestion)} accent="text-[#ED5C32]" />
          <SummaryCard label="Possíveis excessos" value={String(summary.excess)} accent="text-sky-600" />
          <SummaryCard
            label="Custo estimado (lista de compras)"
            value={estimatedCost != null ? estimatedCost.toLocaleString("pt-PT", { style: "currency", currency: "EUR" }) : "—"}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <LocationSelect value={locationId} onChange={(v) => { setLocationId(v); resetPage(); }} label={undefined} className={inputCls} />
          <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); resetPage(); }} className={inputCls}>
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); resetPage(); }} className={inputCls}>
            <option value="">Todos os fornecedores</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select value={riskLevel} onChange={(e) => { setRiskLevel(e.target.value as RiskLevel | "all"); resetPage(); }} className={inputCls}>
            {RISK_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            placeholder="Pesquisar item..."
            className={`w-56 ${inputCls}`}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 py-2.5">Item</th>
                <th className="px-4 py-2.5">Categoria</th>
                <th className="px-4 py-2.5 text-right">Stock atual</th>
                <th className="px-4 py-2.5 text-right">Cobertura</th>
                <th className="px-4 py-2.5">Fornecedor</th>
                <th className="px-4 py-2.5">Risco</th>
                <th className="px-4 py-2.5">Sugestão</th>
                <th className="px-4 py-2.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {!effectiveLocationId ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400">Sem loja selecionada.</td></tr>
              ) : isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400">A carregar…</td></tr>
              ) : isError ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400">Não foi possível carregar o planeamento.</td></tr>
              ) : pagedItems.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400">Sem itens para este filtro.</td></tr>
              ) : (
                pagedItems.map((item: PlanningItemRowDTO) => (
                  <tr key={item.stockItemId} className="cursor-pointer hover:bg-stone-50/60" onClick={() => setOpenItemId(item.stockItemId)}>
                    <td className="px-4 py-2.5 font-medium text-stone-800">{item.name}</td>
                    <td className="px-4 py-2.5 text-stone-600">{categoryMap.get(item.categoryId) ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right text-stone-600">{item.currentQuantity.toLocaleString("pt-PT", { maximumFractionDigits: 2 })} {item.baseUnit}</td>
                    <td className="px-4 py-2.5 text-right text-stone-600">{item.coverageDays != null ? `${item.coverageDays.toLocaleString("pt-PT", { maximumFractionDigits: 1 })} dias` : "—"}</td>
                    <td className="px-4 py-2.5 text-stone-600">{item.supplierId ? (supplierMap.get(item.supplierId) ?? "—") : "—"}</td>
                    <td className="px-4 py-2.5"><RiskBadge risk={item.riskLevel} /></td>
                    <td className="px-4 py-2.5 text-stone-600">
                      {item.suggestedPurchaseQty != null && item.suggestedPurchaseQty > 0
                        ? `${item.suggestedPurchaseQty.toLocaleString("pt-PT", { maximumFractionDigits: 2 })} ${item.purchaseUnit ?? ""}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setOpenItemId(item.stockItemId); }}
                        className="rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {items.length > PAGE_SIZE && (
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>{items.length} item(ns) · página {page + 1} de {pageCount}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded-md border border-stone-300 px-2.5 py-1 font-medium text-stone-600 disabled:opacity-40">Anterior</button>
              <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} className="rounded-md border border-stone-300 px-2.5 py-1 font-medium text-stone-600 disabled:opacity-40">Seguinte</button>
            </div>
          </div>
        )}
      </div>

      {openItemId && effectiveLocationId && (
        <PlanningItemDetailDrawer stockItemId={openItemId} locationId={effectiveLocationId} onClose={() => setOpenItemId(null)} />
      )}
    </div>
  );
}
