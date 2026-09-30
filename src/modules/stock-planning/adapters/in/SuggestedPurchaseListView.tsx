import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStockPlanningModule } from "../../stock-planning.module.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { LocationSelect } from "../../../../components/LocationSelect.tsx";
import { PlanningSubNav } from "./PlanningSubNav.tsx";
import { formatIsoDatePt } from "../../../../lib/format.ts";
import type { SuggestedPurchaseListLineDTO } from "../../domain/entities/stock-planning.ts";

const inputCls =
  "rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-[#ED5C32]";

function fmtEUR(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function fmtQty(n: number): string {
  return n.toLocaleString("pt-PT", { maximumFractionDigits: 2 });
}

function LineRow({
  line,
  highlighted,
  onReview,
  reviewing,
}: {
  line: SuggestedPurchaseListLineDTO;
  highlighted: boolean;
  onReview: (reviewedQty: number) => void;
  reviewing: boolean;
}) {
  const systemQty = line.suggestedPurchaseQty ?? line.suggestedBaseQty;
  const [reviewed, setReviewed] = useState(systemQty);
  const [dirty, setDirty] = useState(false);
  const unit = line.purchaseUnit ?? "un";
  const unitCost = line.estimatedCost != null && systemQty > 0 ? line.estimatedCost / systemQty : null;
  const estimatedTotal = unitCost != null ? unitCost * reviewed : line.estimatedCost;

  function step(delta: number) {
    const next = Math.max(0, Math.round((reviewed + delta) * 100) / 100);
    setReviewed(next);
    setDirty(true);
  }

  return (
    <tr className={`border-b border-stone-100 last:border-b-0 ${highlighted ? "bg-[#FDF3EC]" : ""}`}>
      <td className="px-4 py-2.5 font-medium text-stone-800">{line.itemName}</td>
      <td className="px-4 py-2.5 text-stone-500">
        {fmtQty(systemQty)} {unit}
        <p className="text-[10px] text-stone-400">arredondado à unidade de compra</p>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => step(-1)} className="h-6 w-6 rounded border border-stone-300 text-xs font-bold text-stone-600 hover:bg-stone-50">−</button>
          <span className="w-16 text-center text-sm font-medium text-stone-800">{fmtQty(reviewed)}</span>
          <button type="button" onClick={() => step(1)} className="h-6 w-6 rounded border border-stone-300 text-xs font-bold text-stone-600 hover:bg-stone-50">+</button>
          <span className="text-xs text-stone-400">{unit}</span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-right text-stone-600">{fmtEUR(unitCost)}</td>
      <td className="px-4 py-2.5 text-right font-medium text-stone-800">{fmtEUR(estimatedTotal)}</td>
      <td className="px-4 py-2.5 text-right">
        <button
          type="button"
          disabled={!dirty || reviewing}
          onClick={() => { onReview(reviewed); setDirty(false); }}
          className="rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40"
        >
          {reviewing ? "A guardar…" : "Guardar"}
        </button>
      </td>
    </tr>
  );
}

