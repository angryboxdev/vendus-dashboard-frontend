import { useCallback, useEffect, useMemo, useState } from "react";

import { apiGet } from "../../lib/api";
import { formatEUR, formatNumber } from "../../lib/format";
import type {
  StockCategory,
  StockItem,
  StockMovementType,
  StockMovementsPaginatedResponse,
} from "./stock.types";
import {
  STOCK_BASE_UNIT_LABELS,
  STOCK_MOVEMENT_TYPE_LABELS,
} from "./stock.types";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

function buildMovementsUrl(params: {
  page: number;
  pageSize: number;
  itemId: string;
  categoryId: string;
  type: string;
  dateFrom: string;
  dateTo: string;
}): string {
  const q = new URLSearchParams();
  q.set("page", String(params.page));
  q.set("page_size", String(params.pageSize));
  if (params.itemId) q.set("item_id", params.itemId);
  if (params.categoryId) q.set("category_id", params.categoryId);
  if (params.type) q.set("type", params.type);
  if (params.dateFrom) q.set("date_from", params.dateFrom);
  if (params.dateTo) q.set("date_to", params.dateTo);
  return `/api/stock/movements?${q.toString()}`;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-PT", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

export function StockMovementHistoryPage() {
  const [categories, setCategories] = useState<StockCategory[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [draftItemId, setDraftItemId] = useState("");
  const [draftCategoryId, setDraftCategoryId] = useState("");
  const [draftType, setDraftType] = useState<string>("");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");

  const [appliedItemId, setAppliedItemId] = useState("");
  const [appliedCategoryId, setAppliedCategoryId] = useState("");
  const [appliedType, setAppliedType] = useState<string>("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");

  const [response, setResponse] = useState<StockMovementsPaginatedResponse | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryParams = useMemo(
    () => ({
      page,
      pageSize,
      itemId: appliedItemId,
      categoryId: appliedCategoryId,
      type: appliedType,
      dateFrom: appliedDateFrom,
      dateTo: appliedDateTo,
    }),
    [
      page,
      pageSize,
      appliedItemId,
      appliedCategoryId,
      appliedType,
      appliedDateFrom,
      appliedDateTo,
    ]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = buildMovementsUrl(queryParams);
      const json = await apiGet<StockMovementsPaginatedResponse>(url);
      setResponse(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar movimentos");
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const [cats, its] = await Promise.all([
          apiGet<StockCategory[]>("/api/stock/categories"),
          apiGet<StockItem[]>("/api/stock/items"),
        ]);
        setCategories(Array.isArray(cats) ? cats : []);
        setItems(Array.isArray(its) ? its : []);
      } catch {
        setCategories([]);
        setItems([]);
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, []);

  const applyFilters = useCallback(() => {
    setAppliedItemId(draftItemId);
    setAppliedCategoryId(draftCategoryId);
    setAppliedType(draftType);
    setAppliedDateFrom(draftDateFrom);
    setAppliedDateTo(draftDateTo);
    setPage(1);
  }, [
    draftItemId,
    draftCategoryId,
    draftType,
    draftDateFrom,
    draftDateTo,
  ]);

  const pagination = response?.pagination;
  const rows = response?.data ?? [];

  if (loadingMeta) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-slate-500">A carregar…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h2 className="text-lg font-semibold text-slate-800">
        Histórico de movimentos
      </h2>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">De</label>
          <input
            type="date"
            value={draftDateFrom}
            onChange={(e) => setDraftDateFrom(e.target.value)}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Até</label>
          <input
            type="date"
            value={draftDateTo}
            onChange={(e) => setDraftDateTo(e.target.value)}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Item</label>
          <select
            value={draftItemId}
            onChange={(e) => setDraftItemId(e.target.value)}
            className="min-w-[180px] rounded border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
                {i.sku ? ` (${i.sku})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Categoria</label>
          <select
            value={draftCategoryId}
            onChange={(e) => setDraftCategoryId(e.target.value)}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Tipo</label>
          <select
            value={draftType}
            onChange={(e) => setDraftType(e.target.value)}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {(
              Object.entries(STOCK_MOVEMENT_TYPE_LABELS) as [
                StockMovementType,
                string,
              ][]
            ).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={applyFilters}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Aplicar filtros
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            A carregar…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-slate-600">
                  <th className="px-3 py-3 font-medium">Data mov.</th>
                  <th className="px-3 py-3 font-medium">Item</th>
                  <th className="px-3 py-3 font-medium">Categoria</th>
                  <th className="px-3 py-3 font-medium">Tipo</th>
                  <th className="px-3 py-3 font-medium text-right">Qtd. (+/−)</th>
                  <th className="px-3 py-3 font-medium text-right">Custo c/ IVA</th>
                  <th className="px-3 py-3 font-medium text-right">Custo s/ IVA</th>
                  <th className="px-3 py-3 font-medium">Notas</th>
                  <th className="px-3 py-3 font-medium text-right">Criado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const bu = row.item_base_unit as keyof typeof STOCK_BASE_UNIT_LABELS;
                  const unit =
                    STOCK_BASE_UNIT_LABELS[bu] ?? row.item_base_unit;
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-slate-100 hover:bg-slate-50/50"
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                        {formatDateTime(row.movement_date)}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {row.item_name}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {row.category_name || "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {STOCK_MOVEMENT_TYPE_LABELS[row.type] ?? row.type}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-800">
                        {formatNumber(row.quantity)} {unit}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                        {row.unit_cost_per_base_unit_with_vat != null && row.unit_cost_per_base_unit_with_vat > 0
                          ? formatEUR(row.unit_cost_per_base_unit_with_vat)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                        {row.unit_cost_per_base_unit_without_vat != null && row.unit_cost_per_base_unit_without_vat > 0
                          ? formatEUR(row.unit_cost_per_base_unit_without_vat)
                          : "—"}
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-2 text-slate-600" title={row.reference ?? row.reason ?? ""}>
                        {row.reference || row.reason || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-slate-500">
                        {formatDateTime(row.created_at)}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      Nenhum movimento encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">Linhas por página</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded border border-slate-200 px-2 py-1.5 text-sm"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="text-sm text-slate-600">
                {pagination.total} movimento(s) · página {pagination.page} de{" "}
                {pagination.total_pages}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="rounded border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-50"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() =>
                  setPage((p) =>
                    Math.min(pagination.total_pages, p + 1)
                  )
                }
                disabled={page >= pagination.total_pages || loading}
                className="rounded border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-50"
              >
                Seguinte
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
