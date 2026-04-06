import type {
  Pizza,
  PizzaCategory,
  PizzaRecipe,
  PizzaRecipeItem,
  PizzaSize,
  RecipeIngredientRef,
} from "./pizzas.types";
import type { Preparation, PreparationItem } from "./preparations.types";
import type { StockBaseUnit, StockItem } from "./stock.types";
import { apiDelete, apiGet, apiPost, apiPut } from "../../lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PIZZA_CATEGORY_LABELS } from "./pizzas.types";
import { STOCK_BASE_UNIT_LABELS } from "./stock.types";
import { formatNumber } from "../../lib/format";

const PIZZA_CATEGORY_ORDER: Record<PizzaCategory, number> = {
  classics: 0,
  specials: 1,
  sweeties: 2,
};

const YIELD_UNIT_OPTIONS: string[] = ["g", "kg", "ml", "cl", "l", "un"];

function buildPizzasQuery(params: { category?: string; is_active?: string }) {
  const q = new URLSearchParams();
  if (params.category) q.set("category", params.category);
  if (params.is_active !== undefined && params.is_active !== "")
    q.set("is_active", params.is_active);
  const s = q.toString();
  return s ? `?${s}` : "";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function PizzasPage() {
  // --- Pizzas ---
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

  // --- Recipe modal ---
  const [recipeModalPizza, setRecipeModalPizza] = useState<Pizza | null>(null);
  const [recipeModalRecipe, setRecipeModalRecipe] =
    useState<PizzaRecipe | null>(null);
  const [recipeModalItems, setRecipeModalItems] = useState<PizzaRecipeItem[]>(
    [],
  );
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [recipeModalLoading, setRecipeModalLoading] = useState(false);
  const [recipeModalError, setRecipeModalError] = useState<string | null>(null);

  // --- Preparations list ---
  const [preparations, setPreparations] = useState<Preparation[]>([]);
  const [prepLoading, setPrepLoading] = useState(true);
  const [prepError, setPrepError] = useState<string | null>(null);

  // --- Preparation create/edit form modal ---
  const [prepFormOpen, setPrepFormOpen] = useState(false);
  const [editingPrep, setEditingPrep] = useState<Preparation | null>(null);
  const [prepForm, setPrepForm] = useState({
    name: "",
    description: "",
    yield_unit: "g",
    use_as_unit: false,
  });
  const [prepFormError, setPrepFormError] = useState<string | null>(null);
  const [prepFormSaving, setPrepFormSaving] = useState(false);

  // --- Preparation detail modal (ingredients) ---
  const [prepDetailPrep, setPrepDetailPrep] = useState<Preparation | null>(
    null,
  );
  const [prepDetailItems, setPrepDetailItems] = useState<PreparationItem[]>([]);
  const [prepDetailLoading, setPrepDetailLoading] = useState(false);
  const [prepDetailError, setPrepDetailError] = useState<string | null>(null);

  // =========================================================================
  // Pizzas callbacks
  // =========================================================================
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
          ? (recipes.find((r) => r.is_active) ?? recipes[0])
          : null;
      setRecipeModalRecipe(active);
      if (active) {
        const items = await apiGet<PizzaRecipeItem[]>(
          `/api/pizzas/${pizza.id}/recipes/${active.id}/items`,
        );
        setRecipeModalItems(Array.isArray(items) ? items : []);
      } else {
        setRecipeModalItems([]);
      }
    } catch (e) {
      setRecipeModalError(
        e instanceof Error ? e.message : "Erro ao carregar receita",
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
        {},
      );
      setRecipeModalRecipe(recipe);
      setRecipeModalItems([]);
    } catch (e) {
      setRecipeModalError(
        e instanceof Error ? e.message : "Erro ao criar receita",
      );
    }
  }, [recipeModalPizza]);

  const addRecipeItem = useCallback(
    async (
      ingredient: RecipeIngredientRef,
      size: PizzaSize,
      quantity: number,
    ) => {
      if (!recipeModalPizza || !recipeModalRecipe) return;
      setRecipeModalError(null);
      try {
        const payload =
          "stock_item_id" in ingredient
            ? { stock_item_id: ingredient.stock_item_id, size, quantity }
            : { preparation_id: ingredient.preparation_id, size, quantity };
        const item = await apiPost<PizzaRecipeItem>(
          `/api/pizzas/${recipeModalPizza.id}/recipes/${recipeModalRecipe.id}/items`,
          payload,
        );
        setRecipeModalItems((prev) => [...prev, item]);
      } catch (e) {
        setRecipeModalError(
          e instanceof Error ? e.message : "Erro ao adicionar ingrediente",
        );
      }
    },
    [recipeModalPizza, recipeModalRecipe],
  );

  const updateRecipeItem = useCallback(
    async (
      itemId: string,
      patch: { quantity?: number; waste_factor?: number | null },
    ) => {
      if (!recipeModalPizza || !recipeModalRecipe) return;
      setRecipeModalError(null);
      try {
        const updated = await apiPut<PizzaRecipeItem>(
          `/api/pizzas/${recipeModalPizza.id}/recipes/${recipeModalRecipe.id}/items/${itemId}`,
          patch,
        );
        setRecipeModalItems((prev) =>
          prev.map((i) => (i.id === itemId ? updated : i)),
        );
      } catch (e) {
        setRecipeModalError(
          e instanceof Error ? e.message : "Erro ao atualizar ingrediente",
        );
      }
    },
    [recipeModalPizza, recipeModalRecipe],
  );

  const deleteRecipeItem = useCallback(
    async (itemId: string) => {
      if (!recipeModalPizza || !recipeModalRecipe) return;
      setRecipeModalError(null);
      try {
        await apiDelete(
          `/api/pizzas/${recipeModalPizza.id}/recipes/${recipeModalRecipe.id}/items/${itemId}`,
        );
        setRecipeModalItems((prev) => prev.filter((i) => i.id !== itemId));
      } catch (e) {
        setRecipeModalError(
          e instanceof Error ? e.message : "Erro ao remover ingrediente",
        );
      }
    },
    [recipeModalPizza, recipeModalRecipe],
  );

  const stockItemName = (id: string) =>
    stockItems.find((s) => s.id === id)?.name ?? id;
  const stockItemUnit = (id: string) => {
    const s = stockItems.find((i) => i.id === id);
    if (!s) return "";
    return (
      (STOCK_BASE_UNIT_LABELS as Record<string, string>)[s.base_unit] ??
      String(s.base_unit)
    );
  };

  const sortedPizzas = useMemo(
    () =>
      [...pizzas].sort(
        (a, b) =>
          PIZZA_CATEGORY_ORDER[a.category] - PIZZA_CATEGORY_ORDER[b.category],
      ),
    [pizzas],
  );

  // =========================================================================
  // Preparations callbacks
  // =========================================================================
  const loadPreparations = useCallback(async () => {
    setPrepLoading(true);
    setPrepError(null);
    try {
      const list = await apiGet<Preparation[]>("/api/preparations");
      setPreparations(Array.isArray(list) ? list : []);
    } catch (e) {
      setPrepError(
        e instanceof Error ? e.message : "Erro ao carregar preparos",
      );
      setPreparations([]);
    } finally {
      setPrepLoading(false);
    }
  }, []);

  const openPrepFormCreate = useCallback(() => {
    setEditingPrep(null);
    setPrepForm({ name: "", description: "", yield_unit: "g", use_as_unit: false });
    setPrepFormError(null);
    setPrepFormOpen(true);
  }, []);

  const openPrepFormEdit = useCallback((prep: Preparation) => {
    setEditingPrep(prep);
    setPrepForm({
      name: prep.name,
      description: prep.description ?? "",
      yield_unit: prep.yield_unit,
      use_as_unit: prep.use_as_unit,
    });
    setPrepFormError(null);
    setPrepFormOpen(true);
  }, []);

  const openPrepDetail = useCallback(
    async (prep: Preparation) => {
      setPrepDetailPrep(prep);
      setPrepDetailError(null);
      setPrepDetailLoading(true);
      try {
        const [detail, stock] = await Promise.all([
          apiGet<Preparation & { items: PreparationItem[] }>(
            `/api/preparations/${prep.id}`,
          ),
          stockItems.length === 0
            ? apiGet<StockItem[]>("/api/stock/items")
            : Promise.resolve(null),
        ]);
        if (stock) setStockItems(Array.isArray(stock) ? stock : []);
        setPrepDetailItems(Array.isArray(detail.items) ? detail.items : []);
      } catch (e) {
        setPrepDetailError(
          e instanceof Error ? e.message : "Erro ao carregar ingredientes",
        );
        setPrepDetailItems([]);
      } finally {
        setPrepDetailLoading(false);
      }
    },
    [stockItems.length],
  );

  const submitPrepForm = useCallback(async () => {
    const name = prepForm.name.trim();
    const yield_unit = prepForm.yield_unit.trim();
    if (!name) {
      setPrepFormError("Nome é obrigatório.");
      return;
    }
    if (!yield_unit) {
      setPrepFormError("Unidade de rendimento é obrigatória.");
      return;
    }
    setPrepFormError(null);
    setPrepFormSaving(true);
    try {
      const body = {
        name,
        description: prepForm.description.trim() || null,
        yield_unit,
        use_as_unit: prepForm.use_as_unit,
      };
      if (editingPrep) {
        const updated = await apiPut<Preparation>(
          `/api/preparations/${editingPrep.id}`,
          { ...body, yield_qty: editingPrep.yield_qty },
        );
        setPreparations((prev) =>
          prev.map((p) => (p.id === editingPrep.id ? updated : p)),
        );
        setPrepFormOpen(false);
      } else {
        const created = await apiPost<Preparation>("/api/preparations", {
          ...body,
          yield_qty: 0.001,
        });
        setPreparations((prev) => [...prev, created]);
        setPrepFormOpen(false);
        openPrepDetail(created);
      }
    } catch (e) {
      setPrepFormError(
        e instanceof Error ? e.message : "Erro ao guardar preparo",
      );
    } finally {
      setPrepFormSaving(false);
    }
  }, [prepForm, editingPrep, openPrepDetail]);

  const deletePreparation = useCallback(async (id: string) => {
    if (!confirm("Apagar este preparo? Esta ação não pode ser revertida."))
      return;
    try {
      await apiDelete(`/api/preparations/${id}`);
      setPreparations((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setPrepError(e instanceof Error ? e.message : "Erro ao apagar preparo");
    }
  }, []);

  const closePrepDetail = useCallback(async () => {
    if (prepDetailPrep && prepDetailItems.length > 0) {
      const total = prepDetailItems.reduce((sum, i) => sum + i.quantity, 0);
      try {
        const updated = await apiPut<Preparation>(
          `/api/preparations/${prepDetailPrep.id}`,
          {
            name: prepDetailPrep.name,
            description: prepDetailPrep.description,
            yield_qty: total,
            yield_unit: prepDetailPrep.yield_unit,
            use_as_unit: prepDetailPrep.use_as_unit,
          },
        );
        setPreparations((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p)),
        );
      } catch {
        // não crítico — o yield_qty será recalculado na próxima abertura
      }
    }
    setPrepDetailPrep(null);
    setPrepDetailItems([]);
    setPrepDetailError(null);
  }, [prepDetailPrep, prepDetailItems]);

  const addPrepItem = useCallback(
    async (stockItemId: string, quantity: number) => {
      if (!prepDetailPrep) return;
      setPrepDetailError(null);
      try {
        const item = await apiPost<PreparationItem>(
          `/api/preparations/${prepDetailPrep.id}/items`,
          { stock_item_id: stockItemId, quantity },
        );
        setPrepDetailItems((prev) => [...prev, item]);
      } catch (e) {
        setPrepDetailError(
          e instanceof Error ? e.message : "Erro ao adicionar ingrediente",
        );
      }
    },
    [prepDetailPrep],
  );

  const updatePrepItem = useCallback(
    async (itemId: string, quantity: number) => {
      if (!prepDetailPrep) return;
      setPrepDetailError(null);
      try {
        const updated = await apiPut<PreparationItem>(
          `/api/preparations/${prepDetailPrep.id}/items/${itemId}`,
          { quantity },
        );
        setPrepDetailItems((prev) =>
          prev.map((i) => (i.id === itemId ? updated : i)),
        );
      } catch (e) {
        setPrepDetailError(
          e instanceof Error ? e.message : "Erro ao atualizar ingrediente",
        );
      }
    },
    [prepDetailPrep],
  );

  const deletePrepItem = useCallback(
    async (itemId: string) => {
      if (!prepDetailPrep) return;
      setPrepDetailError(null);
      try {
        await apiDelete(
          `/api/preparations/${prepDetailPrep.id}/items/${itemId}`,
        );
        setPrepDetailItems((prev) => prev.filter((i) => i.id !== itemId));
      } catch (e) {
        setPrepDetailError(
          e instanceof Error ? e.message : "Erro ao remover ingrediente",
        );
      }
    },
    [prepDetailPrep],
  );

  // =========================================================================
  // Effects
  // =========================================================================
  useEffect(() => {
    loadPizzas();
  }, [loadPizzas]);
  useEffect(() => {
    loadPreparations();
  }, [loadPreparations]);

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div className="mx-auto max-w-6xl space-y-10 p-6">
      {/* ------------------------------------------------------------------ */}
      {/* Pizzas section                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section>
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

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              Categoria
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {(
                Object.entries(PIZZA_CATEGORY_LABELS) as [
                  PizzaCategory,
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
                  <th className="w-28 px-4 py-3 text-center font-medium">
                    Ações
                  </th>
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
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${pizza.is_active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}
                      >
                        {pizza.is_active ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => openRecipeModal(pizza)}
                        className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
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
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Preparos section                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Preparos</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Sub-receitas usadas como ingredientes nas pizzas. O stock é
              descontado proporcionalmente ao rendimento.
            </p>
          </div>
          <button
            type="button"
            onClick={openPrepFormCreate}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Novo preparo
          </button>
        </div>

        {prepError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {prepError}
          </div>
        )}

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {prepLoading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              A carregar…
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-slate-600">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Rendimento</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 text-center font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {preparations.map((prep) => (
                  <tr
                    key={prep.id}
                    className="border-t border-slate-100 hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-2 font-medium text-slate-800">
                      {prep.name}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-slate-700">
                      {formatNumber(prep.yield_qty)} {prep.yield_unit}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {prep.description ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openPrepDetail(prep)}
                          className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                        >
                          Ingredientes
                        </button>
                        <button
                          type="button"
                          onClick={() => openPrepFormEdit(prep)}
                          className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePreparation(prep.id)}
                          className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Apagar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {preparations.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      Nenhum preparo. Crie o primeiro acima.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Modals                                                               */}
      {/* ------------------------------------------------------------------ */}
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
          preparations={preparations}
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

      {prepFormOpen && (
        <PreparationFormModal
          editing={editingPrep}
          form={prepForm}
          setForm={setPrepForm}
          error={prepFormError}
          saving={prepFormSaving}
          onSubmit={submitPrepForm}
          onClose={() => setPrepFormOpen(false)}
        />
      )}

      {prepDetailPrep && (
        <PreparationDetailModal
          preparation={prepDetailPrep}
          items={prepDetailItems}
          stockItems={stockItems}
          loading={prepDetailLoading}
          error={prepDetailError}
          stockItemName={stockItemName}
          stockItemUnit={stockItemUnit}
          onClose={closePrepDetail}
          onAddItem={addPrepItem}
          onUpdateItem={updatePrepItem}
          onDeleteItem={deletePrepItem}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CreatePizzaModal
// ---------------------------------------------------------------------------
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
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h3 className="text-base font-semibold text-slate-800">Nova pizza</h3>
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
                  string,
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

// ---------------------------------------------------------------------------
// PreparationFormModal — create / edit
// ---------------------------------------------------------------------------
function PreparationFormModal({
  editing,
  form,
  setForm,
  error,
  saving,
  onSubmit,
  onClose,
}: {
  editing: Preparation | null;
  form: {
    name: string;
    description: string;
    yield_unit: string;
    use_as_unit: boolean;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      description: string;
      yield_unit: string;
      use_as_unit: boolean;
    }>
  >;
  error: string | null;
  saving: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h3 className="text-base font-semibold text-slate-800">
          {editing ? "Editar preparo" : "Novo preparo"}
        </h3>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Nome *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
              placeholder="Ex: Pesto"
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
          <div className="w-28">
            <label className="mb-1 block text-xs text-slate-500">
              Unidade dos ingredientes *
            </label>
            <select
              value={form.yield_unit}
              onChange={(e) =>
                setForm((f) => ({ ...f, yield_unit: e.target.value }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            >
              {YIELD_UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="prep-use-as-unit"
              checked={form.use_as_unit}
              onChange={(e) =>
                setForm((f) => ({ ...f, use_as_unit: e.target.checked }))
              }
            />
            <label htmlFor="prep-use-as-unit" className="text-sm text-slate-600">
              Usar como unidade nas receitas
            </label>
          </div>
          <p className="text-[11px] text-slate-500">
            {form.use_as_unit
              ? "Este preparo aparecerá nas receitas em unidades (un). Ex: 1 un = receita completa, 0.5 un = meia receita."
              : `Este preparo aparecerá nas receitas em ${form.yield_unit}. O rendimento será calculado pela soma dos ingredientes.`}
          </p>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "A guardar…" : editing ? "Guardar" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PreparationDetailModal — manage ingredients of a preparo
// ---------------------------------------------------------------------------
function PreparationDetailModal({
  preparation,
  items,
  stockItems,
  loading,
  error,
  stockItemName,
  stockItemUnit,
  onClose,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
}: {
  preparation: Preparation;
  items: PreparationItem[];
  stockItems: StockItem[];
  loading: boolean;
  error: string | null;
  stockItemName: (id: string) => string;
  stockItemUnit: (id: string) => string;
  onClose: () => void;
  onAddItem: (stockItemId: string, quantity: number) => void;
  onUpdateItem: (itemId: string, quantity: number) => void;
  onDeleteItem: (itemId: string) => void;
}) {
  const [addStockId, setAddStockId] = useState("");
  const [addQty, setAddQty] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");

  const handleAdd = () => {
    const q = Number(addQty) || 0;
    if (!addStockId || q <= 0) return;
    onAddItem(addStockId, q);
    setAddStockId("");
    setAddQty("");
  };

  const startEdit = (item: PreparationItem) => {
    setEditingItemId(item.id);
    setEditQty(String(item.quantity));
  };

  const saveEdit = (item: PreparationItem) => {
    const q = Number(editQty) || 0;
    if (q > 0) onUpdateItem(item.id, q);
    else onDeleteItem(item.id);
    setEditingItemId(null);
  };

  // Filter out already-added stock items from dropdown
  const usedIds = new Set(items.map((i) => i.stock_item_id));
  const availableStock = stockItems.filter((s) => !usedIds.has(s.id));

  const computedTotal = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800">
              Ingredientes — {preparation.name}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Rendimento calculado:{" "}
              <span className="font-medium text-slate-700">
                {formatNumber(computedTotal)} {preparation.yield_unit}
              </span>
            </p>
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
          ) : (
            <>
              {/* Add ingredient */}
              <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex-1 min-w-[160px]">
                  <label className="mb-1 block text-xs text-slate-500">
                    Ingrediente
                  </label>
                  <select
                    value={addStockId}
                    onChange={(e) => setAddStockId(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Selecionar</option>
                    {availableStock.map((s) => (
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
                    Quantidade ({preparation.yield_unit})
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
                      <th className="px-4 py-2 text-right font-medium">
                        Quantidade ({preparation.yield_unit})
                      </th>
                      <th className="w-28 px-4 py-2 text-center font-medium">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const isEditing = editingItemId === item.id;
                      const unit = stockItemUnit(item.stock_item_id);
                      return (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-4 py-2 text-slate-800">
                            {stockItemName(item.stock_item_id)}{" "}
                            <span className="text-slate-500">({unit})</span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                value={editQty}
                                onChange={(e) => setEditQty(e.target.value)}
                                className="w-20 rounded border px-2 py-1 text-sm text-right"
                              />
                            ) : (
                              <span className="tabular-nums">
                                {formatNumber(item.quantity)} {unit}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {isEditing ? (
                              <div className="flex justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveEdit(item)}
                                  className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                                >
                                  Ok
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingItemId(null)}
                                  className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEdit(item)}
                                  className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteItem(item.id)}
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
                    {items.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
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

// ---------------------------------------------------------------------------
// RecipeModal — recipe items can be stock items OR preparations
// ---------------------------------------------------------------------------
type GroupedRow = {
  key: string; // "stock:<uuid>" | "prep:<uuid>"
  type: "stock" | "prep";
  entity_id: string;
  small: PizzaRecipeItem | null;
  large: PizzaRecipeItem | null;
};

type RecipeModalProps = {
  pizza: Pizza;
  recipe: PizzaRecipe | null;
  items: PizzaRecipeItem[];
  stockItems: StockItem[];
  preparations: Preparation[];
  loading: boolean;
  error: string | null;
  stockItemName: (id: string) => string;
  stockItemUnit: (id: string) => string;
  onClose: () => void;
  onCreateRecipe: () => void;
  onAddItem: (
    ingredient: RecipeIngredientRef,
    size: PizzaSize,
    quantity: number,
  ) => void;
  onUpdateItem: (
    itemId: string,
    patch: { quantity?: number; waste_factor?: number | null },
  ) => void;
  onDeleteItem: (itemId: string) => void;
};

function RecipeModal({
  pizza,
  recipe,
  items,
  stockItems,
  preparations,
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
  const [addKey, setAddKey] = useState(""); // "stock:<id>" | "prep:<id>"
  const [addSize, setAddSize] = useState<PizzaSize>("small");
  const [addQty, setAddQty] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editSmallQty, setEditSmallQty] = useState("");
  const [editLargeQty, setEditLargeQty] = useState("");

  const groupedRows = useMemo<GroupedRow[]>(() => {
    const map = new Map<
      string,
      { small: PizzaRecipeItem | null; large: PizzaRecipeItem | null }
    >();
    for (const item of items) {
      const key = item.stock_item_id
        ? `stock:${item.stock_item_id}`
        : `prep:${item.preparation_id!}`;
      if (!map.has(key)) map.set(key, { small: null, large: null });
      const row = map.get(key)!;
      if (item.size === "small") row.small = item;
      else row.large = item;
    }
    return Array.from(map.entries())
      .map(([key, { small, large }]): GroupedRow => ({
        key,
        type: key.startsWith("stock:") ? "stock" : "prep",
        entity_id: key.startsWith("stock:") ? key.slice(6) : key.slice(5),
        small,
        large,
      }))
      .sort((a, b) => {
        if (a.type === b.type) return 0;
        return a.type === "prep" ? -1 : 1;
      });
  }, [items]);

  const rowLabel = (row: GroupedRow) =>
    row.type === "stock"
      ? stockItemName(row.entity_id)
      : (preparations.find((p) => p.id === row.entity_id)?.name ??
        row.entity_id);

  const rowUnit = (row: GroupedRow) => {
    if (row.type === "stock") return stockItemUnit(row.entity_id);
    const prep = preparations.find((p) => p.id === row.entity_id);
    return prep?.use_as_unit ? "un" : (prep?.yield_unit ?? "");
  };

  const handleAdd = () => {
    const q = Number(addQty) || 0;
    if (!addKey || q <= 0) return;
    const ingredient: RecipeIngredientRef = addKey.startsWith("stock:")
      ? { stock_item_id: addKey.slice(6) }
      : { preparation_id: addKey.slice(5) };
    onAddItem(ingredient, addSize, q);
    setAddKey("");
    setAddQty("");
  };

  const startEdit = (row: GroupedRow) => {
    setEditingKey(row.key);
    setEditSmallQty(row.small ? String(row.small.quantity) : "");
    setEditLargeQty(row.large ? String(row.large.quantity) : "");
  };

  const saveEdit = () => {
    if (!editingKey) return;
    const row = groupedRows.find((r) => r.key === editingKey);
    if (!row) return;
    const smallQty = Number(editSmallQty) || 0;
    const largeQty = Number(editLargeQty) || 0;
    const ingredient: RecipeIngredientRef =
      row.type === "stock"
        ? { stock_item_id: row.entity_id }
        : { preparation_id: row.entity_id };

    if (row.small) {
      if (smallQty > 0) onUpdateItem(row.small.id, { quantity: smallQty });
      else onDeleteItem(row.small.id);
    } else if (smallQty > 0) {
      onAddItem(ingredient, "small", smallQty);
    }

    if (row.large) {
      if (largeQty > 0) onUpdateItem(row.large.id, { quantity: largeQty });
      else onDeleteItem(row.large.id);
    } else if (largeQty > 0) {
      onAddItem(ingredient, "large", largeQty);
    }

    setEditingKey(null);
  };

  const deleteRow = (row: GroupedRow) => {
    if (row.small) onDeleteItem(row.small.id);
    if (row.large) onDeleteItem(row.large.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800">
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
                <div className="flex-1 min-w-[180px]">
                  <label className="mb-1 block text-xs text-slate-500">
                    Ingrediente
                  </label>
                  <select
                    value={addKey}
                    onChange={(e) => setAddKey(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Selecionar</option>
                    {stockItems.length > 0 && (
                      <optgroup label="Ingredientes de stock">
                        {stockItems.map((s) => (
                          <option key={s.id} value={`stock:${s.id}`}>
                            {s.name} (
                            {(STOCK_BASE_UNIT_LABELS as Record<string, string>)[
                              s.base_unit as StockBaseUnit
                            ] ?? s.base_unit}
                            )
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {preparations.length > 0 && (
                      <optgroup label="Preparos">
                        {preparations.map((p) => (
                          <option key={p.id} value={`prep:${p.id}`}>
                            {p.name} ({p.yield_unit})
                          </option>
                        ))}
                      </optgroup>
                    )}
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
                      <th className="px-4 py-2 text-right font-medium">
                        Pequena
                      </th>
                      <th className="px-4 py-2 text-right font-medium">
                        Grande
                      </th>
                      <th className="w-28 px-4 py-2 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedRows.map((row) => {
                      const isEditing = editingKey === row.key;
                      const unit = rowUnit(row);
                      const label = rowLabel(row);
                      return (
                        <tr key={row.key} className="border-t border-slate-100">
                          <td className="px-4 py-2 text-slate-800">
                            {label}{" "}
                            <span className="text-slate-500">({unit})</span>
                            {row.type === "prep" && (
                              <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-800">
                                Preparo
                              </span>
                            )}
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
                                className="w-20 rounded border px-2 py-1 text-right text-sm"
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
                                className="w-20 rounded border px-2 py-1 text-right text-sm"
                              />
                            ) : row.large ? (
                              <span className="tabular-nums">
                                {formatNumber(row.large.quantity)} {unit}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {isEditing ? (
                              <div className="flex justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={saveEdit}
                                  className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                                >
                                  Ok
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingKey(null)}
                                  className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-center gap-1">
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
