import { useCallback, useEffect, useMemo, useState } from "react";

import { apiGet, apiPost, apiPut } from "../../lib/api";
import { formatEUR, formatNumber } from "../../lib/format";
import type {
  StockBaseUnit,
  StockCategory,
  StockItem,
  StockItemCreateBody,
  StockItemType,
  StockItemUpdateBody,
  StockMovementCreateBody,
  StockMovementType,
} from "./stock.types";
import {
  STOCK_BASE_UNIT_LABELS,
  STOCK_ITEM_TYPE_LABELS,
  STOCK_MOVEMENT_TYPE_LABELS,
} from "./stock.types";

const DEFAULT_CATEGORY_NAME = "Geral";

function buildItemsQuery(params: {
  category_id?: string;
  type?: string;
  is_active?: string;
}) {
  const q = new URLSearchParams();
  if (params.category_id) q.set("category_id", params.category_id);
  if (params.type) q.set("type", params.type);
  if (params.is_active !== undefined && params.is_active !== "")
    q.set("is_active", params.is_active);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function StockPage() {
  const [categories, setCategories] = useState<StockCategory[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterCategoryId, setFilterCategoryId] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterIsActive, setFilterIsActive] = useState<string>("");
  const [filterStockStatus, setFilterStockStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [editForm, setEditForm] = useState<StockItemUpdateBody>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateMovementDate, setUpdateMovementDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [updateRows, setUpdateRows] = useState<UpdateMovementRow[]>([
    {
      itemId: "",
      quantity: 0,
      movementType: "adjustment",
      unitCostWithVat: "",
      unitCostWithoutVat: "",
      reference: "",
    },
  ]);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const [newItemModalOpen, setNewItemModalOpen] = useState(false);
  const [newItemMovementDate, setNewItemMovementDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [newItemForm, setNewItemForm] = useState<StockItemCreateBody>({
    name: "",
    category_id: "",
    type: "ingredient",
    base_unit: "kg",
    min_stock: 0,
    is_sellable: false,
    sale_price: null,
    is_active: true,
    purchase_reference_unit_cost_with_vat: null,
    purchase_reference_unit_cost_without_vat: null,
  });
  const [newItemInitialQty, setNewItemInitialQty] = useState<number>(0);
  const [newItemError, setNewItemError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const list = await apiGet<StockCategory[]>("/api/stock/categories");
      setCategories(Array.isArray(list) ? list : []);
      if (!Array.isArray(list) || list.length === 0) {
        await apiPost<StockCategory>("/api/stock/categories", {
          name: DEFAULT_CATEGORY_NAME,
        });
        const again = await apiGet<StockCategory[]>("/api/stock/categories");
        setCategories(Array.isArray(again) ? again : []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar categorias");
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = buildItemsQuery({
        category_id: filterCategoryId || undefined,
        type: filterType || undefined,
        is_active: filterIsActive,
      });
      const list = await apiGet<StockItem[]>(`/api/stock/items${q}`);
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar items");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filterCategoryId, filterType, filterIsActive]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (categories.length > 0) {
      loadItems();
    }
  }, [
    loadItems,
    categories.length,
    filterCategoryId,
    filterType,
    filterIsActive,
  ]);

  const filteredItems = useMemo(() => {
    let list = items;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.sku ?? "").toLowerCase().includes(q)
      );
    }
    if (filterStockStatus) {
      list = list.filter((i) => {
        const qty = i.current_quantity ?? 0;
        const min = i.min_stock ?? 0;
        const below = min > 0 && qty < min;
        const approaching = min > 0 && qty >= min * 0.9 && qty < min;
        if (filterStockStatus === "below") return below && !approaching;
        if (filterStockStatus === "approaching") return approaching;
        if (filterStockStatus === "below_and_approaching")
          return below || approaching;
        return true;
      });
    }
    return list;
  }, [items, search, filterStockStatus]);

  const totalFiltered = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = useMemo(
    () => filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filteredItems, safePage, pageSize]
  );

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const openEdit = useCallback((item: StockItem) => {
    setEditItem(item);
    setEditForm({
      name: item.name,
      sku: item.sku,
      category_id: item.category_id,
      type: item.type,
      is_sellable: item.is_sellable,
      sale_price: item.sale_price,
      min_stock: item.min_stock,
      base_unit: item.base_unit,
      is_active: item.is_active,
      purchase_reference_unit_cost_with_vat: item.purchase_reference_unit_cost_with_vat,
      purchase_reference_unit_cost_without_vat: item.purchase_reference_unit_cost_without_vat,
    });
    setSaveError(null);
  }, []);

  const closeEdit = useCallback(() => {
    setEditItem(null);
    setEditForm({});
    setSaveError(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editItem) return;
    setSaveError(null);
    try {
      await apiPut(`/api/stock/items/${editItem.id}`, editForm);
      closeEdit();
      await loadItems();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erro ao guardar");
    }
  }, [editItem, editForm, closeEdit, loadItems]);

  const submitUpdateStock = useCallback(async () => {
    setUpdateError(null);
    const valid = updateRows.filter((r) => r.itemId && r.quantity !== 0);
    if (valid.length === 0) {
      setUpdateError("Selecione pelo menos um item e indique quantidade.");
      return;
    }
    try {
      const movementDateIso = updateMovementDate
        ? new Date(updateMovementDate + "T12:00:00").toISOString()
        : undefined;
      for (const r of valid) {
        await apiPost<unknown>("/api/stock/movements", {
          item_id: r.itemId,
          type: r.movementType,
          quantity: r.quantity,
          unit_cost_per_base_unit_with_vat:
            r.unitCostWithVat !== "" ? Number(r.unitCostWithVat) || null : null,
          unit_cost_per_base_unit_without_vat:
            r.unitCostWithoutVat !== "" ? Number(r.unitCostWithoutVat) || null : null,
          reference: r.reference.trim() || null,
          movement_date: movementDateIso,
        } satisfies StockMovementCreateBody);
      }
      setUpdateModalOpen(false);
      setUpdateMovementDate(new Date().toISOString().slice(0, 10));
      setUpdateRows([
        {
          itemId: "",
          quantity: 0,
          movementType: "adjustment",
          unitCostWithVat: "",
          unitCostWithoutVat: "",
          reference: "",
        },
      ]);
      await loadItems();
    } catch (e) {
      setUpdateError(
        e instanceof Error ? e.message : "Erro ao registar movimento"
      );
    }
  }, [updateRows, updateMovementDate, loadItems]);

  const addUpdateRow = useCallback(() => {
    setUpdateRows((prev) => [
      ...prev,
      {
        itemId: "",
        quantity: 0,
        movementType: "adjustment" as StockMovementType,
        unitCostWithVat: "",
        unitCostWithoutVat: "",
        reference: "",
      },
    ]);
  }, []);

  const updateUpdateRow = useCallback(
    (idx: number, patch: Partial<UpdateMovementRow>) => {
      setUpdateRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
      );
    },
    []
  );

  const removeUpdateRow = useCallback((idx: number) => {
    setUpdateRows((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev
    );
  }, []);

  const submitNewItem = useCallback(async () => {
    setNewItemError(null);
    const name = newItemForm.name.trim();
    if (!name || !newItemForm.category_id) {
      setNewItemError("Nome e categoria são obrigatórios.");
      return;
    }
    try {
      const created = await apiPost<StockItem>("/api/stock/items", newItemForm);
      if (newItemInitialQty !== 0) {
        const movementDateIso = newItemMovementDate
          ? new Date(newItemMovementDate + "T12:00:00").toISOString()
          : undefined;
        await apiPost("/api/stock/movements", {
          item_id: created.id,
          type: "adjustment" as StockMovementType,
          quantity: newItemInitialQty,
          movement_date: movementDateIso,
        } satisfies StockMovementCreateBody);
      }
      setNewItemModalOpen(false);
      setNewItemForm({
        name: "",
        category_id: categories[0]?.id ?? "",
        type: "ingredient",
        base_unit: "kg",
        min_stock: 0,
        is_sellable: false,
        sale_price: null,
        is_active: true,
        purchase_reference_unit_cost_with_vat: null,
        purchase_reference_unit_cost_without_vat: null,
      });
      setNewItemInitialQty(0);
      await loadItems();
    } catch (e) {
      setNewItemError(e instanceof Error ? e.message : "Erro ao criar item");
    }
  }, [newItemForm, newItemInitialQty, newItemMovementDate, categories, loadItems]);

  const openNewItemModal = useCallback(() => {
    setNewItemModalOpen(true);
    setNewItemError(null);
    setNewItemMovementDate(new Date().toISOString().slice(0, 10));
    if (categories.length > 0) {
      setNewItemForm((f) => ({
        ...f,
        category_id: categories[0].id,
      }));
    }
  }, [categories]);

  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? id;

  if (categories.length === 0 && !error) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-slate-500">A carregar categorias…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Stock</h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setUpdateModalOpen(true);
              setUpdateError(null);
              setUpdateMovementDate(new Date().toISOString().slice(0, 10));
            setUpdateRows([
                {
                  itemId: "",
                  quantity: 0,
                  movementType: "adjustment",
                  unitCostWithVat: "",
                  unitCostWithoutVat: "",
                  reference: "",
                },
              ]);
            }}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Atualizar stock
          </button>
          <button
            type="button"
            onClick={openNewItemModal}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Novo item
          </button>
        </div>
      </div>

      {updateModalOpen && (
        <UpdateStockModal
          items={items}
          movementDate={updateMovementDate}
          setMovementDate={setUpdateMovementDate}
          rows={updateRows}
          updateRow={updateUpdateRow}
          addRow={addUpdateRow}
          removeRow={removeUpdateRow}
          error={updateError}
          onSubmit={submitUpdateStock}
          onClose={() => setUpdateModalOpen(false)}
        />
      )}

      {newItemModalOpen && (
        <NewItemModal
          form={newItemForm}
          setForm={setNewItemForm}
          initialQty={newItemInitialQty}
          setInitialQty={setNewItemInitialQty}
          movementDate={newItemMovementDate}
          setMovementDate={setNewItemMovementDate}
          categories={categories}
          error={newItemError}
          onSubmit={submitNewItem}
          onClose={() => setNewItemModalOpen(false)}
        />
      )}

      {/* Filters + Search */}
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Pesquisar</label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ex: farinha, SKU-001"
            className="w-48 rounded border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Categoria</label>
          <select
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
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
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {(
              Object.entries(STOCK_ITEM_TYPE_LABELS) as [
                StockItemType,
                string
              ][]
            ).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Estado</label>
          <select
            value={filterIsActive}
            onChange={(e) => setFilterIsActive(e.target.value)}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Stock</label>
          <select
            value={filterStockStatus}
            onChange={(e) => {
              setFilterStockStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="below">Abaixo do mínimo</option>
            <option value="approaching">Próximos do mínimo</option>
            <option value="below_and_approaching">Próximos e abaixo</option>
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="font-medium text-slate-500">Legenda:</span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-4 w-3 rounded bg-red-50 ring-1 ring-red-200/50" />
          Abaixo do mínimo (ex: 8 kg de 10 kg mín.)
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-4 w-3 rounded bg-amber-50 ring-1 ring-amber-200/50" />
          Próximo do mínimo (ex: 9 kg de 10 kg mín.)
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-4 w-3 rounded bg-white border border-slate-200" />
          Stock OK (ex: 12 kg de 10 kg mín.)
        </span>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            A carregar…
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-slate-600">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium text-right">Qtd. atual</th>
                <th className="px-4 py-3 font-medium text-right">Stock mín.</th>
                <th className="px-4 py-3 font-medium text-right">Custo c/ IVA</th>
                <th className="px-4 py-3 font-medium text-right">Custo s/ IVA</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium w-20 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => {
                const qty = item.current_quantity ?? 0;
                const min = item.min_stock ?? 0;
                const below = min > 0 && qty < min * 0.9;
                const approaching = min > 0 && qty >= min * 0.9 && qty < min;
                const rowBg = below
                  ? "bg-red-50/80 hover:bg-red-100/60"
                  : approaching
                  ? "bg-amber-50/80 hover:bg-amber-100/60"
                  : "hover:bg-slate-50/50";
                return (
                  <tr
                    key={item.id}
                    className={`border-t border-slate-100 ${rowBg}`}
                  >
                    <td className="px-4 py-2 font-medium text-slate-800">
                      {item.name}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {categoryName(item.category_id)}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {STOCK_ITEM_TYPE_LABELS[item.type]}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {formatNumber(qty)}{" "}
                      {STOCK_BASE_UNIT_LABELS[item.base_unit]}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                      {formatNumber(min)}{" "}
                      {STOCK_BASE_UNIT_LABELS[item.base_unit]}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                      {item.last_purchase_unit_cost_with_vat != null && item.last_purchase_unit_cost_with_vat > 0
                        ? formatEUR(item.last_purchase_unit_cost_with_vat)
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                      {item.last_purchase_unit_cost_without_vat != null && item.last_purchase_unit_cost_without_vat > 0
                        ? formatEUR(item.last_purchase_unit_cost_without_vat)
                        : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                          item.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {item.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
                {paginatedItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      Nenhum item encontrado
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {!loading && totalFiltered > 0 && (
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
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-slate-600">
                {totalFiltered === 0
                  ? "registos"
                  : `${(safePage - 1) * pageSize + 1}–${Math.min(
                      safePage * pageSize,
                      totalFiltered
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
      </div>

      {/* Edit modal */}
      {editItem && (
        <StockEditModal
          item={editItem}
          form={editForm}
          setForm={setEditForm}
          categories={categories}
          error={saveError}
          onSave={saveEdit}
          onClose={closeEdit}
        />
      )}
    </div>
  );
}

function StockEditModal({
  item,
  form,
  setForm,
  categories,
  error,
  onSave,
  onClose,
}: {
  item: StockItem;
  form: StockItemUpdateBody;
  setForm: React.Dispatch<React.SetStateAction<StockItemUpdateBody>>;
  categories: StockCategory[];
  error: string | null;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-edit-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h3
          id="stock-edit-title"
          className="text-base font-semibold text-slate-800"
        >
          Editar — {item.name}
        </h3>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Nome</label>
            <input
              value={form.name ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">SKU</label>
            <input
              value={form.sku ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  sku: e.target.value.trim() || null,
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="—"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              Categoria
            </label>
            <select
              value={form.category_id ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, category_id: e.target.value }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            >
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
              value={form.type ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value as StockItemType,
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            >
              {(
                Object.entries(STOCK_ITEM_TYPE_LABELS) as [
                  StockItemType,
                  string
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
              Stock mínimo
            </label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={form.min_stock === 0 ? "" : form.min_stock}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  min_stock: Number(e.target.value) || 0,
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Unidade</label>
            <select
              value={form.base_unit ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  base_unit: e.target.value as StockBaseUnit,
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            >
              {(
                Object.entries(STOCK_BASE_UNIT_LABELS) as [
                  StockBaseUnit,
                  string
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
              Custo de referência c/ IVA por {STOCK_BASE_UNIT_LABELS[form.base_unit ?? item.base_unit] ?? "un"} (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={
                form.purchase_reference_unit_cost_with_vat == null ||
                form.purchase_reference_unit_cost_with_vat === 0
                  ? ""
                  : form.purchase_reference_unit_cost_with_vat
              }
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  purchase_reference_unit_cost_with_vat:
                    e.target.value !== ""
                      ? Number(e.target.value) || null
                      : null,
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              Custo de referência s/ IVA por {STOCK_BASE_UNIT_LABELS[form.base_unit ?? item.base_unit] ?? "un"} (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={
                form.purchase_reference_unit_cost_without_vat == null ||
                form.purchase_reference_unit_cost_without_vat === 0
                  ? ""
                  : form.purchase_reference_unit_cost_without_vat
              }
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  purchase_reference_unit_cost_without_vat:
                    e.target.value !== ""
                      ? Number(e.target.value) || null
                      : null,
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Opcional"
            />
          </div>
          {((item.last_purchase_unit_cost_with_vat != null && item.last_purchase_unit_cost_with_vat > 0) ||
            (item.last_purchase_unit_cost_without_vat != null && item.last_purchase_unit_cost_without_vat > 0)) && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Último custo de compra (só leitura)
              </label>
              <p className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {item.last_purchase_unit_cost_with_vat != null && item.last_purchase_unit_cost_with_vat > 0 && (
                  <>c/ IVA: {formatEUR(item.last_purchase_unit_cost_with_vat)}</>
                )}
                {item.last_purchase_unit_cost_with_vat != null && item.last_purchase_unit_cost_with_vat > 0 &&
                 item.last_purchase_unit_cost_without_vat != null && item.last_purchase_unit_cost_without_vat > 0 && " · "}
                {item.last_purchase_unit_cost_without_vat != null && item.last_purchase_unit_cost_without_vat > 0 && (
                  <>s/ IVA: {formatEUR(item.last_purchase_unit_cost_without_vat)}</>
                )}
                {" "}/ {STOCK_BASE_UNIT_LABELS[item.base_unit]}
              </p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-is-sellable"
              checked={form.is_sellable ?? false}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  is_sellable: e.target.checked,
                  sale_price: e.target.checked ? form.sale_price : null,
                }))
              }
            />
            <label
              htmlFor="edit-is-sellable"
              className="text-sm text-slate-600"
            >
              Vendável
            </label>
          </div>
          {(form.is_sellable ?? false) && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Preço de venda (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={
                  form.sale_price == null || form.sale_price === 0
                    ? ""
                    : form.sale_price
                }
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    sale_price:
                      e.target.value !== ""
                        ? Number(e.target.value) || null
                        : null,
                  }))
                }
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                placeholder="0"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-is-active"
              checked={form.is_active ?? true}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_active: e.target.checked }))
              }
            />
            <label htmlFor="edit-is-active" className="text-sm text-slate-600">
              Ativo
            </label>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

type UpdateMovementRow = {
  itemId: string;
  quantity: number;
  movementType: StockMovementType;
  unitCostWithVat: string;
  unitCostWithoutVat: string;
  reference: string;
};

function UpdateStockModal({
  items,
  movementDate,
  setMovementDate,
  rows,
  updateRow,
  addRow,
  removeRow,
  error,
  onSubmit,
  onClose,
}: {
  items: StockItem[];
  movementDate: string;
  setMovementDate: (v: string) => void;
  rows: UpdateMovementRow[];
  updateRow: (idx: number, patch: Partial<UpdateMovementRow>) => void;
  addRow: () => void;
  removeRow: (idx: number) => void;
  error: string | null;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-stock-title"
    >
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h3
          id="update-stock-title"
          className="text-base font-semibold text-slate-800"
        >
          Atualizar stock
        </h3>
        <div className="mt-4">
          <label className="mb-1 block text-xs text-slate-500">
            Data da movimentação
          </label>
          <input
            type="date"
            value={movementDate}
            onChange={(e) => setMovementDate(e.target.value)}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="pr-4 py-2 font-medium">Item</th>
                <th className="pr-4 py-2 font-medium">Quantidade (+/−)</th>
                <th className="pr-4 py-2 font-medium">Tipo</th>
                <th className="pr-4 py-2 font-medium">Custo c/ IVA</th>
                <th className="pr-4 py-2 font-medium">Custo s/ IVA</th>
                <th className="pr-4 py-2 font-medium">Notas</th>
                <th className="w-20 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="py-2 pr-4">
                    <select
                      value={row.itemId}
                      onChange={(e) => {
                        const itemId = e.target.value;
                        const patch: Partial<UpdateMovementRow> = { itemId };
                        if (row.movementType === "purchase" && itemId) {
                          const item = items.find((i) => i.id === itemId);
                          if (item && row.unitCostWithVat === "" && row.unitCostWithoutVat === "") {
                            const withVat = item.last_purchase_unit_cost_with_vat ?? item.purchase_reference_unit_cost_with_vat;
                            const withoutVat = item.last_purchase_unit_cost_without_vat ?? item.purchase_reference_unit_cost_without_vat;
                            if (withVat != null && withVat > 0) patch.unitCostWithVat = String(withVat);
                            if (withoutVat != null && withoutVat > 0) patch.unitCostWithoutVat = String(withoutVat);
                          }
                        }
                        updateRow(idx, patch);
                      }}
                      className="w-full min-w-[160px] rounded border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">Selecionar</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                          {i.sku ? ` (${i.sku})` : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      step="0.001"
                      value={row.quantity === 0 ? "" : row.quantity}
                      onChange={(e) =>
                        updateRow(idx, {
                          quantity: Number(e.target.value) || 0,
                        })
                      }
                      className="w-28 rounded border border-slate-200 px-3 py-2 text-sm"
                      placeholder="0"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <select
                      value={row.movementType}
                      onChange={(e) =>
                        updateRow(idx, {
                          movementType: e.target.value as StockMovementType,
                        })
                      }
                      className="rounded border border-slate-200 px-3 py-2 text-sm"
                    >
                      {(
                        Object.entries(STOCK_MOVEMENT_TYPE_LABELS) as [
                          StockMovementType,
                          string
                        ][]
                      ).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.unitCostWithVat}
                      onChange={(e) =>
                        updateRow(idx, { unitCostWithVat: e.target.value })
                      }
                      className="w-20 rounded border border-slate-200 px-3 py-2 text-sm"
                      placeholder="—"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.unitCostWithoutVat}
                      onChange={(e) =>
                        updateRow(idx, { unitCostWithoutVat: e.target.value })
                      }
                      className="w-20 rounded border border-slate-200 px-3 py-2 text-sm"
                      placeholder="—"
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="text"
                      value={row.reference}
                      onChange={(e) =>
                        updateRow(idx, { reference: e.target.value })
                      }
                      className="w-36 rounded border border-slate-200 px-3 py-2 text-sm"
                      placeholder="—"
                    />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={addRow}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            + Adicionar item
          </button>
          <p className="text-xs text-slate-500">
            O custo só atualiza o «último custo» do item na tabela quando o tipo for <strong>Compra</strong>.
          </p>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Registar
          </button>
        </div>
      </div>
    </div>
  );
}

function NewItemModal({
  form,
  setForm,
  initialQty,
  setInitialQty,
  movementDate,
  setMovementDate,
  categories,
  error,
  onSubmit,
  onClose,
}: {
  form: StockItemCreateBody;
  setForm: React.Dispatch<React.SetStateAction<StockItemCreateBody>>;
  initialQty: number;
  setInitialQty: (n: number) => void;
  movementDate: string;
  setMovementDate: (v: string) => void;
  categories: StockCategory[];
  error: string | null;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-item-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h3
          id="new-item-title"
          className="text-base font-semibold text-slate-800"
        >
          Novo item
        </h3>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Nome *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Ex: Farinha"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">SKU</label>
            <input
              value={form.sku ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  sku: e.target.value.trim() || null,
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="—"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              Categoria *
            </label>
            <select
              value={form.category_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, category_id: e.target.value }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Selecionar</option>
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
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value as StockItemType,
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            >
              {(
                Object.entries(STOCK_ITEM_TYPE_LABELS) as [
                  StockItemType,
                  string
                ][]
              ).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Unidade</label>
            <select
              value={form.base_unit}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  base_unit: e.target.value as StockBaseUnit,
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            >
              {(
                Object.entries(STOCK_BASE_UNIT_LABELS) as [
                  StockBaseUnit,
                  string
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
              Stock mínimo
            </label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={form.min_stock === 0 ? "" : form.min_stock}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  min_stock: Number(e.target.value) || 0,
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              Custo de referência c/ IVA por {STOCK_BASE_UNIT_LABELS[form.base_unit] ?? "un"} (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={
                form.purchase_reference_unit_cost_with_vat == null ||
                form.purchase_reference_unit_cost_with_vat === 0
                  ? ""
                  : form.purchase_reference_unit_cost_with_vat
              }
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  purchase_reference_unit_cost_with_vat:
                    e.target.value !== ""
                      ? Number(e.target.value) || null
                      : null,
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              Custo de referência s/ IVA por {STOCK_BASE_UNIT_LABELS[form.base_unit] ?? "un"} (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={
                form.purchase_reference_unit_cost_without_vat == null ||
                form.purchase_reference_unit_cost_without_vat === 0
                  ? ""
                  : form.purchase_reference_unit_cost_without_vat
              }
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  purchase_reference_unit_cost_without_vat:
                    e.target.value !== ""
                      ? Number(e.target.value) || null
                      : null,
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Opcional"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="new-is-sellable"
              checked={form.is_sellable ?? false}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  is_sellable: e.target.checked,
                  sale_price: e.target.checked ? form.sale_price : null,
                }))
              }
            />
            <label htmlFor="new-is-sellable" className="text-sm text-slate-600">
              Vendável
            </label>
          </div>
          {(form.is_sellable ?? false) && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Preço de venda (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={
                  form.sale_price == null || form.sale_price === 0
                    ? ""
                    : form.sale_price
                }
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    sale_price:
                      e.target.value !== ""
                        ? Number(e.target.value) || null
                        : null,
                  }))
                }
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                placeholder="0"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              Quantidade inicial (opcional)
            </label>
            <input
              type="number"
              step="0.001"
              value={initialQty === 0 ? "" : initialQty}
              onChange={(e) => setInitialQty(Number(e.target.value) || 0)}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="0"
            />
          </div>
          {initialQty !== 0 && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Data da movimentação
              </label>
              <input
                type="date"
                value={movementDate}
                onChange={(e) => setMovementDate(e.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="new-is-active"
              checked={form.is_active ?? true}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_active: e.target.checked }))
              }
            />
            <label htmlFor="new-is-active" className="text-sm text-slate-600">
              Ativo
            </label>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}
