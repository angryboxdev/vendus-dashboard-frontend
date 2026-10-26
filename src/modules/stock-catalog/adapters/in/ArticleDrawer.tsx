import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  MOVEMENT_TYPE_LABELS,
  SITUATION_LABELS,
  STOCK_ITEM_TYPE_LABELS,
  type ArticlePurchaseDTO,
  type StockMovementDTO,
} from "../../domain/entities/stock-catalog.ts";
import type { CatalogRow } from "../../domain/services/catalog-rows.ts";
import { formatDate, formatPct, formatQuantity, formatUnitCost } from "../../domain/services/unit-cost.ts";
import { useStockCatalogModule } from "../../stock-catalog.module.tsx";

export type DrawerTab = "stock" | "prices" | "purchases" | "movements";

const TABS: { key: DrawerTab; label: string }[] = [
  { key: "stock", label: "Stock" },
  { key: "prices", label: "Preços e histórico" },
  { key: "purchases", label: "Compras" },
  { key: "movements", label: "Movimentos" },
];
const cents = (c: number) => (c / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

function useLoad<T>(load: () => Promise<T>, active: boolean, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    load()
      .then((data) => !cancelled && setState({ data, error: null }))
      .catch((e: unknown) => !cancelled && setState({ data: null, error: e instanceof Error ? e.message : "Não foi possível carregar." }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps]);
  return state;
}

/**
 * Painel lateral do artigo (task V6 §7): abre por cima da lista, sem sair dela. Só leitura — abrir o
 * painel nunca cria movimentos. Áreas carregadas quando se abrem.
 */
export function ArticleDrawer({
  row,
  initialTab = "stock",
  canManage,
  onEdit,
  onClose,
  renderPriceHistory,
}: {
  row: CatalogRow;
  initialTab?: DrawerTab;
  canManage: boolean;
  onEdit: () => void;
  onClose: () => void;
  renderPriceHistory: (stockItemId: string) => ReactNode;
}) {
  const { api } = useStockCatalogModule();
  const [tab, setTab] = useState<DrawerTab>(initialTab);
  const closeRef = useRef<HTMLButtonElement>(null);
  const item = row.item;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  const purchases = useLoad<ArticlePurchaseDTO[]>(() => api.listPurchases(item.id), tab === "purchases", [item.id]);
  const movements = useLoad<StockMovementDTO[]>(() => api.listMovements(item.id, 50), tab === "movements" || tab === "stock", [item.id]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="article-drawer-title">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-surface-card shadow-pop">
        <header className="border-b border-line px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="article-drawer-title" className="truncate text-base font-semibold text-ink">{item.name}</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                {row.categoryName} · {STOCK_ITEM_TYPE_LABELS[item.type] ?? item.type}
                {item.sku ? ` · ${item.sku}` : ""} · unidade {item.base_unit}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canManage && (
                <button type="button" onClick={onEdit} className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-soft">
                  Editar
                </button>
              )}
              <button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar" className="rounded-md px-2 py-1.5 text-sm text-ink-muted hover:bg-surface-soft">
                ✕
              </button>
            </div>
          </div>
          <nav role="tablist" aria-label="Detalhe do artigo" className="mt-3 flex gap-1 overflow-x-auto overflow-y-hidden">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`-mb-px whitespace-nowrap border-b-2 px-2.5 py-1.5 text-xs font-medium ${tab === t.key ? "border-brand-600 text-brand-600" : "border-transparent text-ink-secondary hover:text-ink"}`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">
          {tab === "stock" && (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Stock atual">{item.has_movements === false ? "Sem movimentos" : formatQuantity(item.current_quantity ?? 0, item.base_unit)}</Field>
                <Field label="Mínimo">{item.min_stock > 0 ? formatQuantity(item.min_stock, item.base_unit) : "Sem mínimo definido"}</Field>
                <Field label="Situação">{SITUATION_LABELS[row.situation]}</Field>
                <Field label="Em falta">{row.missing && row.missing > 0 ? formatQuantity(row.missing, item.base_unit) : "—"}</Field>
              </dl>
              <div>
                <p className="text-xs font-medium text-ink-secondary">Reposição sugerida</p>
                <p className="mt-0.5 text-sm text-ink">{suggestionText(row)}</p>
                <p className="text-[11px] text-ink-muted">Só sugestão — não cria compras nem movimentos.</p>
              </div>
              <MovementsList state={movements} baseUnit={item.base_unit} limit={5} title="Últimos movimentos" />
            </div>
          )}
          {tab === "prices" && (
            <div className="space-y-3">
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Último custo líquido s/ IVA">
                  {row.cost?.lastPurchase ? formatUnitCost(row.cost.lastPurchase.centsPerUnit, item.base_unit) : "Sem custo conhecido"}
                </Field>
                <Field label="Referência (12 semanas antes)">
                  {row.cost?.reference ? formatUnitCost(row.cost.reference.centsPerUnit, item.base_unit) : "Histórico insuficiente"}
                </Field>
                <Field label="Variação">{row.cost?.changeRatio != null ? formatPct(row.cost.changeRatio) : "—"}</Field>
                <Field label="Custo de referência (manual)">{row.manualCents !== null ? formatUnitCost(row.manualCents, item.base_unit) : "—"}</Field>
              </dl>
              {renderPriceHistory(item.id)}
            </div>
          )}
          {tab === "purchases" && (
            <Loaded state={purchases} empty="Sem compras confirmadas nas Compras por rever.">
              {(list) => (
                <ul className="divide-y divide-line">
                  {list.map((p) => (
                    <li key={p.lineId} className="py-2">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-medium text-ink">{p.supplierName}</span>
                        <span className="text-xs text-ink-muted">{formatDate(p.invoiceDate)}</span>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2 text-xs text-ink-secondary">
                        <span>
                          {p.reviewId ? (
                            <a href={`/stock/compras-por-rever/${p.reviewId}`} className="underline hover:text-ink">{p.invoiceNumber}</a>
                          ) : (
                            p.invoiceNumber
                          )}{" "}
                          · {formatQuantity(p.quantity, item.base_unit)}
                        </span>
                        <span className="tabular-nums">
                          {p.grossCents !== null && `bruto ${cents(p.grossCents)} · `}
                          {p.discountCents ? `desconto ${cents(p.discountCents)} · ` : ""}líquido {cents(p.netCents)} · {formatUnitCost(p.netCents / p.quantity, item.base_unit)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Loaded>
          )}
          {tab === "movements" && <MovementsList state={movements} baseUnit={item.base_unit} limit={50} title="Movimentos (mais recentes)" />}
        </div>
      </div>
    </div>
  );
}

function suggestionText(row: CatalogRow): string {
  const s = row.suggestion;
  if (s.status === "none") return row.missing === null ? "Sem mínimo definido." : "Nada a repor.";
  if (s.status === "to_confirm") return `Por confirmar — ${s.reason.toLowerCase()}.`;
  const pkg = s.packageUnit ? `${s.packages} ${s.packageUnit}${s.packages === 1 ? "" : "s"} de ${s.contentQuantity.toLocaleString("pt-PT")} ${s.contentUnit}` : `${s.packages} × ${s.contentQuantity.toLocaleString("pt-PT")} ${s.contentUnit}`;
  return `${pkg} = ${formatQuantity(s.quantityBase, row.item.base_unit)}`;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-ink-muted">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-ink">{children}</dd>
    </div>
  );
}

function Loaded<T>({ state, empty, children }: { state: { data: T[] | null; error: string | null }; empty: string; children: (data: T[]) => ReactNode }) {
  if (state.error) return <p className="text-xs text-red-600">{state.error}</p>;
  if (!state.data) return <p className="text-xs text-ink-muted">A carregar…</p>;
  if (state.data.length === 0) return <p className="text-xs text-ink-muted">{empty}</p>;
  return <>{children(state.data)}</>;
}

function MovementsList({ state, baseUnit, limit, title }: { state: { data: StockMovementDTO[] | null; error: string | null }; baseUnit: string; limit: number; title: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-ink-secondary">{title}</p>
      <Loaded state={state} empty="Sem movimentos.">
        {(list) => (
          <ul className="divide-y divide-line text-xs">
            {list.slice(0, limit).map((m) => (
              <li key={m.id} className="flex justify-between gap-2 py-1.5">
                <span className="text-ink-secondary">
                  {formatDate(m.movement_date)} · {MOVEMENT_TYPE_LABELS[m.type] ?? m.type}
                  {m.reason ? ` · ${m.reason}` : ""}
                </span>
                <span className={`tabular-nums ${m.quantity < 0 ? "text-ink-secondary" : "text-ink"}`}>
                  {m.quantity > 0 ? "+" : ""}
                  {formatQuantity(m.quantity, baseUnit)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Loaded>
    </div>
  );
}
