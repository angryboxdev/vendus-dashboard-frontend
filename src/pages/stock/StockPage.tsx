import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NumericInput } from "../../components/NumericInput.tsx";

import { apiGet, apiPost, apiPut } from "../../lib/api";
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
} from "./stock.types";
import { LocationSelect } from "../../components/LocationSelect.tsx";
import { useLocations } from "../../modules/locations/adapters/in/use-locations.ts";
import { resolveLocationId } from "../../modules/locations/domain/services/resolve-location-id.ts";
import { ReferenceCostField, formatPerPricingUnit } from "./ReferenceCostField.tsx";
import { RecipeCostingProvider } from "../../modules/recipe-costing/recipe-costing.module.tsx";
import { IngredientPriceHistory } from "../../modules/recipe-costing/adapters/in/IngredientPriceHistory.tsx";
import { StockPurchaseReviewProvider } from "../../modules/stock-purchase-review/stock-purchase-review.module.tsx";
import { EntryRulesModal } from "../../modules/stock-purchase-review/adapters/in/EntryRulesModal.tsx";
import type { StockPurchaseReviewRowDTO } from "../../modules/stock-purchase-review/domain/entities/stock-purchase-review.ts";
import { OPEN_STOCK_PURCHASE_REVIEW_STATUSES } from "../../modules/stock-purchase-review/domain/entities/stock-purchase-review.ts";
import { StockCatalogProvider } from "../../modules/stock-catalog/stock-catalog.module.tsx";
import { ArticlesView } from "../../modules/stock-catalog/adapters/in/ArticlesView.tsx";
import { useAuth } from "../../contexts/AuthContext";

const DEFAULT_CATEGORY_NAME = "Geral";

const EMPTY_NEW_ITEM: StockItemCreateBody = {
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
};

/**
 * «Artigos e ingredientes» (task V6): a lista é a tabela única do módulo `stock-catalog` (Geral,
 * Reposição, Custos + painel lateral); esta página só junta as ações e os formulários existentes
 * (Novo artigo, Editar, Regras de entrada). O importador antigo do Stock foi desligado: a entrada de
 * faturas faz-se pelas Compras por rever.
 */
