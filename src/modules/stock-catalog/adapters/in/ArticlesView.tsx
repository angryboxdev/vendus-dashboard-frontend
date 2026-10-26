import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  SITUATION_LABELS,
  STOCK_ITEM_TYPE_LABELS,
  type CatalogView,
  type CostOverviewResponseDTO,
  type PurchasePresentationDTO,
  type StockCategoryDTO,
  type StockItemDTO,
  type StockSituation,
} from "../../domain/entities/stock-catalog.ts";
import { buildRows, filterRows, paginate, sortRows, type CatalogFilters, type CatalogRow, type SortKey } from "../../domain/services/catalog-rows.ts";
import { formatDate, formatPct, formatQuantity, formatUnitCost, toPriceUnitEuros, priceUnit } from "../../domain/services/unit-cost.ts";
import { useStockCatalogModule } from "../../stock-catalog.module.tsx";
import { ArticleDrawer, type DrawerTab } from "./ArticleDrawer.tsx";
import { Sparkline } from "./Sparkline.tsx";

const VIEWS: { key: CatalogView; label: string }[] = [
  { key: "general", label: "Geral" },
  { key: "replenishment", label: "Reposição" },
  { key: "costs", label: "Custos" },
];

const SITUATION_TONE: Partial<Record<StockSituation, string>> = {
  out: "bg-red-50 text-red-700",
  below: "bg-amber-50 text-amber-800",
  near: "bg-amber-50/60 text-amber-700",
  no_data: "bg-surface-soft text-ink-muted",
  inactive: "bg-surface-soft text-ink-muted",
};

const EMPTY_FILTERS: CatalogFilters = { search: "", categoryId: "", type: "", status: "active", situation: "" };

/**
 * «Artigos e ingredientes» (task V6): uma tabela, três vistas (Geral, Reposição, Custos) da mesma
 * entidade, painel lateral ao abrir uma linha. Sem cartões de resumo nem cartões por artigo.
 * O CRUD continua nos formulários existentes (Editar / Novo artigo), passados pela página.
 */
