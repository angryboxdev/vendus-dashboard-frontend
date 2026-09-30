import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { StockPlanningProvider, useStockPlanningModule } from "../../../stock-planning/stock-planning.module.tsx";
import { RiskBadge } from "../../../stock-planning/adapters/in/RiskBadge.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { LocationSelect } from "../../../../components/LocationSelect.tsx";

const inputCls =
  "rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-[#ED5C32]";

function AssociatedItemsInner({ supplierId }: { supplierId: string }) {
  const { api } = useStockPlanningModule();
  const { locations } = useLocations();
  const navigate = useNavigate();
  const [locationId, setLocationId] = useState<string | null>(locations[0]?.id ?? null);
  const effectiveLocationId = locationId ?? locations[0]?.id ?? null;

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ["stock-planning-items-by-supplier", supplierId, effectiveLocationId],
    queryFn: () => api.listItems({ locationId: effectiveLocationId!, supplierId }),
    enabled: !!effectiveLocationId,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700">Itens de stock associados a este fornecedor</h3>
        <LocationSelect value={locationId} onChange={setLocationId} className={inputCls} />
      </div>
      <p className="text-xs text-stone-400">
        Itens de stock cujo fornecedor de referência (no Planeamento de stock) é este fornecedor — clica para abrir o planeamento completo do item.
      </p>
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
              <th className="px-4 py-2.5">Item</th>
              <th className="px-4 py-2.5 text-right">Stock atual</th>
              <th className="px-4 py-2.5 text-right">Cobertura</th>
              <th className="px-4 py-2.5">Risco</th>
              <th className="px-4 py-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {!effectiveLocationId ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-400">Sem loja selecionada.</td></tr>
            ) : isLoading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-400">A carregar…</td></tr>
            ) : isError ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-400">Não foi possível carregar os itens associados.</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-400">Nenhum item de stock tem este fornecedor como referência.</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.stockItemId} className="hover:bg-stone-50/60">
                  <td className="px-4 py-2.5 font-medium text-stone-800">{item.name}</td>
                  <td className="px-4 py-2.5 text-right text-stone-600">{item.currentQuantity.toLocaleString("pt-PT", { maximumFractionDigits: 2 })} {item.baseUnit}</td>
                  <td className="px-4 py-2.5 text-right text-stone-600">{item.coverageDays != null ? `${item.coverageDays.toLocaleString("pt-PT", { maximumFractionDigits: 1 })} dias` : "—"}</td>
                  <td className="px-4 py-2.5"><RiskBadge risk={item.riskLevel} /></td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => navigate("/stock/planeamento")}
                      className="rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                    >
                      Ver no planeamento
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Tab "Itens associados" — cruza com o módulo `stock-planning` (D10):
 * mostra os itens de stock cujo fornecedor sugerido é este fornecedor.
 * Instancia o seu próprio `StockPlanningProvider` porque a árvore de rotas
 * `/financial/*` não monta esse módulo — mantém o acoplamento explícito e
 * local a este ficheiro, sem alterar `App.tsx`.
 */
export function SupplierAssociatedItemsTab({ supplierId }: { supplierId: string }) {
  return (
    <StockPlanningProvider>
      <AssociatedItemsInner supplierId={supplierId} />
    </StockPlanningProvider>
  );
}