export function SuggestedPurchaseListView() {
  const { api } = useStockPlanningModule();
  const { locations } = useLocations();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [locationId, setLocationId] = useState<string | null>(locations[0]?.id ?? null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const effectiveLocationId = locationId ?? locations[0]?.id ?? null;

  const { data: list, isLoading, isError } = useQuery({
    queryKey: ["stock-planning-purchase-list", effectiveLocationId],
    queryFn: () => api.getPurchaseList(effectiveLocationId!),
    enabled: !!effectiveLocationId,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, reviewedQty }: { id: string; reviewedQty: number }) => api.reviewRecommendation(id, { reviewedQty }),
    onMutate: ({ id }) => setReviewingId(id),
    onSettled: () => {
      setReviewingId(null);
      void qc.invalidateQueries({ queryKey: ["stock-planning-purchase-list"] });
    },
  });

  useEffect(() => {
    if (!copyNotice) return;
    const t = setTimeout(() => setCopyNotice(null), 2500);
    return () => clearTimeout(t);
  }, [copyNotice]);

  const totals = useMemo(() => {
    if (!list) return { itemCount: 0, supplierCount: 0, totalSuggested: 0 };
    const itemCount = list.groups.reduce((sum, g) => sum + g.lines.length, 0);
    const totalSuggested = list.groups.reduce((sum, g) => (g.totalEstimatedCost != null ? sum + g.totalEstimatedCost : sum), 0);
    return { itemCount, supplierCount: list.groups.length, totalSuggested };
  }, [list]);

  function exportCsv() {
    if (!list) return;
    const rows = [["Fornecedor", "Item", "Quantidade sugerida", "Unidade", "Custo estimado"]];
    for (const g of list.groups) {
      for (const l of g.lines) {
        rows.push([g.supplierName, l.itemName, String(l.suggestedPurchaseQty ?? l.suggestedBaseQty), l.purchaseUnit ?? "", l.estimatedCost != null ? l.estimatedCost.toFixed(2) : ""]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lista-compras-sugerida-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copySummary() {
    if (!list) return;
    const lines = list.groups.map((g) => `${g.supplierName}: ${fmtEUR(g.totalEstimatedCost)} (${g.lines.length} item(ns))`);
    const text = `Lista de compras sugerida — ${formatIsoDatePt(list.generatedAt)}\n${lines.join("\n")}\nTotal: ${fmtEUR(totals.totalSuggested)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyNotice("Resumo copiado para a área de transferência.");
    } catch {
      setCopyNotice("Não foi possível copiar automaticamente.");
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <PlanningSubNav current="Lista de compras sugerida" />

      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Lista de compras sugerida</h1>
          <p className="mt-0.5 text-sm text-stone-500">Agrupada por fornecedor, a partir da última previsão diária.</p>
        </div>
        <LocationSelect value={locationId} onChange={setLocationId} className={inputCls} />
      </div>

      <div className="space-y-4 p-6">
        {list && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
            <span className="text-stone-500">Última previsão: <span className="font-medium text-stone-700">{formatIsoDatePt(list.generatedAt)}</span></span>
            <div className="flex gap-2">
              <button type="button" onClick={exportCsv} className="rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">Exportar CSV</button>
              <button type="button" onClick={copySummary} className="rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">Copiar resumo</button>
              <button
                type="button"
                onClick={() => setCopyNotice("Revisão guardada — cada alteração já é gravada de imediato ao clicar em \"Guardar\" na linha.")}
                className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              >
                Guardar revisão
              </button>
            </div>
          </div>
        )}

        {copyNotice && <p className="text-xs font-medium text-emerald-700">{copyNotice}</p>}

        {!effectiveLocationId ? (
          <p className="text-sm text-stone-400">Sem loja selecionada.</p>
        ) : isLoading ? (
          <p className="text-sm text-stone-400">A carregar…</p>
        ) : isError || !list ? (
          <p className="text-sm text-stone-400">Não foi possível carregar a lista de compras sugerida.</p>
        ) : list.groups.length === 0 ? (
          <p className="text-sm text-stone-400">Sem sugestões de compra para esta loja neste momento.</p>
        ) : (
          list.groups.map((group) => (
            <div key={group.supplierId ?? group.supplierName} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50/60 px-4 py-3">
                <h3 className="text-sm font-semibold text-stone-700">{group.supplierName}</h3>
                <span className="text-sm font-bold text-stone-800">{fmtEUR(group.totalEstimatedCost)}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-stone-100">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-stone-400">
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2">Sistema sugere</th>
                    <th className="px-4 py-2">Revisto</th>
                    <th className="px-4 py-2 text-right">Preço unit. estimado</th>
                    <th className="px-4 py-2 text-right">Est. total</th>
                    <th className="px-4 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {group.lines.map((line) => (
                    <LineRow
                      key={line.recommendationId}
                      line={line}
                      highlighted={line.recommendationId === highlightId}
                      reviewing={reviewingId === line.recommendationId}
                      onReview={(reviewedQty) => reviewMutation.mutate({ id: line.recommendationId, reviewedQty })}
                    />
                  ))}
                </tbody>
              </table>
              <div className="border-t border-stone-100 px-4 py-2">
                <button type="button" disabled className="text-xs font-medium text-stone-300" title="Ainda não suportado pelo backend nesta versão">
                  + Adicionar item a esta lista
                </button>
              </div>
            </div>
          ))
        )}

        {list && list.groups.length > 0 && (
          <div className="grid grid-cols-3 gap-4 rounded-xl border border-stone-200 bg-white p-4 text-sm">
            <div><p className="text-xs text-stone-400">Itens selecionados</p><p className="font-bold text-stone-800">{totals.itemCount}</p></div>
            <div><p className="text-xs text-stone-400">Fornecedores</p><p className="font-bold text-stone-800">{totals.supplierCount}</p></div>
            <div><p className="text-xs text-stone-400">Valor total sugerido</p><p className="font-bold text-stone-800">{fmtEUR(totals.totalSuggested)}</p></div>
          </div>
        )}
      </div>
    </div>
  );
}
