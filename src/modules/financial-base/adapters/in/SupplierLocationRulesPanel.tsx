import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFinancialBaseModule } from "../../financial-base.module.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import type { DefaultStockPolicy } from "../../domain/entities/supplier.ts";
import { DEFAULT_STOCK_POLICY_LABELS } from "../../domain/entities/supplier.ts";
import type { CostCenterCategory } from "../../domain/entities/cost-center.ts";

const fieldCls = "w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm text-stone-800 outline-none focus:border-[#ED5C32]";

/**
 * Exceções por loja da ficha do fornecedor (F2 v1.2 §2.1): prevalecem sobre a
 * regra geral para essa loja (ex.: Makro envia para Stock por defeito, mas na
 * loja MBS não). Só aparece com mais de uma loja ativa.
 */
export function SupplierLocationRulesPanel({ supplierId, categories }: { supplierId: string; categories: CostCenterCategory[] }) {
  const { api } = useFinancialBaseModule();
  const { activeLocations, locations, hasMultipleLocations } = useLocations();
  const qc = useQueryClient();
  const key = ["supplier-location-rules", supplierId];
  const { data: rules = [] } = useQuery({ queryKey: key, queryFn: () => api.listSupplierLocationRules(supplierId), enabled: hasMultipleLocations });
  const [locationId, setLocationId] = useState("");
  const [stockPolicy, setStockPolicy] = useState<DefaultStockPolicy | "">("");
  const [categoryId, setCategoryId] = useState("");

  const save = useMutation({
    mutationFn: () => {
      const cat = categories.find((c) => c.id === categoryId);
      return api.upsertSupplierLocationRule(supplierId, locationId, {
        stockPolicy: stockPolicy || null,
        costCenterGroupId: cat?.groupId ?? null,
        costCenterCategoryId: categoryId || null,
      });
    },
    onSuccess: () => {
      setLocationId("");
      setStockPolicy("");
      setCategoryId("");
      void qc.invalidateQueries({ queryKey: key });
    },
  });
  const remove = useMutation({
    mutationFn: (loc: string) => api.deleteSupplierLocationRule(supplierId, loc),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });

  if (!hasMultipleLocations) return null;
  const nameOf = (id: string) => locations.find((l) => l.id === id)?.name ?? id;
  const catOf = (id: string | null) => categories.find((c) => c.id === id);

  return (
    <div className="space-y-2 rounded-lg border border-stone-200 p-3">
      <p className="text-sm font-medium text-stone-700">Exceções por loja</p>
      <p className="text-xs text-stone-400">Prevalecem sobre a regra geral do fornecedor nessa loja.</p>
      {rules.length > 0 && (
        <ul className="divide-y divide-stone-100 text-sm">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="text-stone-700">
                <span className="font-medium">{nameOf(r.locationId)}</span>
                {r.stockPolicy && <> · Stock: {DEFAULT_STOCK_POLICY_LABELS[r.stockPolicy]}</>}
                {r.costCenterCategoryId && <> · CC: {catOf(r.costCenterCategoryId)?.code ?? "?"} — {catOf(r.costCenterCategoryId)?.name ?? ""}</>}
              </span>
              <button type="button" onClick={() => remove.mutate(r.locationId)} className="text-xs text-red-500 hover:text-red-700" disabled={remove.isPending}>
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-3 gap-2">
        <select aria-label="Loja" value={locationId} onChange={(e) => setLocationId(e.target.value)} className={fieldCls}>
          <option value="">Loja…</option>
          {activeLocations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <select aria-label="Enviar para Stock nesta loja" value={stockPolicy} onChange={(e) => setStockPolicy(e.target.value as DefaultStockPolicy | "")} className={fieldCls}>
          <option value="">Stock: igual à geral</option>
          {(Object.entries(DEFAULT_STOCK_POLICY_LABELS) as [DefaultStockPolicy, string][]).map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
        <select aria-label="Subcategoria nesta loja" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldCls}>
          <option value="">Categoria: igual à geral</option>
          {categories.filter((c) => c.isActive).map((c) => (
            <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
          ))}
        </select>
      </div>
      {save.error instanceof Error && <p className="text-xs text-red-600">{save.error.message}</p>}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!locationId || (!stockPolicy && !categoryId) || save.isPending}
          onClick={() => save.mutate()}
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          {save.isPending ? "A guardar…" : "Guardar exceção"}
        </button>
      </div>
    </div>
  );
}
