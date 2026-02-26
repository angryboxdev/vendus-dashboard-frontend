import type {
  Pizza,
  PizzaCategory,
  PizzaRecipe,
  PizzaRecipeItem,
  PizzaSize,
} from "./pizzas.types";
import { apiDelete, apiGet, apiPost, apiPut } from "../../lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PIZZA_CATEGORY_LABELS } from "./pizzas.types";

const PIZZA_CATEGORY_ORDER: Record<PizzaCategory, number> = {
  classics: 0,
  specials: 1,
  sweeties: 2,
};
import { STOCK_BASE_UNIT_LABELS } from "./stock.types";
import type { StockItem } from "./stock.types";
import { formatNumber } from "../../lib/format";

function buildPizzasQuery(params: { category?: string; is_active?: string }) {
  const q = new URLSearchParams();
  if (params.category) q.set("category", params.category);
  if (params.is_active !== undefined && params.is_active !== "")
    q.set("is_active", params.is_active);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function PizzasPage() {
  const [pizzas, setPizzas] = useState<Pizza[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterIsActive, setFilterIsActive] = useState<string>("");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    category: "classics" as PizzaCategory,
    is_active: true,
  });
  const [createError, setCreateError] = useState<string | null>(null);

  const [recipeModalPizza, setRecipeModalPizza] = useState<Pizza | null>(null);
  const [recipeModalRecipe, setRecipeModalRecipe] =
    useState<PizzaRecipe | null>(null);
  const [recipeModalItems, setRecipeModalItems] = useState<PizzaRecipeItem[]>(
    []
  );
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [recipeModalLoading, setRecipeModalLoading] = useState(false);
  const [recipeModalError, setRecipeModalError] = useState<string | null>(null);

  const loadPizzas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = buildPizzasQuery({
        category: filterCategory || undefined,
        is_active: filterIsActive,
      });
      const list = await apiGet<Pizza[]>(`/api/pizzas${q}`);
      setPizzas(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar pizzas");
      setPizzas([]);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterIsActive]);

  useEffect(() => {
    loadPizzas();
  }, [loadPizzas]);

  const openCreateModal = useCallback(() => {
    setCreateModalOpen(true);
    setCreateError(null);
    setCreateForm({
      name: "",
      description: "",
      category: "classics",
      is_active: true,
    });
  }, []);

  const submitCreatePizza = useCallback(async () => {
    setCreateError(null);
    const name = createForm.name.trim();
    if (!name) {
      setCreateError("Nome é obrigatório.");
      return;
    }
    try {
      await apiPost<Pizza>("/api/pizzas", {
        name,
        description: createForm.description.trim() || "",
        category: createForm.category,
        is_active: createForm.is_active,
      });
      setCreateModalOpen(false);
      await loadPizzas();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Erro ao criar pizza");
    }
  }, [createForm, loadPizzas]);

  const openRecipeModal = useCallback(async (pizza: Pizza) => {
    setRecipeModalPizza(pizza);
    setRecipeModalError(null);
    setRecipeModalLoading(true);
    try {
      const [recipes, stock] = await Promise.all([
        apiGet<PizzaRecipe[]>(`/api/pizzas/${pizza.id}/recipes`),
        apiGet<StockItem[]>("/api/stock/items"),
      ]);
      setStockItems(Array.isArray(stock) ? stock : []);
      const active =
        Array.isArray(recipes) && recipes.length > 0
          ? recipes.find((r) => r.is_active) ?? recipes[0]
          : null;
      setRecipeModalRecipe(active);
      if (active) {
        const items = await apiGet<PizzaRecipeItem[]>(
          `/api/pizzas/${pizza.id}/recipes/${active.id}/items`
        );
        setRecipeModalItems(Array.isArray(items) ? items : []);
      } else {
        setRecipeModalItems([]);
      }
    } catch (e) {
      setRecipeModalError(
        e instanceof Error ? e.message : "Erro ao carregar receita"
      );
      setRecipeModalItems([]);
    } finally {
      setRecipeModalLoading(false);
    }
  }, []);

  const closeRecipeModal = useCallback(() => {
    setRecipeModalPizza(null);
    setRecipeModalRecipe(null);
    setRecipeModalItems([]);
  }, []);

  const createRecipeAndOpen = useCallback(async () => {
    if (!recipeModalPizza) return;
    setRecipeModalError(null);
    try {
      const recipe = await apiPost<PizzaRecipe>(
        `/api/pizzas/${recipeModalPizza.id}/recipes`,
        {}
      );
      setRecipeModalRecipe(recipe);
      setRecipeModalItems([]);
    } catch (e) {
      setRecipeModalError(
        e instanceof Error ? e.message : "Erro ao criar receita"
      );
    }
  }, [recipeModalPizza]);

  const addRecipeItem = useCallback(
    async (stockItemId: string, size: PizzaSize, quantity: number) => {
      if (!recipeModalPizza || !recipeModalRecipe) return;
      setRecipeModalError(null);
      try {
        const item = await apiPost<PizzaRecipeItem>(
          `/api/pizzas/${recipeModalPizza.id}/recipes/${recipeModalRecipe.id}/items`,
          { stock_item_id: stockItemId, size, quantity }
        );
        setRecipeModalItems((prev) => [...prev, item]);
      } catch (e) {
        setRecipeModalError(
          e instanceof Error ? e.message : "Erro ao adicionar ingrediente"
        );
      }
    },
    [recipeModalPizza, recipeModalRecipe]
  );

  const updateRecipeItem = useCallback(
    async (
      itemId: string,
      patch: {
        quantity?: number;
        waste_factor?: number | null;
      }
    ) => {
      if (!recipeModalPizza || !recipeModalRecipe) return;
      setRecipeModalError(null);
      try {
        const updated = await apiPut<PizzaRecipeItem>(
          `/api/pizzas/${recipeModalPizza.id}/recipes/${recipeModalRecipe.id}/items/${itemId}`,
          patch
        );
        setRecipeModalItems((prev) =>
          prev.map((i) => (i.id === itemId ? updated : i))
        );
      } catch (e) {
        setRecipeModalError(
          e instanceof Error ? e.message : "Erro ao atualizar ingrediente"
        );
      }
    },
    [recipeModalPizza, recipeModalRecipe]
  );

  const deleteRecipeItem = useCallback(
    async (itemId: string) => {
      if (!recipeModalPizza || !recipeModalRecipe) return;
      setRecipeModalError(null);
      try {
        await apiDelete(
          `/api/pizzas/${recipeModalPizza.id}/recipes/${recipeModalRecipe.id}/items/${itemId}`
        );
        setRecipeModalItems((prev) => prev.filter((i) => i.id !== itemId));
      } catch (e) {
        setRecipeModalError(
          e instanceof Error ? e.message : "Erro ao remover ingrediente"
        );
      }
    },
    [recipeModalPizza, recipeModalRecipe]
  );

  const stockItemName = (id: string) =>
    stockItems.find((s) => s.id === id)?.name ?? id;
  const sortedPizzas = useMemo(
    () =>
      [...pizzas].sort(
        (a, b) => PIZZA_CATEGORY_ORDER[a.category] - PIZZA_CATEGORY_ORDER[b.category]
      ),
    [pizzas]
  );

  const stockItemUnit = (id: string) => {
    const s = stockItems.find((i) => i.id === id);
    if (!s) return "";
    const key = s.base_unit as keyof typeof STOCK_BASE_UNIT_LABELS;
    return (STOCK_BASE_UNIT_LABELS[key] as string) ?? String(s.base_unit);
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Pizzas</h2>
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Nova pizza
        </button>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Categoria</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {(
              Object.entries(PIZZA_CATEGORY_LABELS) as [PizzaCategory, string][]
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
            <option value="true">Ativas</option>
            <option value="false">Inativas</option>
          </select>
        </div>
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
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium w-28 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedPizzas.map((pizza) => (
                <tr
                  key={pizza.id}
                  className="border-t border-slate-100 hover:bg-slate-50/50"
                >
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {pizza.name}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {PIZZA_CATEGORY_LABELS[pizza.category]}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                        pizza.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {pizza.is_active ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <button
                      type="button"
                      onClick={() => openRecipeModal(pizza)}
                      className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 whitespace-nowrap"
                    >
                      Ver receita
                    </button>
                  </td>
                </tr>
              ))}
              {sortedPizzas.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Nenhuma pizza encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {createModalOpen && (
        <CreatePizzaModal
          form={createForm}
          setForm={setCreateForm}
          error={createError}
          onSubmit={submitCreatePizza}
          onClose={() => setCreateModalOpen(false)}
        />
      )}

      {recipeModalPizza && (
        <RecipeModal
          pizza={recipeModalPizza}
          recipe={recipeModalRecipe}
          items={recipeModalItems}
          stockItems={stockItems}
          loading={recipeModalLoading}
          error={recipeModalError}
          stockItemName={stockItemName}
          stockItemUnit={stockItemUnit}
          onClose={closeRecipeModal}
          onCreateRecipe={createRecipeAndOpen}
          onAddItem={addRecipeItem}
          onUpdateItem={updateRecipeItem}
          onDeleteItem={deleteRecipeItem}
        />
      )}
    </div>
  );
}

function CreatePizzaModal({
  form,
  setForm,
  error,
  onSubmit,
  onClose,
}: {
  form: {
    name: string;
    description: string;
    category: PizzaCategory;
    is_active: boolean;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      description: string;
      category: PizzaCategory;
      is_active: boolean;
    }>
  >;
  error: string | null;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-pizza-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h3
          id="create-pizza-title"
          className="text-base font-semibold text-slate-800"
        >
          Nova pizza
        </h3>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Nome *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Ex: Margherita"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              Descrição
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={2}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Opcional"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              Categoria
            </label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category: e.target.value as PizzaCategory,
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            >
              {(
                Object.entries(PIZZA_CATEGORY_LABELS) as [
                  PizzaCategory,
                  string
                ][]
              ).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="create-is-active"
              checked={form.is_active}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_active: e.target.checked }))
              }
            />
            <label
              htmlFor="create-is-active"
              className="text-sm text-slate-600"
            >
              Ativa
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

type RecipeModalProps = {
  pizza: Pizza;
  recipe: PizzaRecipe | null;
  items: PizzaRecipeItem[];
  stockItems: StockItem[];
  loading: boolean;
  error: string | null;
  stockItemName: (id: string) => string;
  stockItemUnit: (id: string) => string;
  onClose: () => void;
  onCreateRecipe: () => void;
  onAddItem: (stockItemId: string, size: PizzaSize, quantity: number) => void;
  onUpdateItem: (
    itemId: string,
    patch: {
      quantity?: number;
      waste_factor?: number | null;
    }
  ) => void;
  onDeleteItem: (itemId: string) => void;
};

function RecipeModal({
  pizza,
  recipe,
  items,
  stockItems,
  loading,
  error,
  stockItemName,
  stockItemUnit,
  onClose,
  onCreateRecipe,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}: RecipeModalProps) {
  const [addStockId, setAddStockId] = useState("");
  const [addSize, setAddSize] = useState<PizzaSize>("small");
  const [addQty, setAddQty] = useState<string>("");
  const [editingStockItemId, setEditingStockItemId] = useState<string | null>(
    null
  );
  const [editSmallQty, setEditSmallQty] = useState<string>("");
  const [editLargeQty, setEditLargeQty] = useState<string>("");

  const groupedRows = useMemo(() => {
    const map = new Map<
      string,
      { small: PizzaRecipeItem | null; large: PizzaRecipeItem | null }
    >();
    for (const item of items) {
      if (!map.has(item.stock_item_id)) {
        map.set(item.stock_item_id, { small: null, large: null });
      }
      const row = map.get(item.stock_item_id)!;
      if (item.size === "small") row.small = item;
      else row.large = item;
    }
    return Array.from(map.entries()).map(
      ([stock_item_id, { small, large }]) => ({
        stock_item_id,
        small,
        large,
      })
    );
  }, [items]);

  const handleAdd = () => {
    const q = Number(addQty) || 0;
    if (!addStockId || q <= 0) return;
    onAddItem(addStockId, addSize, q);
    setAddStockId("");
    setAddQty("");
  };

  const startEdit = (row: {
    stock_item_id: string;
    small: PizzaRecipeItem | null;
    large: PizzaRecipeItem | null;
  }) => {
    setEditingStockItemId(row.stock_item_id);
    setEditSmallQty(row.small ? String(row.small.quantity) : "");
    setEditLargeQty(row.large ? String(row.large.quantity) : "");
  };

  const saveEdit = () => {
    if (!editingStockItemId) return;
    const row = groupedRows.find(
      (r) => r.stock_item_id === editingStockItemId
    );
    if (!row) return;
    const smallQty = Number(editSmallQty) || 0;
    const largeQty = Number(editLargeQty) || 0;
    if (row.small && smallQty > 0) {
      onUpdateItem(row.small.id, { quantity: smallQty });
    }
    if (row.small && smallQty <= 0) {
      onDeleteItem(row.small.id);
    }
    if (row.large && largeQty > 0) {
      onUpdateItem(row.large.id, { quantity: largeQty });
    }
    if (row.large && largeQty <= 0) {
      onDeleteItem(row.large.id);
    }
    setEditingStockItemId(null);
  };

  const deleteRow = (row: {
    stock_item_id: string;
    small: PizzaRecipeItem | null;
    large: PizzaRecipeItem | null;
  }) => {
    if (row.small) onDeleteItem(row.small.id);
    if (row.large) onDeleteItem(row.large.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h3
              id="recipe-modal-title"
              className="text-base font-semibold text-slate-800"
            >
              Receita — {pizza.name}
            </h3>
            {recipe && (
              <p className="mt-1 text-xs text-slate-500">
                Versão {recipe.version}
                {recipe.notes ? ` · ${recipe.notes}` : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
        <div className="p-6">
          {loading ? (
            <p className="text-sm text-slate-500">A carregar…</p>
          ) : !recipe ? (
            <div>
              <p className="text-sm text-slate-600">
                Esta pizza ainda não tem receita.
              </p>
              <button
                type="button"
                onClick={onCreateRecipe}
                className="mt-4 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Criar receita
              </button>
            </div>
          ) : (
            <>
              {/* Add ingredient */}
              <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex-1 min-w-[140px]">
                  <label className="mb-1 block text-xs text-slate-500">
                    Ingrediente
                  </label>
                  <select
                    value={addStockId}
                    onChange={(e) => setAddStockId(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Selecionar</option>
                    {stockItems.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (
                        {(STOCK_BASE_UNIT_LABELS as Record<string, string>)[
                          s.base_unit
                        ] ?? s.base_unit}
                        )
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    Tamanho
                  </label>
                  <select
                    value={addSize}
                    onChange={(e) => setAddSize(e.target.value as PizzaSize)}
                    className="rounded border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="small">Pequena</option>
                    <option value="large">Grande</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">
                    Qtd.
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                    className="w-24 rounded border border-slate-200 px-3 py-2 text-sm"
                    placeholder="0"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Adicionar
                </button>
              </div>

              {/* Items table */}
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-white text-slate-600">
                      <th className="px-4 py-2 font-medium">Ingrediente</th>
                      <th className="px-4 py-2 font-medium text-right">
                        Pequena
                      </th>
                      <th className="px-4 py-2 font-medium text-right">
                        Grande
                      </th>
                      <th className="w-28 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedRows.map((row) => {
                      const isEditing =
                        editingStockItemId === row.stock_item_id;
                      const unit = stockItemUnit(row.stock_item_id);
                      return (
                        <tr
                          key={row.stock_item_id}
                          className="border-t border-slate-100"
                        >
                          <td className="px-4 py-2 text-slate-800">
                            {stockItemName(row.stock_item_id)}{" "}
                            <span className="text-slate-500">({unit})</span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                value={editSmallQty}
                                onChange={(e) =>
                                  setEditSmallQty(e.target.value)
                                }
                                placeholder={row.small ? "" : "—"}
                                className="w-20 rounded border px-2 py-1 text-sm"
                              />
                            ) : row.small ? (
                              <span className="tabular-nums">
                                {formatNumber(row.small.quantity)} {unit}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                value={editLargeQty}
                                onChange={(e) =>
                                  setEditLargeQty(e.target.value)
                                }
                                placeholder={row.large ? "" : "—"}
                                className="w-20 rounded border px-2 py-1 text-sm"
                              />
                            ) : row.large ? (
                              <span className="tabular-nums">
                                {formatNumber(row.large.quantity)} {unit}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {isEditing ? (
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={saveEdit}
                                  className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                                >
                                  Ok
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingStockItemId(null)
                                  }
                                  className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEdit(row)}
                                  className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteRow(row)}
                                  className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                                >
                                  Remover
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {groupedRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-6 text-center text-slate-500"
                        >
                          Nenhum ingrediente. Adicione acima.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