export function StockPage() {
  const { locations } = useLocations();
  const { user } = useAuth();
  const access = user?.access;
  // Sem perfil carregado mantém o comportamento anterior; com perfil, editar exige MANAGE.
  const canManage = !access || access.isAdmin || access.permissions["stock.items"] === "MANAGE";

  const [categories, setCategories] = useState<StockCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [editForm, setEditForm] = useState<StockItemUpdateBody>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const [newItemModalOpen, setNewItemModalOpen] = useState(false);
  const [newItemMovementDate, setNewItemMovementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newItemForm, setNewItemForm] = useState<StockItemCreateBody>(EMPTY_NEW_ITEM);
  const [newItemInitialQty, setNewItemInitialQty] = useState<number>(0);
  const [newItemLocationId, setNewItemLocationId] = useState<string | null>(null);
  const [newItemError, setNewItemError] = useState<string | null>(null);

  const [entryRulesOpen, setEntryRulesOpen] = useState(false);
  const navigate = useNavigate();

  // Contagem de «Compras por rever» ainda não terminais, para o botão do cabeçalho.
  const [openReviewsCount, setOpenReviewsCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    apiGet<StockPurchaseReviewRowDTO[]>("/api/stock-purchase-reviews")
      .then((rows) => {
        if (!cancelled) setOpenReviewsCount(rows.filter((r) => OPEN_STOCK_PURCHASE_REVIEW_STATUSES.includes(r.status)).length);
      })
      .catch(() => {
        if (!cancelled) setOpenReviewsCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Categorias para os formulários; sem nenhuma, cria a «Geral» para o primeiro artigo ter onde ficar.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let list = await apiGet<StockCategory[]>("/api/stock/categories");
      if (!Array.isArray(list) || list.length === 0) {
        await apiPost<StockCategory>("/api/stock/categories", { name: DEFAULT_CATEGORY_NAME });
        list = await apiGet<StockCategory[]>("/api/stock/categories");
      }
      if (!cancelled) setCategories(Array.isArray(list) ? list : []);
    })().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar categorias");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openEdit = useCallback(async (id: string) => {
    setSaveError(null);
    try {
      const item = await apiGet<StockItem>(`/api/stock/items/${id}`);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível abrir o artigo");
    }
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
      setReloadKey((k) => k + 1);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erro ao guardar");
    }
  }, [editItem, editForm, closeEdit]);

  const submitNewItem = useCallback(async () => {
    setNewItemError(null);
    const name = newItemForm.name.trim();
    if (!name || !newItemForm.category_id) {
      setNewItemError("Nome e categoria são obrigatórios.");
      return;
    }
    // Resolve antes de criar o artigo: o movimento abaixo precisa dela, e falhar depois de o artigo
    // existir deixaria um artigo sem o movimento da quantidade inicial.
    const locationId = newItemInitialQty !== 0 ? resolveLocationId(newItemLocationId, locations) : null;
    if (newItemInitialQty !== 0 && !locationId) {
      setNewItemError("Selecione uma loja.");
      return;
    }
    try {
      const created = await apiPost<StockItem>("/api/stock/items", newItemForm);
      if (newItemInitialQty !== 0 && locationId) {
        const movementDateIso = newItemMovementDate ? new Date(newItemMovementDate + "T12:00:00").toISOString() : undefined;
        await apiPost("/api/stock/movements", {
          item_id: created.id,
          type: "adjustment" as StockMovementType,
          quantity: newItemInitialQty,
          movement_date: movementDateIso,
          location_id: locationId,
        } satisfies StockMovementCreateBody);
      }
      setNewItemModalOpen(false);
      setNewItemForm({ ...EMPTY_NEW_ITEM, category_id: categories[0]?.id ?? "" });
      setNewItemInitialQty(0);
      setNewItemLocationId(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      setNewItemError(e instanceof Error ? e.message : "Erro ao criar item");
    }
  }, [newItemForm, newItemInitialQty, newItemLocationId, locations, newItemMovementDate, categories]);

  const openNewItemModal = useCallback(() => {
    setNewItemModalOpen(true);
    setNewItemError(null);
    setNewItemMovementDate(new Date().toISOString().slice(0, 10));
    if (categories.length > 0) setNewItemForm((f) => ({ ...f, category_id: categories[0]!.id }));
  }, [categories]);

  return (
    <>
      {error && <p className="mx-auto mt-4 max-w-7xl rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <StockCatalogProvider>
        <ArticlesView
          canManage={canManage}
          reloadKey={reloadKey}
          onEdit={(item) => void openEdit(item.id)}
          renderPriceHistory={(id) => (
            <RecipeCostingProvider>
              <IngredientPriceHistory stockItemId={id} />
            </RecipeCostingProvider>
          )}
          headerActions={
            <>
              <button
                type="button"
                onClick={() => setEntryRulesOpen(true)}
                aria-label="Regras de entrada no Stock"
                title="Regras de entrada no Stock (por tipo de artigo) e localização principal"
                className="rounded-md p-2 text-ink-muted hover:bg-surface-soft hover:text-ink"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => navigate("/stock/compras-por-rever")}
                className="rounded-md border border-line bg-surface-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-soft"
              >
                Compras por rever{openReviewsCount > 0 ? ` (${openReviewsCount})` : ""}
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={openNewItemModal}
                  disabled={categories.length === 0}
                  className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  Novo artigo
                </button>
              )}
            </>
          }
        />
      </StockCatalogProvider>

      {entryRulesOpen && (
        <StockPurchaseReviewProvider>
          <EntryRulesModal onClose={() => setEntryRulesOpen(false)} />
        </StockPurchaseReviewProvider>
      )}

      {newItemModalOpen && (
        <NewItemModal
          form={newItemForm}
          setForm={setNewItemForm}
          initialQty={newItemInitialQty}
          setInitialQty={setNewItemInitialQty}
          movementDate={newItemMovementDate}
          setMovementDate={setNewItemMovementDate}
          locationId={newItemLocationId}
          setLocationId={setNewItemLocationId}
          categories={categories}
          error={newItemError}
          onSubmit={submitNewItem}
          onClose={() => setNewItemModalOpen(false)}
        />
      )}

      {editItem && (
        <StockEditModal item={editItem} form={editForm} setForm={setEditForm} categories={categories} error={saveError} onSave={saveEdit} onClose={closeEdit} />
      )}
    </>
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
  // A unidade é a régua do stock, das compras e das receitas: fixa depois do primeiro uso (o servidor
  // também recusa). Sinal no ecrã: stock atual ou custo de compra já registados.
  const unitLocked =
    (item.current_quantity ?? 0) !== 0 ||
    (item.last_purchase_unit_cost_without_vat ?? 0) > 0 ||
    (item.last_purchase_unit_cost_with_vat ?? 0) > 0;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-edit-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
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
              Stock mínimo
            </label>
            <NumericInput
              decimals={3}
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
              disabled={unitLocked}
              title={unitLocked ? "A unidade fica fixa depois do primeiro movimento ou compra" : undefined}
              value={form.base_unit ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  base_unit: e.target.value as StockBaseUnit,
                }))
              }
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
            >
              {(
                Object.entries(STOCK_BASE_UNIT_LABELS) as [
                  StockBaseUnit,
                  string,
                ][]
              ).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            {unitLocked && (
              <p className="mt-1 text-[11px] text-slate-500">
                Fixa: o artigo já tem stock ou compras nesta unidade. Os preços aparecem por kg/l e as faturas em kg convertem-se sozinhas.
              </p>
            )}
          </div>
          <ReferenceCostField
            label="Custo de referência c/ IVA"
            baseUnit={form.base_unit ?? item.base_unit}
            value={form.purchase_reference_unit_cost_with_vat ?? null}
            onChange={(v) => setForm((f) => ({ ...f, purchase_reference_unit_cost_with_vat: v }))}
          />
          <ReferenceCostField
            label="Custo de referência s/ IVA"
            baseUnit={form.base_unit ?? item.base_unit}
            value={form.purchase_reference_unit_cost_without_vat ?? null}
            onChange={(v) => setForm((f) => ({ ...f, purchase_reference_unit_cost_without_vat: v }))}
          />
          {((item.last_purchase_unit_cost_with_vat != null &&
            item.last_purchase_unit_cost_with_vat > 0) ||
            (item.last_purchase_unit_cost_without_vat != null &&
              item.last_purchase_unit_cost_without_vat > 0)) && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">
                Último custo de compra (só leitura — prevalece sobre o custo de
                referência; atualiza a cada fatura importada)
              </label>
              <p className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {item.last_purchase_unit_cost_with_vat != null &&
                  item.last_purchase_unit_cost_with_vat > 0 && (
                    <>
                      c/ IVA: {formatPerPricingUnit(item.last_purchase_unit_cost_with_vat, item.base_unit)}
                    </>
                  )}
                {item.last_purchase_unit_cost_with_vat != null &&
                  item.last_purchase_unit_cost_with_vat > 0 &&
                  item.last_purchase_unit_cost_without_vat != null &&
                  item.last_purchase_unit_cost_without_vat > 0 &&
                  " · "}
                {item.last_purchase_unit_cost_without_vat != null &&
                  item.last_purchase_unit_cost_without_vat > 0 && (
                    <>
                      s/ IVA:{" "}
                      {formatPerPricingUnit(item.last_purchase_unit_cost_without_vat, item.base_unit)}
                    </>
                  )}
              </p>
            </div>
          )}
          {/* Evolução semanal do preço de compra (task V5 §5.3). */}
          <RecipeCostingProvider>
            <IngredientPriceHistory stockItemId={item.id} />
          </RecipeCostingProvider>
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
              <NumericInput
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

