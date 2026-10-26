import { useCallback, useEffect, useMemo, useState } from "react";
import type { DishCostingDTO, IngredientCostDTO } from "../../domain/entities/recipe-costing.ts";
import { VARIANT_LABELS, type PreparationDTO, type PreparationItemDTO, type StockItemOptionDTO } from "../../domain/entities/technical-sheets.ts";
import { preparationBatchCost } from "../../domain/services/preparation-cost.ts";
import { useRecipeCostingModule } from "../../recipe-costing.module.tsx";
import { Pill, Section, SheetDrawer } from "./sheet-ui.tsx";
import { btnCls, eurCost, inputCls, parseNum, primaryBtnCls, qty } from "./sheet-format.ts";
import { pricingUnit, toPricingUnitCost } from "../../domain/services/pricing-unit.ts";

type Tab = "composition" | "yield" | "usage";
const TABS: { key: Tab; label: string }[] = [
  { key: "composition", label: "Composição" },
  { key: "yield", label: "Rendimento e custos" },
  { key: "usage", label: "Utilização" },
];

/** Painel de uma preparação (V7): ingredientes do lote, rendimento registado e custo, pratos que a usam. */
export function PreparationPanel({
  preparation,
  ingredients,
  dishes,
  stockItems,
  canManage,
  onClose,
  onChanged,
  onOpenArticle,
}: {
  preparation: PreparationDTO;
  ingredients: IngredientCostDTO[];
  dishes: DishCostingDTO[];
  stockItems: StockItemOptionDTO[];
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
  onOpenArticle: (stockItemId: string) => void;
}) {
  const { sheets } = useRecipeCostingModule();
  const [tab, setTab] = useState<Tab>("composition");
  const [items, setItems] = useState<PreparationItemDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!sheets) return;
    try {
      setItems((await sheets.getPreparation(preparation.id)).items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível abrir a preparação.");
    }
  }, [sheets, preparation.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
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

  const costById = useMemo(() => new Map(ingredients.map((i) => [i.stockItemId, i])), [ingredients]);
  const batch = preparationBatchCost(items ?? [], costById);
  const usedIn = useMemo(() => {
    const out: { dish: DishCostingDTO; bySize: Record<string, number> }[] = [];
    for (const d of dishes) {
      const bySize: Record<string, number> = {};
      for (const s of d.sizes) for (const l of s.lines) if (l.preparationId === preparation.id) bySize[s.size] = l.quantity;
      if (Object.keys(bySize).length) out.push({ dish: d, bySize });
    }
    return out;
  }, [dishes, preparation.id]);
  const sumOfItems = (items ?? []).reduce((s, i) => s + i.quantity, 0);
  const empty = items !== null && items.length === 0;

  const subtitle = (
    <>
      <span>Preparação</span>
      <span>Rendimento {qty(preparation.yield_qty)} {preparation.yield_unit}{preparation.use_as_unit ? " · usada à unidade" : ""}</span>
      {empty ? <Pill tone="bad">Sem componentes</Pill> : batch.complete ? <Pill tone="ok">Custo completo</Pill> : <Pill tone="warn">Custo parcial</Pill>}
      {!preparation.is_active && <Pill tone="neutral">Inativa</Pill>}
    </>
  );

  return (
    <SheetDrawer
      title={preparation.name}
      subtitle={subtitle}
      tabs={TABS}
      tab={tab}
      onTab={setTab}
      onClose={onClose}
      actions={canManage && !editing ? <button type="button" className={btnCls} onClick={() => setEditing(true)}>Editar</button> : undefined}
    >
      <div className="space-y-5">
        {editing && <PreparationEditForm preparation={preparation} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged(); }} />}
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {items === null && !error && <p className="text-xs text-ink-muted">A carregar…</p>}

        {tab === "composition" && items !== null && (
          <PrepComposition
            items={items}
            stockItems={stockItems}
            costById={costById}
            canManage={canManage}
            busy={busy}
            onOpenArticle={onOpenArticle}
            onAdd={(stockItemId, q) => run(() => sheets!.addPreparationItem(preparation.id, stockItemId, q))}
            onUpdate={(itemId, q) => run(() => sheets!.updatePreparationItem(preparation.id, itemId, q))}
            onDelete={(itemId) => run(() => sheets!.deletePreparationItem(preparation.id, itemId))}
          />
        )}

        {tab === "yield" && items !== null && (
          <YieldAndCost
            preparation={preparation}
            batchCost={batch.cost}
            complete={batch.complete && !empty}
            sumOfItems={sumOfItems}
            canManage={canManage}
            busy={busy}
            onSave={(body) => run(() => sheets!.updatePreparation(preparation.id, body))}
          />
        )}

        {tab === "usage" && (
          <Section title={`Pratos que a usam (${usedIn.length})`}>
            {usedIn.length === 0 ? (
              <p className="text-xs text-ink-muted">Nenhum prato usa esta preparação.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line">
                  {usedIn.map(({ dish, bySize }) => (
                    <tr key={dish.pizzaId}>
                      <td className="py-1.5 text-ink">{dish.name}{!dish.isActive && <span className="ml-1 text-[11px] text-ink-muted">inativo</span>}</td>
                      <td className="py-1.5 text-right text-xs tabular-nums text-ink-secondary">
                        {Object.entries(bySize).map(([s, q]) => `${VARIANT_LABELS[s] ?? s} ${qty(q)}`).join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-2 text-[11px] text-ink-muted">Alterar a preparação muda o custo atual destes pratos; as versões anteriores das fichas ficam guardadas.</p>
          </Section>
        )}
      </div>
    </SheetDrawer>
  );
}

function PrepComposition({
  items,
  stockItems,
  costById,
  canManage,
  busy,
  onOpenArticle,
  onAdd,
  onUpdate,
  onDelete,
}: {
  items: PreparationItemDTO[];
  stockItems: StockItemOptionDTO[];
  costById: Map<string, IngredientCostDTO>;
  canManage: boolean;
  busy: boolean;
  onOpenArticle: (id: string) => void;
  onAdd: (stockItemId: string, q: number) => void;
  onUpdate: (itemId: string, q: number) => void;
  onDelete: (itemId: string) => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [addId, setAddId] = useState("");
  const [addQty, setAddQty] = useState("");
  const item = (id: string) => stockItems.find((s) => s.id === id);
  const used = new Set(items.map((i) => i.stock_item_id));
  return (
    <div className="space-y-4">
      <Section title="Ingredientes do lote">
        {items.length === 0 ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">Sem ingredientes: os pratos que usam esta preparação ficam com custo parcial até a receita ser preenchida.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-muted">
                <th className="py-1 font-medium">Ingrediente</th>
                <th className="py-1 text-right font-medium">Quantidade</th>
                <th className="px-2 py-1 font-medium">Origem do custo</th>
                <th className="py-1 text-right font-medium">Custo</th>
                <th className="py-1"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((i) => {
                const c = costById.get(i.stock_item_id);
                const cost = c?.unitCostWithoutVat != null ? c.unitCostWithoutVat * i.quantity : null;
                const src = c?.source ?? null;
                return (
                  <tr key={i.id}>
                    <td className="py-1.5 text-ink">{item(i.stock_item_id)?.name ?? c?.name ?? "Artigo"}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {editId === i.id ? (
                        <input aria-label="Quantidade" inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)} className={`${inputCls} w-20 text-right`} />
                      ) : (
                        <>{qty(i.quantity)} <span className="text-ink-muted">{item(i.stock_item_id)?.base_unit}</span></>
                      )}
                    </td>
                    <td className="px-2 py-1.5">{src === "invoice" ? <Pill tone="ok">Compra confirmada</Pill> : src === "manual" ? <Pill tone="warn">Referência manual</Pill> : <Pill tone="bad">Sem custo conhecido</Pill>}</td>
                    <td className="py-1.5 text-right tabular-nums">{cost != null ? eurCost(cost) : <span className="text-ink-muted">—</span>}</td>
                    <td className="whitespace-nowrap py-1.5 text-right">
                      <button type="button" className="text-[11px] text-brand-600 underline" onClick={() => onOpenArticle(i.stock_item_id)}>Ver artigo</button>
                      {canManage && (editId === i.id ? (
                        <button type="button" className={`${primaryBtnCls} ml-2`} disabled={busy} onClick={() => { const q = parseNum(draft); if (q && q > 0) onUpdate(i.id, q); setEditId(null); }}>Guardar</button>
                      ) : (
                        <>
                          <button type="button" className="ml-2 rounded-md px-1.5 py-0.5 text-xs text-ink-secondary hover:bg-surface-soft" onClick={() => { setEditId(i.id); setDraft(String(i.quantity)); }}>Editar</button>
                          <button type="button" className="rounded-md px-1.5 py-0.5 text-xs text-red-700 hover:bg-red-50" disabled={busy} onClick={() => onDelete(i.id)}>Remover</button>
                        </>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>
      {canManage && (
        <Section title="Adicionar ingrediente">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-[11px] text-ink-muted">
              Ingrediente
              <select value={addId} onChange={(e) => setAddId(e.target.value)} className={`${inputCls} mt-0.5 max-w-72`}>
                <option value="">Escolher…</option>
                {stockItems.filter((s) => s.is_active && !used.has(s.id)).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-[11px] text-ink-muted">
              Quantidade {addId && `(${item(addId)?.base_unit ?? ""})`}
              <input inputMode="decimal" value={addQty} onChange={(e) => setAddQty(e.target.value)} className={`${inputCls} mt-0.5 w-24 text-right`} />
            </label>
            <button type="button" className={primaryBtnCls} disabled={busy || !addId || !((parseNum(addQty) ?? 0) > 0)} onClick={() => { onAdd(addId, parseNum(addQty)!); setAddId(""); setAddQty(""); }}>
              Adicionar
            </button>
          </div>
          <p className="mt-2 text-[11px] text-ink-muted">As preparações levam só ingredientes (não há preparação dentro de preparação, por isso não há ciclos).</p>
        </Section>
      )}
    </div>
  );
}

function YieldAndCost({
  preparation,
  batchCost,
  complete,
  sumOfItems,
  canManage,
  busy,
  onSave,
}: {
  preparation: PreparationDTO;
  batchCost: number;
  complete: boolean;
  sumOfItems: number;
  canManage: boolean;
  busy: boolean;
  onSave: (body: Partial<Pick<PreparationDTO, "yield_qty" | "yield_unit" | "use_as_unit">>) => void;
}) {
  const [yieldQty, setYieldQty] = useState(String(preparation.yield_qty));
  const [yieldUnit, setYieldUnit] = useState(preparation.yield_unit);
  const [asUnit, setAsUnit] = useState(preparation.use_as_unit);
  const y = preparation.yield_qty;
  const perUnit = preparation.use_as_unit ? batchCost : y >= 1 ? toPricingUnitCost(batchCost / y, preparation.yield_unit) : null;
  const dirty = parseNum(yieldQty) !== preparation.yield_qty || yieldUnit !== preparation.yield_unit || asUnit !== preparation.use_as_unit;
  return (
    <div className="space-y-5">
      <Section title="Custo">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] text-ink-muted">Custo do lote s/ IVA</dt>
            <dd className="font-semibold tabular-nums text-ink">{eurCost(batchCost)}{!complete && <span className="ml-1 text-[11px] font-normal text-amber-800">parcial</span>}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-muted">Rendimento registado</dt>
            <dd className="font-semibold tabular-nums text-ink">{qty(y)} {preparation.yield_unit}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-muted">{preparation.use_as_unit ? "Custo por unidade" : `Custo por ${pricingUnit(preparation.yield_unit).label}`}</dt>
            <dd className="font-semibold tabular-nums text-ink">{perUnit != null ? eurCost(perUnit) : "—"}</dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] text-ink-muted">
          Custo por unidade útil = custo do lote ÷ rendimento registado (não a soma das entradas). {preparation.use_as_unit ? "Usada à unidade: 1 no prato = 1 lote." : ""}
        </p>
      </Section>
      {canManage && (
        <Section title="Rendimento">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-[11px] text-ink-muted">
              Quantidade
              <input inputMode="decimal" value={yieldQty} onChange={(e) => setYieldQty(e.target.value)} className={`${inputCls} mt-0.5 w-28 text-right`} />
            </label>
            <label className="flex flex-col text-[11px] text-ink-muted">
              Unidade
              <select value={yieldUnit} onChange={(e) => setYieldUnit(e.target.value)} className={`${inputCls} mt-0.5`}>
                {["g", "kg", "ml", "l", "un"].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 pb-1.5 text-xs text-ink">
              <input type="checkbox" checked={asUnit} onChange={(e) => setAsUnit(e.target.checked)} />
              Usar à unidade nos pratos
            </label>
            <button type="button" className={primaryBtnCls} disabled={busy || !dirty || !((parseNum(yieldQty) ?? 0) > 0)} onClick={() => onSave({ yield_qty: parseNum(yieldQty)!, yield_unit: yieldUnit, use_as_unit: asUnit })}>
              Guardar
            </button>
          </div>
          {sumOfItems > 0 && (
            <button type="button" className="mt-2 text-[11px] text-ink-secondary underline" onClick={() => setYieldQty(String(Math.round(sumOfItems * 1000) / 1000))}>
              Usar a soma dos ingredientes ({qty(sumOfItems)}) — só se não houver perdas nem água
            </button>
          )}
        </Section>
      )}
    </div>
  );
}

function PreparationEditForm({ preparation, onCancel, onSaved }: { preparation: PreparationDTO; onCancel: () => void; onSaved: () => void }) {
  const { sheets } = useRecipeCostingModule();
  const [name, setName] = useState(preparation.name);
  const [active, setActive] = useState(preparation.is_active);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) return setError("O nome é obrigatório.");
    setSaving(true);
    try {
      await sheets?.updatePreparation(preparation.id, { name: name.trim(), is_active: active });
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
        <label className="flex items-center gap-1.5 pb-1.5 text-xs text-ink">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Ativa
        </label>
        <div className="flex gap-1 pb-0.5">
          <button type="button" className={primaryBtnCls} disabled={saving} onClick={() => void save()}>Guardar</button>
          <button type="button" className="rounded-md px-2 py-1 text-xs text-ink-secondary hover:bg-surface-soft" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
      {!active && preparation.is_active && <p className="mt-2 text-[11px] text-ink-muted">Inativa: deixa de aparecer para adicionar a pratos; os pratos que já a usam continuam iguais.</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
