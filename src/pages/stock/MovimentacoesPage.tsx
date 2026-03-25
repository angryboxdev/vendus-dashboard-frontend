import { STOCK_BASE_UNIT_LABELS, STOCK_ITEM_TYPE_LABELS } from "./stock.types";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { IngredientConsumptionResponse } from "./painel.types";
import { MiniKpiCard } from "../../components/MiniKpiCard";
import { apiGet } from "../../lib/api";
import { formatNumber } from "../../lib/format";

function getYesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function buildConsumptionUrl(since: string, until: string): string {
  const params = new URLSearchParams({ since, until });
  return `/api/reports/ingredient-consumption?${params.toString()}`;
}

function formatUnit(baseUnit: string): string {
  return (
    (STOCK_BASE_UNIT_LABELS as Record<string, string>)[baseUnit] ?? baseUnit
  );
}

type MergedStockRow = {
  stock_item_id: string;
  name: string;
  base_unit: string;
  type: string;
  category_name: string;
  quantity_at_period_start: number;
  quantity_consumed: number; // vendas
  quantity_consumed_selfconsumption: number; // autoconsumo
  quantity_added: number;
  quantity_result: number; // opening + added - consumed - consumed_selfconsumption
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function MovimentacoesPage() {
  const [since, setSince] = useState(getYesterdayISO);
  const [until, setUntil] = useState(getYesterdayISO);
  const [data, setData] = useState<IngredientConsumptionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterType, setFilterType] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [unmatchedExpanded, setUnmatchedExpanded] = useState(false);

  const url = useMemo(() => buildConsumptionUrl(since, until), [since, until]);

  const consumption = useMemo(
    () => data?.consumption ?? [],
    [data?.consumption],
  );
  const additions = useMemo(() => data?.additions ?? [], [data?.additions]);
  const openingStock = useMemo(
    () => data?.opening_stock ?? [],
    [data?.opening_stock],
  );
  const consumptionSelf = useMemo(
    () => data?.consumption_selfconsumption ?? [],
    [data?.consumption_selfconsumption],
  );

  const mergedRows = useMemo((): MergedStockRow[] => {
    const map = new Map<
      string,
      {
        name: string;
        base_unit: string;
        type: string;
        category_name: string;
        quantity_at_period_start: number;
        quantity_consumed: number;
        quantity_consumed_selfconsumption: number;
        quantity_added: number;
      }
    >();

    const openingById = new Map(
      openingStock.map((o) => [
        o.stock_item_id,
        o.quantity_at_period_start ?? 0,
      ]),
    );

    const upsert = (
      id: string,
      name: string,
      base_unit: string,
      type: string,
      category_name: string,
      consumed: number,
      consumedSelf: number,
      added: number,
    ) => {
      const existing = map.get(id);
      const opening = openingById.get(id) ?? 0;
      map.set(id, {
        name: existing?.name ?? name,
        base_unit: existing?.base_unit ?? base_unit,
        type: existing?.type ?? type,
        category_name: existing?.category_name ?? category_name,
        quantity_at_period_start: existing?.quantity_at_period_start ?? opening,
        quantity_consumed: (existing?.quantity_consumed ?? 0) + consumed,
        quantity_consumed_selfconsumption:
          (existing?.quantity_consumed_selfconsumption ?? 0) + consumedSelf,
        quantity_added: (existing?.quantity_added ?? 0) + added,
      });
    };

    for (const c of consumption) {
      upsert(
        c.stock_item_id,
        c.name,
        c.base_unit,
        c.type ?? "other",
        c.category_name ?? "",
        c.quantity_consumed ?? 0,
        0,
        0,
      );
    }
    for (const cs of consumptionSelf) {
      const existing = map.get(cs.stock_item_id);
      const q = cs.quantity_consumed ?? 0;
      if (existing) {
        existing.quantity_consumed_selfconsumption += q;
      } else {
        upsert(
          cs.stock_item_id,
          cs.name,
          cs.base_unit,
          cs.type ?? "other",
          cs.category_name ?? "",
          0,
          q,
          0,
        );
      }
    }
    for (const a of additions) {
      const existing = map.get(a.stock_item_id);
      const added = a.quantity_added ?? 0;
      if (existing) {
        existing.quantity_added += added;
        existing.quantity_at_period_start =
          openingById.get(a.stock_item_id) ?? existing.quantity_at_period_start;
      } else {
        upsert(
          a.stock_item_id,
          a.name,
          a.base_unit,
          a.type,
          a.category_name ?? "",
          0,
          0,
          added,
        );
      }
    }

    return Array.from(map.entries()).map(([stock_item_id, v]) => ({
      stock_item_id,
      ...v,
      quantity_result:
        v.quantity_at_period_start +
        v.quantity_added -
        v.quantity_consumed -
        v.quantity_consumed_selfconsumption,
    }));
  }, [consumption, consumptionSelf, additions, openingStock]);

  const filteredRows = useMemo(() => {
    let list = mergedRows;
    if (filterType) {
      list = list.filter((e) => e.type === filterType);
    }
    if (filterCategory) {
      list = list.filter((e) => e.category_name === filterCategory);
    }
    return list;
  }, [mergedRows, filterType, filterCategory]);

  const categoryOptions = useMemo(
    () =>
      [
        ...new Set(mergedRows.map((e) => e.category_name).filter(Boolean)),
      ].sort(),
    [mergedRows],
  );

  const matchedProducts = useMemo(
    () => data?.matched_products ?? [],
    [data?.matched_products],
  );

  const categoryTotals = useMemo(() => {
    let pizzas = 0;
    let bebidasAlcoolicas = 0;
    let bebidasNaoAlcoolicas = 0;
    let sacosEmbalagens = 0;
    let outros = 0;

    for (const p of matchedProducts) {
      const qty = p.qty_sold ?? 0;
      switch (p.category) {
        case "pizza":
          pizzas += qty;
          break;
        case "bebida_alcoolica":
          bebidasAlcoolicas += qty;
          break;
        case "bebida_nao_alcoolica":
          bebidasNaoAlcoolicas += qty;
          break;
        case "sacos":
          sacosEmbalagens += qty;
          break;
        case "outros":
        default:
          outros += qty;
          break;
      }
    }

    return {
      pizzas,
      bebidasAlcoolicas,
      bebidasNaoAlcoolicas,
      sacosEmbalagens,
      outros,
    };
  }, [matchedProducts]);

  const totalFiltered = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = useMemo(
    () => filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredRows, safePage, pageSize],
  );

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const json = await apiGet<IngredientConsumptionResponse>(url);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar consumo");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load só no mount; depois usa botão Atualizar
  }, []);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-800">
          Balanço de stock
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs text-slate-500">De</label>
            <input
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="rounded border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Até</label>
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="rounded border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Tipo</label>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">— Todos —</option>
              {(
                Object.entries(STOCK_ITEM_TYPE_LABELS) as [
                  keyof typeof STOCK_ITEM_TYPE_LABELS,
                  string,
                ][]
              ).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              Categoria
            </label>
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="rounded border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">— Todas —</option>
              {categoryOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "A carregar…" : "Atualizar"}
          </button>
        </div>
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
        ) : data && mergedRows.length > 0 ? (
          <>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-slate-600">
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium text-right">Inicial</th>
                  <th className="px-4 py-3 font-medium text-right">
                    Consumido (vendas)
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Consumido (autoconsumo)
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Adicionado
                  </th>
                  <th className="px-4 py-3 font-medium text-right">
                    Resultado
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((row: MergedStockRow) => {
                  const unit = formatUnit(row.base_unit);
                  return (
                    <tr
                      key={row.stock_item_id}
                      className="border-t border-slate-100 hover:bg-slate-50/50"
                    >
                      <td className="px-4 py-2 font-medium text-slate-800">
                        {row.name}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {(STOCK_ITEM_TYPE_LABELS as Record<string, string>)[
                          row.type
                        ] ??
                          row.type ??
                          "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {row.category_name || "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                        {row.quantity_at_period_start > 0
                          ? `${formatNumber(row.quantity_at_period_start)} ${unit}`
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                        {row.quantity_consumed > 0
                          ? `${formatNumber(row.quantity_consumed)} ${unit}`
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                        {row.quantity_consumed_selfconsumption > 0
                          ? `${formatNumber(row.quantity_consumed_selfconsumption)} ${unit}`
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                        {row.quantity_added > 0
                          ? `${formatNumber(row.quantity_added)} ${unit}`
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium text-slate-800">
                        {formatNumber(row.quantity_result)} {unit}
                      </td>
                    </tr>
                  );
                })}
                {paginatedItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      Nenhum resultado com os filtros aplicados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {totalFiltered > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600">Mostrar</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
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
                    {totalFiltered === 0
                      ? "registos"
                      : `${(safePage - 1) * pageSize + 1}–${Math.min(
                          safePage * pageSize,
                          totalFiltered,
                        )} de ${totalFiltered}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="rounded border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-50"
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-slate-600">
                    Página {safePage} de {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={safePage >= totalPages}
                    className="rounded border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-50"
                  >
                    Seguinte
                  </button>
                </div>
              </div>
            )}
          </>
        ) : data && mergedRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhum consumo de ingredientes no período selecionado.
          </div>
        ) : null}
      </div>

      {data?.debug?.unmatched_products &&
        data.debug.unmatched_products.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50">
            <button
              type="button"
              onClick={() => setUnmatchedExpanded((x) => !x)}
              className="flex w-full items-center justify-between px-4 py-2 text-left text-sm font-medium text-amber-800 hover:bg-amber-100/50"
            >
              Itens sem mapeamento ({data.debug!.unmatched_products!.length})
              <span className="text-amber-600">
                {unmatchedExpanded ? "▼" : "▶"}
              </span>
            </button>
            {unmatchedExpanded && (
              <div className="border-t border-amber-200 px-4 py-3">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-amber-700">
                      <th className="pb-1 font-medium">Produto</th>
                      <th className="pb-1 font-medium">Ref.</th>
                      <th className="pb-1 font-medium">Categoria</th>
                      <th className="pb-1 font-medium text-right">Qtd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.debug!.unmatched_products!.map((u, i) => (
                      <tr
                        key={`${u.reference}-${i}`}
                        className="border-t border-amber-100 text-slate-600"
                      >
                        <td className="py-1">{u.title}</td>
                        <td className="py-1 font-mono">{u.reference}</td>
                        <td className="py-1">{u.category}</td>
                        <td className="py-1 text-right tabular-nums">
                          {formatNumber(u.qty)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      {/* Divider Notion-style */}
      <div className="flex items-center gap-3 py-6">
        <div className="flex-1 border-t border-slate-200" />
        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
        <div className="flex-1 border-t border-slate-200" />
      </div>

      {/* KPI cards por categoria */}
      <div>
        <p className="mb-3 text-sm text-slate-600">
          Itens consumidos no período selecionado
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MiniKpiCard
            secondary
            title="Pizzas"
            value={formatNumber(categoryTotals.pizzas)}
          />
          <MiniKpiCard
            secondary
            title="Bebidas alcoólicas"
            value={formatNumber(categoryTotals.bebidasAlcoolicas)}
          />
          <MiniKpiCard
            secondary
            title="Bebidas não alcoólicas"
            value={formatNumber(categoryTotals.bebidasNaoAlcoolicas)}
          />
          <MiniKpiCard
            secondary
            title="Sacos / Embalagens"
            value={formatNumber(categoryTotals.sacosEmbalagens)}
          />
          <MiniKpiCard
            secondary
            title="Outros"
            value={formatNumber(categoryTotals.outros)}
          />
        </div>
      </div>
    </div>
  );
}