function NewItemModal({
  title,
  form,
  setForm,
  initialQty,
  setInitialQty,
  movementDate,
  setMovementDate,
  locationId,
  setLocationId,
  categories,
  error,
  onSubmit,
  onClose,
}: {
  title?: string;
  form: StockItemCreateBody;
  setForm: React.Dispatch<React.SetStateAction<StockItemCreateBody>>;
  initialQty: number;
  setInitialQty: (n: number) => void;
  movementDate: string;
  setMovementDate: (v: string) => void;
  locationId: string | null;
  setLocationId: (v: string | null) => void;
  categories: StockCategory[];
  error: string | null;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-item-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h3
          id="new-item-title"
          className="text-base font-semibold text-slate-800"
        >
          {title ?? "Novo item"}
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
              Stock mínimo
            </label>
            <NumericInput
              decimals={3}
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
          <ReferenceCostField
            label="Custo de referência c/ IVA"
            baseUnit={form.base_unit}
            value={form.purchase_reference_unit_cost_with_vat ?? null}
            onChange={(v) => setForm((f) => ({ ...f, purchase_reference_unit_cost_with_vat: v }))}
          />
          <ReferenceCostField
            label="Custo de referência s/ IVA"
            baseUnit={form.base_unit}
            value={form.purchase_reference_unit_cost_without_vat ?? null}
            onChange={(v) => setForm((f) => ({ ...f, purchase_reference_unit_cost_without_vat: v }))}
          />
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
              <NumericInput
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
            <NumericInput
              decimals={3}
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
          {initialQty !== 0 && (
            /* Loja onde o movimento ocorreu — só aparece com mais de uma location */
            <LocationSelect
              value={locationId}
              onChange={setLocationId}
              label="Loja"
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
            />
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
