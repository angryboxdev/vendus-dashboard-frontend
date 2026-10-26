import { useCallback, useEffect, useMemo, useState } from "react";
import type { DishCostingDTO, IngredientCostDTO } from "../../domain/entities/recipe-costing.ts";
import {
  DISH_CATEGORY_LABELS,
  VARIANT_LABELS,
  type ComponentRef,
  type DishCategory,
  type DishDTO,
  type DishPriceDTO,
  type PreparationDTO,
  type RecipeDTO,
  type RecipeItemDTO,
  type StockItemOptionDTO,
  type Variant,
} from "../../domain/entities/technical-sheets.ts";
import { allowsXs, compositionRows, dishVariants, planRowChanges, xsQuantity, type CompositionRow, type ItemChange } from "../../domain/services/variants.ts";
import { useRecipeCostingModule } from "../../recipe-costing.module.tsx";
import { DishWeeklyCost } from "./DishWeeklyCost.tsx";
import { Pill, Section, SheetDrawer } from "./sheet-ui.tsx";
import { btnCls, eur, eurCost, inputCls, parseNum, pct, primaryBtnCls, qty } from "./sheet-format.ts";

type Tab = "composition" | "costs" | "history";
const TABS: { key: Tab; label: string }[] = [
  { key: "composition", label: "Composição" },
  { key: "costs", label: "Custos" },
  { key: "history", label: "Histórico" },
];
const SOURCE: Record<string, [string, "ok" | "warn" | "bad" | "neutral"]> = {
  invoice: ["Compra confirmada", "ok"],
  manual: ["Referência manual", "warn"],
  none: ["Sem custo conhecido", "bad"],
};

/**
 * Painel de um prato (Fichas técnicas V7): composição por variante (grava pelo fluxo existente de
 * linhas da receita, que gera versão), custos e margem por variante, e o histórico semanal.
 */