export function ArticlesView({
  canManage,
  reloadKey,
  headerActions,
  onEdit,
  renderPriceHistory,
}: {
  canManage: boolean;
  reloadKey: number;
  headerActions: ReactNode;
  onEdit: (item: StockItemDTO) => void;
  renderPriceHistory: (stockItemId: string) => ReactNode;
}) {
  const { api } = useStockCatalogModule();
  const [items, setItems] = useState<StockItemDTO[] | null>(null);
  const [categories, setCategories] = useState<StockCategoryDTO[]>([]);
  const [overview, setOverview] = useState<CostOverviewResponseDTO | null>(null);
  const [presentations, setPresentations] = useState<PurchasePresentationDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CatalogView>("general");
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [open, setOpen] = useState<{ id: string; tab: DrawerTab } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listItems(), api.listCategories(), api.getCostOverview().catch(() => null), api.listPresentations()])
      .then(([its, cats, ov, pres]) => {
        if (cancelled) return;
        setItems(its);
        setCategories(cats);
        setOverview(ov);
        setPresentations(pres);
        setError(null);
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Não foi possível carregar os artigos."));
    return () => {
      cancelled = true;
    };
  }, [api, reloadKey]);

  const rows = useMemo(() => (items ? buildRows(items, categories, overview?.items ?? [], presentations) : []), [items, categories, overview, presentations]);
  const visible = useMemo(() => sortRows(filterRows(rows, filters, view), sort.key, sort.dir, view), [rows, filters, view, sort]);
  const pageData = paginate(visible, page, pageSize);
  const types = useMemo(() => [...new Set(rows.map((r) => r.item.type))], [rows]);

  const setFilter = (patch: Partial<CatalogFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }));
  const openRow = useCallback((id: string, tab: DrawerTab = "stock") => {
    setMenu(null);
    setOpen({ id, tab });
  }, []);
  const openedRow = open ? rows.find((r) => r.item.id === open.id) ?? null : null;

  const header = (key: SortKey | null, label: string, align: "left" | "right" = "left") => (
    <th className={`whitespace-nowrap px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted ${align === "right" ? "text-right" : "text-left"}`} aria-sort={key && sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
      {key ? (
        <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink">
          {label}
          {sort.key === key && <span aria-hidden="true">{sort.dir === "asc" ? "↑" : "↓"}</span>}
        </button>
      ) : (
        label
      )}
    </th>
  );

  const situationCell = (r: CatalogRow) =>
    r.situation === "ok" ? (
      <span className="text-xs text-ink-muted">OK</span>
    ) : (
      <span className={`inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ${SITUATION_TONE[r.situation] ?? ""}`}>{SITUATION_LABELS[r.situation]}</span>
    );
  const stockCell = (r: CatalogRow) => (r.item.has_movements === false ? <span className="text-ink-muted">—</span> : formatQuantity(r.item.current_quantity ?? 0, r.item.base_unit));
  const minCell = (r: CatalogRow) => (r.item.min_stock > 0 ? formatQuantity(r.item.min_stock, r.item.base_unit) : <span className="text-ink-muted">—</span>);
  const costCell = (r: CatalogRow) =>
    r.cost?.lastPurchase ? formatUnitCost(r.cost.lastPurchase.centsPerUnit, r.item.base_unit) : <span className="text-xs text-ink-muted">Sem custo conhecido</span>;
  const suggestionCell = (r: CatalogRow) => {
    const s = r.suggestion;
    if (s.status === "none") return <span className="text-ink-muted">—</span>;
    if (s.status === "to_confirm") return <span className="text-xs text-amber-700" title={s.reason}>Por confirmar</span>;
    return (
      <span className="whitespace-nowrap">
        {s.packages} {s.packageUnit ? `${s.packageUnit}${s.packages === 1 ? "" : "s"}` : "×"} <span className="text-ink-muted">= {formatQuantity(s.quantityBase, r.item.base_unit)}</span>
      </span>
    );
  };
  const changeCell = (r: CatalogRow) => {
    if (!r.cost?.lastPurchase || !r.cost.reference || r.cost.changeRatio === null) return <span className="text-xs text-ink-muted">—</span>;
    const diffEur = toPriceUnitEuros(r.cost.lastPurchase.centsPerUnit - r.cost.reference.centsPerUnit, r.item.base_unit);
    return (
      <span className="whitespace-nowrap tabular-nums">
        {formatPct(r.cost.changeRatio)}{" "}
        <span className="text-[11px] text-ink-muted">
          ({diffEur > 0 ? "+" : ""}
          {diffEur.toLocaleString("pt-PT", { maximumFractionDigits: 3 })} €/{priceUnit(r.item.base_unit).label})
        </span>
      </span>
    );
  };

  const columns: { head: ReactNode; cell: (r: CatalogRow) => ReactNode; align?: "right" }[] =
    view === "general"
      ? [
          { head: header(null, "Categoria"), cell: (r) => <span className="text-ink-secondary">{r.categoryName}</span> },
          { head: header(null, "Tipo"), cell: (r) => <span className="text-ink-secondary">{STOCK_ITEM_TYPE_LABELS[r.item.type] ?? r.item.type}</span> },
          { head: header("stock", "Stock atual", "right"), cell: stockCell, align: "right" },
          { head: header(null, "Mínimo", "right"), cell: minCell, align: "right" },
          { head: header(null, "Situação"), cell: situationCell },
          { head: header("cost", "Último custo s/ IVA", "right"), cell: costCell, align: "right" },
        ]
      : view === "replenishment"
        ? [
            { head: header("stock", "Stock atual", "right"), cell: stockCell, align: "right" },
            { head: header(null, "Mínimo", "right"), cell: minCell, align: "right" },
            { head: header("missing", "Em falta", "right"), cell: (r) => (r.missing && r.missing > 0 ? formatQuantity(r.missing, r.item.base_unit) : <span className="text-ink-muted">—</span>), align: "right" },
            { head: header(null, "Sugestão de compra"), cell: suggestionCell },
            { head: header(null, "Fornecedor habitual"), cell: (r) => <span className="text-ink-secondary">{r.cost?.lastPurchase?.supplierName ?? "—"}</span> },
            { head: header("cost", "Último custo s/ IVA", "right"), cell: costCell, align: "right" },
          ]
        : [
            { head: header(null, "Categoria"), cell: (r) => <span className="text-ink-secondary">{r.categoryName}</span> },
            { head: header("cost", "Último custo s/ IVA", "right"), cell: costCell, align: "right" },
            {
              head: header(null, "Referência (12 sem.)", "right"),
              cell: (r) => (r.cost?.reference ? formatUnitCost(r.cost.reference.centsPerUnit, r.item.base_unit) : <span className="text-xs text-ink-muted">Histórico insuficiente</span>),
              align: "right",
            },
            { head: header("change", "Variação", "right"), cell: changeCell, align: "right" },
            { head: header(null, "Tendência"), cell: (r) => (r.cost ? <Sparkline values={r.cost.weekly} label={`Tendência do custo de ${r.item.name}`} /> : <span className="text-[11px] text-ink-muted">—</span>) },
            { head: header(null, "Fornecedor"), cell: (r) => <span className="text-ink-secondary">{r.cost?.lastPurchase?.supplierName ?? "—"}</span> },
            { head: header("lastDate", "Última compra", "right"), cell: (r) => (r.cost?.lastPurchase ? formatDate(r.cost.lastPurchase.invoiceDate) : "—"), align: "right" },
            { head: header(null, "Custo manual", "right"), cell: (r) => (r.manualCents !== null ? <span className="text-ink-secondary">{formatUnitCost(r.manualCents, r.item.base_unit)}</span> : <span className="text-ink-muted">—</span>), align: "right" },
          ];

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Artigos e ingredientes</h2>
          <p className="text-xs text-ink-muted">{items ? `${rows.filter((r) => r.item.is_active).length} artigos ativos` : "A carregar…"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{headerActions}</div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-line">
        <nav role="tablist" aria-label="Vista" className="flex gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view === v.key}
              onClick={() => {
                setView(v.key);
                setPage(1);
              }}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${view === v.key ? "border-brand-600 text-brand-600" : "border-transparent text-ink-secondary hover:text-ink"}`}
            >
              {v.label}
            </button>
          ))}
        </nav>
        {view === "costs" && overview && <p className="pb-2 text-[11px] text-ink-muted">Referência: {overview.referenceMethod.toLowerCase()}. Valores s/ IVA, depois do desconto da linha.</p>}
        {view === "replenishment" && <p className="pb-2 text-[11px] text-ink-muted">Sugestões com a embalagem confirmada do fornecedor habitual. Não cria compras.</p>}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2" role="search">
        <label className="flex flex-col text-[11px] text-ink-muted">
          Pesquisar
          <input type="search" value={filters.search} onChange={(e) => setFilter({ search: e.target.value })} placeholder="Nome ou SKU" className="mt-0.5 w-52 rounded-md border border-line px-2.5 py-1.5 text-sm text-ink" />
        </label>
        <label className="flex flex-col text-[11px] text-ink-muted">
          Categoria
          <select value={filters.categoryId} onChange={(e) => setFilter({ categoryId: e.target.value })} className="mt-0.5 rounded-md border border-line px-2 py-1.5 text-sm text-ink">
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-[11px] text-ink-muted">
          Tipo
          <select value={filters.type} onChange={(e) => setFilter({ type: e.target.value })} className="mt-0.5 rounded-md border border-line px-2 py-1.5 text-sm text-ink">
            <option value="">Todos</option>
            {types.map((t) => (
              <option key={t} value={t}>{STOCK_ITEM_TYPE_LABELS[t] ?? t}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-[11px] text-ink-muted">
          Estado
          <select value={filters.status} onChange={(e) => setFilter({ status: e.target.value })} className="mt-0.5 rounded-md border border-line px-2 py-1.5 text-sm text-ink">
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
            <option value="">Todos</option>
          </select>
        </label>
        <label className="flex flex-col text-[11px] text-ink-muted">
          Situação
          <select value={filters.situation} onChange={(e) => setFilter({ situation: e.target.value as CatalogFilters["situation"] })} className="mt-0.5 rounded-md border border-line px-2 py-1.5 text-sm text-ink">
            <option value="">{view === "replenishment" ? "Com algo em falta" : "Todas"}</option>
            <option value="attention">Precisa de atenção</option>
            {(["out", "below", "near", "ok", "no_data"] as StockSituation[]).map((s) => (
              <option key={s} value={s}>{SITUATION_LABELS[s]}</option>
            ))}
          </select>
        </label>
        {(filters.search || filters.categoryId || filters.type || filters.situation || filters.status !== "active") && (
          <button type="button" onClick={() => setFilter(EMPTY_FILTERS)} className="pb-1.5 text-xs text-ink-secondary underline hover:text-ink">
            Limpar filtros
          </button>
        )}
      </div>

      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface-card">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              {header("name", "Artigo")}
              {columns.map((c, i) => (
                <Fragment key={i}>{c.head}</Fragment>
              ))}
              <th className="w-10 px-3 py-2"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!items && !error && (
              <tr>
                <td colSpan={columns.length + 2} className="px-3 py-8 text-center text-sm text-ink-muted">A carregar…</td>
              </tr>
            )}
            {items && pageData.rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="px-3 py-8 text-center text-sm text-ink-muted">
                  {view === "replenishment" && !filters.situation ? "Nada em falta — nenhum artigo abaixo do mínimo." : "Nenhum artigo com estes filtros."}
                </td>
              </tr>
            )}
            {pageData.rows.map((r) => (
              <tr
                key={r.item.id}
                tabIndex={0}
                onClick={() => openRow(r.item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") openRow(r.item.id);
                }}
                className="cursor-pointer outline-none hover:bg-surface-soft focus-visible:bg-surface-soft focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
              >
                <td className="px-3 py-2">
                  <p className={`font-medium ${r.item.is_active ? "text-ink" : "text-ink-muted"}`}>{r.item.name}</p>
                  <p className="text-[11px] text-ink-muted">{[r.item.sku, r.item.base_unit].filter(Boolean).join(" · ")}</p>
                </td>
                {columns.map((c, i) => (
                  <td key={i} className={`px-3 py-2 tabular-nums ${c.align === "right" ? "text-right" : ""}`}>{c.cell(r)}</td>
                ))}
                <td className="relative px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    aria-label={`Ações de ${r.item.name}`}
                    aria-haspopup="menu"
                    aria-expanded={menu === r.item.id}
                    onClick={() => setMenu(menu === r.item.id ? null : r.item.id)}
                    className="rounded px-1.5 py-0.5 text-ink-muted hover:bg-surface-soft hover:text-ink"
                  >
                    ⋯
                  </button>
                  {menu === r.item.id && (
                    <div role="menu" className="absolute right-3 top-8 z-10 w-44 rounded-md border border-line bg-surface-card py-1 text-left text-sm shadow-pop">
                      <MenuItem onClick={() => openRow(r.item.id, "stock")}>Ver</MenuItem>
                      {canManage && (
                        <MenuItem
                          onClick={() => {
                            setMenu(null);
                            onEdit(r.item);
                          }}
                        >
                          Editar
                        </MenuItem>
                      )}
                      <MenuItem onClick={() => openRow(r.item.id, "prices")}>Histórico de preços</MenuItem>
                      <MenuItem onClick={() => openRow(r.item.id, "movements")}>Movimentos</MenuItem>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items && visible.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2 text-xs text-ink-secondary">
            <span>
              {(pageData.page - 1) * pageSize + 1}–{Math.min(pageData.page * pageSize, visible.length)} de {visible.length}
            </span>
            <div className="flex items-center gap-2">
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} aria-label="Linhas por página" className="rounded border border-line px-1.5 py-1">
                {[25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n} por página</option>
                ))}
              </select>
              <button type="button" onClick={() => setPage(pageData.page - 1)} disabled={pageData.page <= 1} className="rounded border border-line px-2 py-1 disabled:opacity-40">Anterior</button>
              <span>Página {pageData.page} de {pageData.pages}</span>
              <button type="button" onClick={() => setPage(pageData.page + 1)} disabled={pageData.page >= pageData.pages} className="rounded border border-line px-2 py-1 disabled:opacity-40">Seguinte</button>
            </div>
          </div>
        )}
      </div>

      {openedRow && (
        <ArticleDrawer
          key={`${openedRow.item.id}-${open!.tab}`}
          row={openedRow}
          initialTab={open!.tab}
          canManage={canManage}
          onEdit={() => {
            setOpen(null);
            onEdit(openedRow.item);
          }}
          onClose={() => setOpen(null)}
          renderPriceHistory={renderPriceHistory}
        />
      )}
    </div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className="block w-full px-3 py-1.5 text-left text-ink hover:bg-surface-soft">
      {children}
    </button>
  );
}
