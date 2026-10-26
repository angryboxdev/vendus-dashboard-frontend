import { useCallback, useEffect, useMemo, useState } from "react";
import type { RecipeCostingReportDTO } from "../../domain/entities/recipe-costing.ts";
import {
  DISH_CATEGORY_LABELS,
  VARIANT_LABELS,
  type DishCategory,
  type DishDTO,
  type PreparationDTO,
  type StockItemOptionDTO,
} from "../../domain/entities/technical-sheets.ts";
import { buildDishRows, missingSummary, type CostState } from "../../domain/services/sheet-rows.ts";
import { useRecipeCostingModule } from "../../recipe-costing.module.tsx";
import { pricingUnit, toPricingUnitCost } from "../../domain/services/pricing-unit.ts";
import { CostAnalysis } from "./CostAnalysis.tsx";
import { DishPanel } from "./DishPanel.tsx";
import { PreparationPanel } from "./PreparationPanel.tsx";
import { Pill } from "./sheet-ui.tsx";
import { eur, eurCost, inputCls, parseNum, pct, primaryBtnCls, qty } from "./sheet-format.ts";

export type SheetsTab = "dishes" | "preparations" | "analysis";
const TABS: { key: SheetsTab; label: string }[] = [
  { key: "dishes", label: "Pratos" },
  { key: "preparations", label: "Preparações" },
  { key: "analysis", label: "Análise de custos" },
];
const STATE: Record<CostState, [string, "ok" | "warn" | "neutral"]> = {
  complete: ["Completo", "ok"],
  partial: ["Parcial", "warn"],
  no_recipe: ["Sem ficha", "neutral"],
};

/**
 * Fichas técnicas (V7): uma página, três separadores — Pratos, Preparações, Análise de custos — com
 * painel lateral para o detalhe. Os custos vêm de Artigos e ingredientes; aqui só se consultam.
 */