export function DishPanel({
  dish,
  costing,
  ingredients,
  salesVatRate,
  preparations,
  stockItems,
  canManage,
  onClose,
  onChanged,
  onOpenArticle,
  onOpenPreparation,
}: {
  dish: DishDTO;
  costing: DishCostingDTO | null;
  ingredients: IngredientCostDTO[];
  salesVatRate: number;
  preparations: PreparationDTO[];
  stockItems: StockItemOptionDTO[];
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
  onOpenArticle: (stockItemId: string) => void;
  onOpenPreparation: (preparationId: string) => void;
}) {
  const { sheets } = useRecipeCostingModule();
  const [tab, setTab] = useState<Tab>("composition");
  const [recipe, setRecipe] = useState<{ recipe: RecipeDTO; items: RecipeItemDTO[] } | null | undefined>(undefined);
  const [prices, setPrices] = useState<DishPriceDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!sheets) return;
    try {
      const [r, p] = await Promise.all([sheets.getActiveRecipe(dish.id), sheets.listPrices(dish.id)]);
      setRecipe(r);
      setPrices(p);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível abrir a ficha.");
    }
  }, [sheets, dish.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => recipe?.items ?? [], [recipe]);
  const variants = dishVariants(items, prices.map((p) => p.size));
  const xsFollowsSmall = allowsXs(dish.category) && variants.includes("xs");
  const rows = useMemo(() => compositionRows(items), [items]);
  const costById = useMemo(() => new Map(ingredients.map((i) => [i.stockItemId, i])), [ingredients]);
  const nameOf = (row: { kind: "stock" | "preparation"; entityId: string }) =>
    row.kind === "stock" ? (stockItems.find((s) => s.id === row.entityId)?.name ?? "Artigo removido") : (preparations.find((p) => p.id === row.entityId)?.name ?? "Preparação removida");
  const unitOf = (row: { kind: "stock" | "preparation"; entityId: string }) => {
    if (row.kind === "stock") return stockItems.find((s) => s.id === row.entityId)?.base_unit ?? "";
    const p = preparations.find((x) => x.id === row.entityId);
    return p?.use_as_unit ? "un" : (p?.yield_unit ?? "");
  };

  /** Aplica alterações às linhas da receita, uma a uma (o backend versiona a ficha a cada escrita). */
  const apply = async (ref: ComponentRef, changes: ItemChange[]) => {
    if (!sheets || !recipe) return;
    for (const c of changes) {
      if (c.op === "add") await sheets.addRecipeItem(dish.id, recipe.recipe.id, ref, c.size, c.quantity);
      else if (c.op === "update") await sheets.updateRecipeItem(dish.id, recipe.recipe.id, c.itemId, c.quantity);
      else await sheets.deleteRecipeItem(dish.id, recipe.recipe.id, c.itemId);
    }
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível gravar.");
    } finally {
      setBusy(false);
    }
  };

  const addXsVariant = () =>
    run(async () => {
      if (!sheets || !recipe) return;
      for (const row of rows) {
        const small = row.bySize.small;
        if (small && !row.bySize.xs) await sheets.addRecipeItem(dish.id, recipe.recipe.id, row.ref, "xs", xsQuantity(small.quantity));
      }
    });

  const subtitle = (
    <>
      <span>{DISH_CATEGORY_LABELS[dish.category] ?? dish.category}</span>
      <span>{variants.map((v) => VARIANT_LABELS[v]).join(" · ")}</span>
      {!dish.is_active && <Pill tone="neutral">Inativo</Pill>}
    </>
  );

  return (
    <SheetDrawer
      title={dish.name}
      subtitle={subtitle}
      tabs={TABS}
      tab={tab}
      onTab={setTab}
      onClose={onClose}
      actions={canManage && !editing ? <button type="button" className={btnCls} onClick={() => setEditing(true)}>Editar</button> : undefined}
    >
      <div className="space-y-5">
        {editing && <DishEditForm dish={dish} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }} />}
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {recipe === undefined && !error && <p className="text-xs text-ink-muted">A carregar a ficha…</p>}

        {tab === "composition" && recipe !== undefined && (
          recipe === null ? (
            <div className="rounded-lg border border-dashed border-line p-4 text-center">
              <p className="text-sm text-ink-secondary">Este prato ainda não tem ficha técnica.</p>
              {canManage && (
                <button type="button" className={`${primaryBtnCls} mt-3`} disabled={busy} onClick={() => run(async () => { await sheets?.createRecipe(dish.id); })}>
                  Criar ficha técnica
                </button>
              )}
            </div>
          ) : (
            <Composition
              rows={rows}
              variants={variants}
              xsFollowsSmall={xsFollowsSmall}
              canManage={canManage}
              busy={busy}
              nameOf={nameOf}
              unitOf={unitOf}
              preparations={preparations}
              stockItems={stockItems}
              onOpenPreparation={onOpenPreparation}
              onSaveRow={(row, q) => run(() => apply(row.ref, planRowChanges(row, q, { xsFollowsSmall })))}
              onAdd={(ref, q) => run(() => apply(ref, planRowChanges({ bySize: {} }, q, { xsFollowsSmall })))}
              canAddXs={canManage && allowsXs(dish.category) && !variants.includes("xs") && rows.some((r) => r.bySize.small)}
              onAddXs={addXsVariant}
              version={recipe.recipe.version}
            />
          )
        )}

        {tab === "costs" && (
          <Costs
            dish={dish}
            costing={costing}
            prices={prices}
            variants={variants}
            costById={costById}
            salesVatRate={salesVatRate}
            canManage={canManage}
            busy={busy}
            onSavePrice={(size, price) => run(async () => { await sheets?.savePrice(dish.id, size, price, prices.find((p) => p.size === size) ?? null); })}
            onOpenArticle={onOpenArticle}
            onOpenPreparation={onOpenPreparation}
          />
        )}

        {tab === "history" && <DishWeeklyCost pizzaId={dish.id} />}
      </div>
    </SheetDrawer>
  );
}

function Composition({
  rows,
  variants,
  xsFollowsSmall,
  canManage,
  busy,
  nameOf,
  unitOf,
  preparations,
  stockItems,
  onOpenPreparation,
  onSaveRow,
  onAdd,
  canAddXs,
  onAddXs,
  version,
}: {
  rows: CompositionRow[];
  variants: Variant[];
  xsFollowsSmall: boolean;
  canManage: boolean;
  busy: boolean;
  nameOf: (row: CompositionRow) => string;
  unitOf: (row: { kind: "stock" | "preparation"; entityId: string }) => string;
  preparations: PreparationDTO[];
  stockItems: StockItemOptionDTO[];
  onOpenPreparation: (id: string) => void;
  onSaveRow: (row: CompositionRow, q: Partial<Record<Variant, number>>) => void;
  onAdd: (ref: ComponentRef, q: Partial<Record<Variant, number>>) => void;
  canAddXs: boolean;
  onAddXs: () => void;
  version: number;
}) {
  const [editKey, setEditKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Record<Variant, string>>>({});
  const [addKey, setAddKey] = useState("");
  const [addDraft, setAddDraft] = useState<Partial<Record<Variant, string>>>({});
  const editable = (v: Variant) => !(xsFollowsSmall && v === "xs");
  const toQuantities = (d: Partial<Record<Variant, string>>) => {
    const out: Partial<Record<Variant, number>> = {};
    for (const v of variants) if (editable(v)) out[v] = parseNum(d[v] ?? "") ?? 0;
    return out;
  };
  const startEdit = (row: CompositionRow) => {
    setEditKey(row.key);
    setDraft(Object.fromEntries(variants.map((v) => [v, row.bySize[v] ? String(row.bySize[v]!.quantity) : ""])));
  };
  const addRef = (): ComponentRef | null => (addKey.startsWith("stock:") ? { stock_item_id: addKey.slice(6) } : addKey.startsWith("prep:") ? { preparation_id: addKey.slice(5) } : null);
  const addUnit = addKey ? unitOf({ kind: addKey.startsWith("stock:") ? "stock" : "preparation", entityId: addKey.replace(/^(stock|prep):/, "") }) : "";

  return (
    <div className="space-y-4">
      <Section
        title="Componentes por variante"
        aside={<span className="text-[11px] text-ink-muted">Versão {version} da ficha{xsFollowsSmall ? " · XS = metade da Pequena" : ""}</span>}
      >
        {rows.length === 0 ? (
          <p className="text-xs text-ink-muted">Ainda sem componentes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-ink-muted">
                  <th className="py-1.5 pr-2 font-medium">Componente</th>
                  {variants.map((v) => (
                    <th key={v} className="px-2 py-1.5 text-right font-medium">{VARIANT_LABELS[v]}</th>
                  ))}
                  <th className="px-2 py-1.5 font-medium">Unid.</th>
                  {canManage && <th className="py-1.5"><span className="sr-only">Ações</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => {
                  const isEdit = editKey === row.key;
                  const smallDraft = parseNum(draft.small ?? "");
                  return (
                    <tr key={row.key}>
                      <td className="py-1.5 pr-2">
                        {row.kind === "preparation" ? (
                          <button type="button" className="text-left font-medium text-ink underline decoration-line underline-offset-2 hover:decoration-ink" onClick={() => onOpenPreparation(row.entityId)}>
                            {nameOf(row)}
                          </button>
                        ) : (
                          <span className="text-ink">{nameOf(row)}</span>
                        )}
                        <span className="ml-1.5 text-[11px] text-ink-muted">{row.kind === "preparation" ? "preparação" : "ingrediente"}</span>
                      </td>
                      {variants.map((v) => (
                        <td key={v} className="px-2 py-1.5 text-right tabular-nums">
                          {isEdit && editable(v) ? (
                            <input aria-label={`${nameOf(row)} — ${VARIANT_LABELS[v]}`} inputMode="decimal" value={draft[v] ?? ""} onChange={(e) => setDraft({ ...draft, [v]: e.target.value })} className={`${inputCls} w-20 text-right`} />
                          ) : isEdit && v === "xs" ? (
                            <span className="text-ink-muted" title="Metade da Pequena">{smallDraft ? qty(xsQuantity(smallDraft)) : "—"}</span>
                          ) : row.bySize[v] ? (
                            qty(row.bySize[v]!.quantity)
                          ) : (
                            <span className="text-ink-muted">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-ink-secondary">{unitOf(row)}</td>
                      {canManage && (
                        <td className="py-1.5 text-right whitespace-nowrap">
                          {isEdit ? (
                            <>
                              <button type="button" className={primaryBtnCls} disabled={busy} onClick={() => { onSaveRow(row, toQuantities(draft)); setEditKey(null); }}>Guardar</button>
                              <button type="button" className="ml-1 rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-surface-soft" onClick={() => setEditKey(null)}>Cancelar</button>
                            </>
                          ) : (
                            <>
                              <button type="button" className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-surface-soft" disabled={busy} onClick={() => startEdit(row)}>Editar</button>
                              <button
                                type="button"
                                className="rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                                disabled={busy}
                                onClick={() => onSaveRow(row, Object.fromEntries(variants.filter(editable).map((v) => [v, 0])))}
                              >
                                Remover
                              </button>
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {canAddXs && (
          <button type="button" className={`${btnCls} mt-3`} disabled={busy} onClick={onAddXs}>
            Adicionar variante XS (metade da Pequena)
          </button>
        )}
      </Section>

      {canManage && (
        <Section title="Adicionar componente">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-0 flex-col text-[11px] text-ink-muted">
              Ingrediente ou preparação
              <select value={addKey} onChange={(e) => setAddKey(e.target.value)} className={`${inputCls} mt-0.5 max-w-72`}>
                <option value="">Escolher…</option>
                <optgroup label="Preparações">
                  {preparations.filter((p) => p.is_active).map((p) => (
                    <option key={p.id} value={`prep:${p.id}`}>{p.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Ingredientes">
                  {stockItems.filter((s) => s.is_active).map((s) => (
                    <option key={s.id} value={`stock:${s.id}`}>{s.name}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            {variants.filter(editable).map((v) => (
              <label key={v} className="flex flex-col text-[11px] text-ink-muted">
                {VARIANT_LABELS[v]} {addUnit && `(${addUnit})`}
                <input inputMode="decimal" value={addDraft[v] ?? ""} onChange={(e) => setAddDraft({ ...addDraft, [v]: e.target.value })} className={`${inputCls} mt-0.5 w-20 text-right`} />
              </label>
            ))}
            {xsFollowsSmall && (
              <span className="pb-1.5 text-[11px] text-ink-muted">XS: {parseNum(addDraft.small ?? "") ? qty(xsQuantity(parseNum(addDraft.small ?? "")!)) : "—"}</span>
            )}
            <button
              type="button"
              className={primaryBtnCls}
              disabled={busy || !addRef() || !variants.filter(editable).some((v) => (parseNum(addDraft[v] ?? "") ?? 0) > 0)}
              onClick={() => {
                const ref = addRef();
                if (!ref) return;
                onAdd(ref, toQuantities(addDraft));
                setAddKey("");
                setAddDraft({});
              }}
            >
              Adicionar
            </button>
          </div>
        </Section>
      )}
    </div>
  );
}

function Costs({
  dish,
  costing,
  prices,
  variants,
  costById,
  salesVatRate,
  canManage,
  busy,
  onSavePrice,
  onOpenArticle,
  onOpenPreparation,
}: {
  dish: DishDTO;
  costing: DishCostingDTO | null;
  prices: DishPriceDTO[];
  variants: Variant[];
  costById: Map<string, IngredientCostDTO>;
  salesVatRate: number;
  canManage: boolean;
  busy: boolean;
  onSavePrice: (size: Variant, price: number | null) => void;
  onOpenArticle: (id: string) => void;
  onOpenPreparation: (id: string) => void;
}) {
  const [priceDraft, setPriceDraft] = useState<Partial<Record<Variant, string>>>({});
  if (!costing) return <p className="text-xs text-ink-muted">Sem custo calculado para este prato.</p>;
  return (
    <div className="space-y-5">
      {variants.map((v) => {
        const s = costing.sizes.find((x) => x.size === v);
        const price = prices.find((p) => p.size === v) ?? null;
        const draft = priceDraft[v];
        return (
          <Section key={v} title={VARIANT_LABELS[v] ?? v} aside={s ? (s.complete ? <Pill tone="ok">Custo completo</Pill> : <Pill tone="warn">Custo parcial</Pill>) : undefined}>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <dt className="text-[11px] text-ink-muted">Custo teórico s/ IVA</dt>
                <dd className="font-semibold tabular-nums text-ink">{s ? eurCost(s.costWithoutVat) : "—"}{s && !s.complete && <span className="ml-1 text-[11px] font-normal text-amber-800">parcial</span>}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-muted">PVP c/ IVA</dt>
                <dd className="tabular-nums text-ink">
                  {canManage && draft !== undefined ? (
                    <span className="inline-flex items-center gap-1">
                      <input aria-label={`PVP ${VARIANT_LABELS[v]}`} inputMode="decimal" value={draft} onChange={(e) => setPriceDraft({ ...priceDraft, [v]: e.target.value })} className={`${inputCls} w-20 text-right`} />
                      <button type="button" className={primaryBtnCls} disabled={busy} onClick={() => { onSavePrice(v, parseNum(draft)); setPriceDraft({ ...priceDraft, [v]: undefined }); }}>OK</button>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-semibold">{price ? eur(price.price) : "Sem PVP"}</span>
                      {canManage && <button type="button" className="text-[11px] text-ink-secondary underline" onClick={() => setPriceDraft({ ...priceDraft, [v]: price ? String(price.price) : "" })}>alterar</button>}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-muted">Margem s/ IVA</dt>
                <dd className="font-semibold tabular-nums text-ink">{s?.margin ? <>{eur(s.margin.marginWithoutVat)} <span className="text-[11px] font-normal text-ink-secondary">({pct(s.margin.marginRatio)})</span></> : <span className="text-xs font-normal text-ink-muted">{!price ? "Sem PVP" : "Custo parcial"}</span>}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-muted">CMV teórico</dt>
                <dd className="font-semibold tabular-nums text-ink">{s?.margin ? pct(s.margin.foodCostRatio) : <span className="text-xs font-normal text-ink-muted">—</span>}</dd>
              </div>
            </dl>
            {s && s.lines.length > 0 && (
              <table className="mt-3 w-full text-xs">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-ink-muted">
                    <th className="py-1 font-medium">Componente</th>
                    <th className="py-1 text-right font-medium">Qtd.</th>
                    <th className="px-2 py-1 font-medium">Origem do custo</th>
                    <th className="py-1 text-right font-medium">Custo</th>
                    <th className="py-1"><span className="sr-only">Abrir</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {s.lines.map((l, i) => {
                    const src = l.stockItemId ? (costById.get(l.stockItemId)?.source ?? "none") : null;
                    return (
                      <tr key={`${l.stockItemId ?? l.preparationId}-${i}`}>
                        <td className="py-1.5 text-ink">{l.name}</td>
                        <td className="py-1.5 text-right tabular-nums text-ink-secondary">{qty(l.quantity)} {l.baseUnit ?? ""}</td>
                        <td className="px-2 py-1.5">
                          {src ? <Pill tone={SOURCE[src]![1]}>{SOURCE[src]![0]}</Pill> : <Pill tone={l.complete ? "neutral" : "bad"}>{l.complete ? "Preparação" : "Preparação parcial"}</Pill>}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{l.complete ? eurCost(l.costWithoutVat) : <span className="text-ink-muted">{l.costWithoutVat > 0 ? `${eurCost(l.costWithoutVat)} parcial` : "—"}</span>}</td>
                        <td className="py-1.5 text-right">
                          {l.stockItemId ? (
                            <button type="button" className="text-[11px] text-brand-600 underline" onClick={() => onOpenArticle(l.stockItemId!)}>Ver artigo</button>
                          ) : l.preparationId ? (
                            <button type="button" className="text-[11px] text-brand-600 underline" onClick={() => onOpenPreparation(l.preparationId!)}>Ver</button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Section>
        );
      })}
      <p className="text-[11px] text-ink-muted">
        Custos de Artigos e ingredientes: compra confirmada; sem compra, referência manual. Margem = PVP sem IVA ({salesVatRate.toLocaleString("pt-PT")}% de IVA das vendas) − custo teórico. Para corrigir um custo, abra o artigo. {dish.is_active ? "" : "Prato inativo."}
      </p>
    </div>
  );
}

function DishEditForm({ dish, onCancel, onSaved }: { dish: DishDTO; onCancel: () => void; onSaved: () => void }) {
  const { sheets } = useRecipeCostingModule();
  const [name, setName] = useState(dish.name);
  const [category, setCategory] = useState<DishCategory>(dish.category);
  const [active, setActive] = useState(dish.is_active);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) return setError("O nome é obrigatório.");
    setSaving(true);
    try {
      await sheets?.updateDish(dish.id, { name: name.trim(), category, is_active: active });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="rounded-lg border border-line bg-surface-soft/60 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-[11px] text-ink-muted">
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} mt-0.5 w-56`} />
        </label>
        <label className="flex flex-col text-[11px] text-ink-muted">
          Categoria
          <select value={category} onChange={(e) => setCategory(e.target.value as DishCategory)} className={`${inputCls} mt-0.5`}>
            {Object.entries(DISH_CATEGORY_LABELS).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 pb-1.5 text-xs text-ink">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Ativo
        </label>
        <div className="flex gap-1 pb-0.5">
          <button type="button" className={primaryBtnCls} disabled={saving} onClick={() => void save()}>Guardar</button>
          <button type="button" className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-surface-soft" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
      {!active && dish.is_active && <p className="mt-2 text-[11px] text-ink-muted">Inativo: sai da lista de ativos e das análises; a ficha e o histórico ficam guardados.</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