export function TechnicalSheetsView({
  tab,
  onTab,
  canManage,
  onOpenArticle,
  onResolveMissing,
}: {
  tab: SheetsTab;
  onTab: (t: SheetsTab) => void;
  canManage: boolean;
  onOpenArticle: (stockItemId: string) => void;
  onResolveMissing: () => void;
}) {
  const { api, sheets } = useRecipeCostingModule();
  const [dishes, setDishes] = useState<DishDTO[] | null>(null);
  const [preparations, setPreparations] = useState<PreparationDTO[]>([]);
  const [stockItems, setStockItems] = useState<StockItemOptionDTO[]>([]);
  const [report, setReport] = useState<RecipeCostingReportDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [openDish, setOpenDish] = useState<string | null>(null);
  const [openPrep, setOpenPrep] = useState<string | null>(null);
  const [creating, setCreating] = useState<"dish" | "preparation" | null>(null);
  const [filters, setFilters] = useState({ q: "", category: "", status: "active", cost: "" });

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  useEffect(() => {
    if (!sheets) return;
    let cancelled = false;
    Promise.all([sheets.listDishes(), sheets.listPreparations(), sheets.listStockItems(), api.getReport()])
      .then(([d, p, s, r]) => {
        if (cancelled) return;
        setDishes(d);
        setPreparations(p);
        setStockItems(s);
        setReport(r);
        setError(null);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Não foi possível carregar as fichas técnicas."));
    return () => {
      cancelled = true;
    };
  }, [api, sheets, reloadKey]);

  const rows = useMemo(() => buildDishRows(dishes ?? [], report), [dishes, report]);
  const visible = rows
    .filter((r) => !filters.q || r.dish.name.toLowerCase().includes(filters.q.toLowerCase()))
    .filter((r) => !filters.category || r.dish.category === filters.category)
    .filter((r) => !filters.status || (filters.status === "active") === r.dish.is_active)
    .filter((r) => !filters.cost || r.state === filters.cost)
    .sort((a, b) => a.dish.name.localeCompare(b.dish.name, "pt"));
  const activeIds = useMemo(() => new Set((dishes ?? []).filter((d) => d.is_active).map((d) => d.id)), [dishes]);
  const missing = missingSummary(report, activeIds);
  const salesVatRate = report?.salesVatRate ?? 13;
  const dish = openDish ? (dishes ?? []).find((d) => d.id === openDish) : undefined;
  const prep = openPrep ? preparations.find((p) => p.id === openPrep) : undefined;
  const openPreparation = (id: string) => {
    setOpenDish(null);
    setOpenPrep(id);
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Fichas técnicas</h1>
          <p className="text-xs text-ink-muted">Composição dos pratos e preparações, custo teórico e margem.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <VatSetting rate={salesVatRate} canManage={canManage} onSaved={reload} />
          {canManage && tab === "dishes" && <button type="button" className={primaryBtnCls} onClick={() => setCreating("dish")}>Novo prato</button>}
          {canManage && tab === "preparations" && <button type="button" className={primaryBtnCls} onClick={() => setCreating("preparation")}>Nova preparação</button>}
        </div>
      </div>

      <nav role="tablist" aria-label="Fichas técnicas" className="mt-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => onTab(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === t.key ? "border-brand-600 text-brand-600" : "border-transparent text-ink-secondary hover:text-ink"}`}
          >
            {t.label}
            {t.key === "dishes" && dishes && <span className="ml-1 text-xs text-ink-muted">{activeIds.size}</span>}
            {t.key === "preparations" && <span className="ml-1 text-xs text-ink-muted">{preparations.length}</span>}
          </button>
        ))}
      </nav>

      {missing.ingredients > 0 && (
        <div role="status" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>
            <b className="font-semibold">{missing.ingredients} {missing.ingredients === 1 ? "ingrediente" : "ingredientes"} sem custo conhecido</b> — {missing.dishes} {missing.dishes === 1 ? "prato ativo tem" : "pratos ativos têm"} custo parcial e sem margem.
          </span>
          <button type="button" className="font-medium underline" onClick={onResolveMissing}>Resolver em Artigos e ingredientes</button>
        </div>
      )}
      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {tab === "dishes" && (
        <>
          <div role="search" className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-[11px] text-ink-muted">
              Pesquisar
              <input type="search" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Nome do prato" className={`${inputCls} mt-0.5 w-52`} />
            </label>
            <label className="flex flex-col text-[11px] text-ink-muted">
              Categoria
              <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} className={`${inputCls} mt-0.5`}>
                <option value="">Todas</option>
                {Object.entries(DISH_CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <label className="flex flex-col text-[11px] text-ink-muted">
              Estado
              <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={`${inputCls} mt-0.5`}>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="">Todos</option>
              </select>
            </label>
            <label className="flex flex-col text-[11px] text-ink-muted">
              Custo
              <select value={filters.cost} onChange={(e) => setFilters({ ...filters, cost: e.target.value })} className={`${inputCls} mt-0.5`}>
                <option value="">Todos</option>
                <option value="complete">Completo</option>
                <option value="partial">Parcial</option>
                <option value="no_recipe">Sem ficha</option>
              </select>
            </label>
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-muted">
                  <th className="px-3 py-2 font-medium">Prato</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 font-medium">Variantes</th>
                  <th className="px-3 py-2 font-medium">Custo</th>
                  <th className="px-3 py-2 text-right font-medium">Custo teórico</th>
                  <th className="px-3 py-2 text-right font-medium">Margem s/ IVA</th>
                  <th className="px-3 py-2 text-right font-medium">PVP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {!dishes && !error && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-ink-muted">A carregar…</td></tr>
                )}
                {visible.map((r) => {
                  const costs = r.sizes.filter((s) => s.lines.length > 0).map((s) => s.costWithoutVat);
                  const pvps = r.sizes.filter((s) => s.salePrice != null).map((s) => `${VARIANT_LABELS[s.size] ?? s.size} ${eur(s.salePrice!)}`);
                  const [label, tone] = STATE[r.state];
                  return (
                    <tr key={r.dish.id} tabIndex={0} onClick={() => setOpenDish(r.dish.id)} onKeyDown={(e) => e.key === "Enter" && setOpenDish(r.dish.id)} className="cursor-pointer outline-none hover:bg-surface-soft focus-visible:bg-surface-soft">
                      <td className="px-3 py-2">
                        <p className={`font-medium ${r.dish.is_active ? "text-ink" : "text-ink-muted"}`}>{r.dish.name}</p>
                        {!r.dish.is_active && <p className="text-[11px] text-ink-muted">Inativo</p>}
                      </td>
                      <td className="px-3 py-2 text-ink-secondary">{DISH_CATEGORY_LABELS[r.dish.category] ?? r.dish.category}</td>
                      <td className="px-3 py-2 text-ink-secondary">{r.sizes.length === 1 ? VARIANT_LABELS[r.sizes[0]!.size] : r.sizes.length ? `${r.sizes.length} variantes` : "—"}</td>
                      <td className="px-3 py-2"><Pill tone={tone}>{label}{r.state === "partial" ? ` · ${r.missingCount} sem custo` : ""}</Pill></td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {costs.length ? (costs.length > 1 ? `${eurCost(Math.min(...costs))} – ${eurCost(Math.max(...costs))}` : eurCost(costs[0]!)) : "—"}
                        {r.state === "partial" && <p className="text-[11px] text-amber-800">parcial</p>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.marginRange ? (
                          <>
                            {r.marginRange.min === r.marginRange.max ? eur(r.marginRange.min) : `${eur(r.marginRange.min)} – ${eur(r.marginRange.max)}`}
                            <p className="text-[11px] text-ink-muted">{r.marginRange.minRatio === r.marginRange.maxRatio ? pct(r.marginRange.minRatio) : `${pct(r.marginRange.minRatio)} – ${pct(r.marginRange.maxRatio)}`}</p>
                          </>
                        ) : (
                          <span className="text-xs text-ink-muted">{pvps.length ? "—" : "Sem PVP"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-ink-secondary">{pvps.length ? pvps.join(" · ") : "—"}</td>
                    </tr>
                  );
                })}
                {dishes && visible.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-ink-muted">Nenhum prato com estes filtros.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-ink-muted">Margem = PVP sem IVA ({salesVatRate.toLocaleString("pt-PT")}%) − custo teórico; só com custo completo.</p>
        </>
      )}

      {tab === "preparations" && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-muted">
                <th className="px-3 py-2 font-medium">Preparação</th>
                <th className="px-3 py-2 text-right font-medium">Rendimento</th>
                <th className="px-3 py-2 text-right font-medium">Custo do lote</th>
                <th className="px-3 py-2 text-right font-medium">Custo por unidade útil</th>
                <th className="px-3 py-2 font-medium">Usada em</th>
                <th className="px-3 py-2 font-medium">Custo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...preparations].sort((a, b) => a.name.localeCompare(b.name, "pt")).map((p) => {
                const c = report?.preparations?.find((x) => x.preparationId === p.id);
                const used = new Set((report?.dishes ?? []).filter((d) => d.sizes.some((s) => s.lines.some((l) => l.preparationId === p.id))).map((d) => d.pizzaId)).size;
                const perUnit = !c || c.itemCount === 0 ? null : p.use_as_unit ? `${eurCost(c.batchCostWithoutVat)}/un` : p.yield_qty >= 1 ? `${eurCost(toPricingUnitCost(c.batchCostWithoutVat / p.yield_qty, p.yield_unit))}/${pricingUnit(p.yield_unit).label}` : null;
                return (
                  <tr key={p.id} tabIndex={0} onClick={() => setOpenPrep(p.id)} onKeyDown={(e) => e.key === "Enter" && setOpenPrep(p.id)} className="cursor-pointer outline-none hover:bg-surface-soft focus-visible:bg-surface-soft">
                    <td className="px-3 py-2">
                      <p className={`font-medium ${p.is_active ? "text-ink" : "text-ink-muted"}`}>{p.name}</p>
                      <p className="text-[11px] text-ink-muted">{c ? `${c.itemCount} ${c.itemCount === 1 ? "ingrediente" : "ingredientes"}` : ""}{p.use_as_unit ? " · usada à unidade" : ""}{!p.is_active ? " · inativa" : ""}</p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{qty(p.yield_qty)} {p.yield_unit}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c && c.itemCount > 0 ? eurCost(c.batchCostWithoutVat) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{perUnit ?? "—"}</td>
                    <td className="px-3 py-2 text-ink-secondary">{used} {used === 1 ? "prato" : "pratos"}</td>
                    <td className="px-3 py-2">{!c || c.itemCount === 0 ? <Pill tone="bad">Sem ingredientes</Pill> : c.complete ? <Pill tone="ok">Completo</Pill> : <Pill tone="warn">Parcial</Pill>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "analysis" && <CostAnalysis report={report} refreshKey={reloadKey} />}

      {dish && (
        <DishPanel
          key={dish.id}
          dish={dish}
          costing={report?.dishes.find((d) => d.pizzaId === dish.id) ?? null}
          ingredients={report?.ingredients ?? []}
          salesVatRate={salesVatRate}
          preparations={preparations}
          stockItems={stockItems}
          canManage={canManage}
          onClose={() => setOpenDish(null)}
          onChanged={reload}
          onOpenArticle={onOpenArticle}
          onOpenPreparation={openPreparation}
        />
      )}
      {prep && (
        <PreparationPanel
          key={prep.id}
          preparation={prep}
          ingredients={report?.ingredients ?? []}
          dishes={report?.dishes ?? []}
          stockItems={stockItems}
          canManage={canManage}
          onClose={() => setOpenPrep(null)}
          onChanged={reload}
          onOpenArticle={onOpenArticle}
        />
      )}
      {creating && (
        <CreateForm
          kind={creating}
          onClose={() => setCreating(null)}
          onCreated={(id) => {
            setCreating(null);
            reload();
            if (creating === "dish") setOpenDish(id);
            else setOpenPrep(id);
          }}
        />
      )}
    </div>
  );
}

function VatSetting({ rate, canManage, onSaved }: { rate: number; canManage: boolean; onSaved: () => void }) {
  const { api } = useRecipeCostingModule();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (draft === null) {
    return (
      <span className="text-xs text-ink-secondary">
        IVA das vendas: <b className="font-semibold text-ink">{rate.toLocaleString("pt-PT")}%</b>
        {canManage && <button type="button" className="ml-1.5 underline" onClick={() => setDraft(String(rate))}>alterar</button>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <label htmlFor="sales-vat" className="text-ink-secondary">IVA das vendas (%)</label>
      <input id="sales-vat" inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)} className={`${inputCls} w-16 text-right`} />
      <button
        type="button"
        className={primaryBtnCls}
        onClick={async () => {
          const n = parseNum(draft);
          if (n == null || n < 0 || n > 100) return setError("Entre 0 e 100.");
          try {
            await api.saveSettings(n);
            setDraft(null);
            setError(null);
            onSaved();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Não foi possível guardar.");
          }
        }}
      >
        Guardar
      </button>
      <button type="button" className="px-1 text-ink-secondary" onClick={() => setDraft(null)}>Cancelar</button>
      {error && <span className="text-red-700">{error}</span>}
    </span>
  );
}

function CreateForm({ kind, onClose, onCreated }: { kind: "dish" | "preparation"; onClose: () => void; onCreated: (id: string) => void }) {
  const { sheets } = useRecipeCostingModule();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DishCategory>("classics");
  const [yieldQty, setYieldQty] = useState("");
  const [yieldUnit, setYieldUnit] = useState("g");
  const [asUnit, setAsUnit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!sheets) return;
    if (!name.trim()) return setError("O nome é obrigatório.");
    const y = parseNum(yieldQty);
    if (kind === "preparation" && !(y && y > 0)) return setError("Indique o rendimento do lote.");
    setSaving(true);
    try {
      if (kind === "dish") {
        const d = await sheets.createDish({ name: name.trim(), category });
        await sheets.createRecipe(d.id);
        onCreated(d.id);
      } else {
        const p = await sheets.createPreparation({ name: name.trim(), yield_qty: y!, yield_unit: yieldUnit, use_as_unit: asUnit });
        onCreated(p.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="create-sheet-title">
      <div className="w-full max-w-md rounded-xl bg-surface-card p-5 shadow-pop">
        <h2 id="create-sheet-title" className="text-base font-semibold text-ink">{kind === "dish" ? "Novo prato" : "Nova preparação"}</h2>
        <div className="mt-4 space-y-3">
          <label className="flex flex-col text-[11px] text-ink-muted">
            Nome
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} mt-0.5`} />
          </label>
          {kind === "dish" ? (
            <label className="flex flex-col text-[11px] text-ink-muted">
              Categoria
              <select value={category} onChange={(e) => setCategory(e.target.value as DishCategory)} className={`${inputCls} mt-0.5`}>
                {Object.entries(DISH_CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col text-[11px] text-ink-muted">
                Rendimento do lote
                <input inputMode="decimal" value={yieldQty} onChange={(e) => setYieldQty(e.target.value)} className={`${inputCls} mt-0.5 w-28 text-right`} />
              </label>
              <select aria-label="Unidade do rendimento" value={yieldUnit} onChange={(e) => setYieldUnit(e.target.value)} className={inputCls}>
                {["g", "kg", "ml", "l", "un"].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <label className="flex items-center gap-1.5 pb-1 text-xs text-ink">
                <input type="checkbox" checked={asUnit} onChange={(e) => setAsUnit(e.target.checked)} />
                Usar à unidade nos pratos
              </label>
            </div>
          )}
          {kind === "dish" && <p className="text-[11px] text-ink-muted">Depois de criar, a composição e o PVP de cada variante preenchem-se no painel do prato.</p>}
          {error && <p className="text-xs text-red-700">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="rounded-md px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface-soft" onClick={onClose}>Cancelar</button>
          <button type="button" className={primaryBtnCls} disabled={saving} onClick={() => void submit()}>{saving ? "A criar…" : "Criar"}</button>
        </div>
      </div>
    </div>
  );
}
