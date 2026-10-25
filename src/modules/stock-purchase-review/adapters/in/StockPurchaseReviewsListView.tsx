import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useStockPurchaseReviewModule } from "../../stock-purchase-review.module.tsx";
import { useFinancialBaseModule } from "../../../financial-base/financial-base.module.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import {
  STOCK_PURCHASE_REVIEW_STATUS_LABELS,
  DECISION_SOURCE_LABELS,
  type StockPurchaseReviewStatus,
} from "../../domain/entities/stock-purchase-review.ts";

function formatDate(s: string): string {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

const eur = (cents: number | null) => (cents == null ? "—" : (cents / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" }));

const ACTIVE_STATUSES: StockPurchaseReviewStatus[] = ["pending", "in_review", "ready"];
const HISTORY_STATUSES: StockPurchaseReviewStatus[] = ["applied", "excluded", "cancelled"];

const STATUS_TONE: Partial<Record<StockPurchaseReviewStatus, string>> = {
  pending: "bg-amber-50 text-amber-700",
  in_review: "bg-sky-50 text-sky-700",
  partial: "bg-sky-50 text-sky-700",
  ready: "bg-emerald-50 text-emerald-700",
};

const inputCls =
  "rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-[#ED5C32]";

/**
 * "Compras por rever" — fila (F3b): por omissão só o que está por tratar
 * (Por mapear → Em revisão → Pronto); Movimentadas, Excluídas e Retiradas no
 * Histórico. Cada linha mostra fornecedor, documento, data, destino, origem,
 * valor e progresso das linhas.
 */
export function StockPurchaseReviewsListView() {
  const { api } = useStockPurchaseReviewModule();
  const fbModule = useFinancialBaseModule();
  const { activeLocations } = useLocations();
  const navigate = useNavigate();

  const [view, setView] = useState<"active" | "history">("active");
  const [status, setStatus] = useState<StockPurchaseReviewStatus | "all">("all");
  const [supplierId, setSupplierId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");

  const { data: suppliers = [] } = useQuery({
    queryKey: ["financial-base-suppliers"],
    queryFn: () => fbModule.api.listSuppliers(),
  });

  const { data: reviews = [], isLoading, isError } = useQuery({
    queryKey: ["stock-purchase-reviews", view, status, supplierId, from, to, search],
    queryFn: () =>
      api.listReviews({
        view,
        // «Em revisão» junta in_review e partial (filtrado abaixo).
        status: status === "all" || status === "in_review" ? undefined : status,
        supplierId: supplierId || undefined,
        from: from || undefined,
        to: to || undefined,
        search: search.trim() || undefined,
      }),
  });

  const rows = status === "in_review" ? reviews.filter((r) => r.status === "in_review" || r.status === "partial") : reviews;
  const statusOptions = view === "active" ? ACTIVE_STATUSES : HISTORY_STATUSES;
  const locationName = (id: string | null) => (id ? activeLocations.find((l) => l.id === id)?.name ?? "—" : "Por linha");

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      {/* Separador do Inventário: título e «Importar fatura» estão no cabeçalho da página. */}
      <p className="px-6 pt-5 text-sm text-stone-500">
        Faturas encaminhadas ao Stock — concilia cada linha com um artigo (ou marca que não é item de stock) e confirma para movimentar o inventário.
      </p>

      <div className="space-y-4 px-6 pb-6 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" className="flex rounded-lg border border-stone-200 bg-white p-0.5 text-sm">
            {([
              ["active", "Por tratar"],
              ["history", "Histórico"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => {
                  setView(key);
                  setStatus("all");
                }}
                className={`rounded-md px-3 py-1 font-medium ${view === key ? "bg-stone-800 text-white" : "text-stone-500 hover:text-stone-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as StockPurchaseReviewStatus | "all")} className={inputCls} aria-label="Estado">
            <option value="all">Todos os estados</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>{STOCK_PURCHASE_REVIEW_STATUS_LABELS[s]}</option>
            ))}
          </select>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls} aria-label="Fornecedor">
            <option value="">Todos os fornecedores</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} title="De" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} title="Até" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar nº fatura..." className={`w-56 ${inputCls}`} />
        </div>

        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 py-2.5">Fornecedor</th>
                <th className="px-4 py-2.5">Documento</th>
                <th className="px-4 py-2.5">Data</th>
                <th className="px-4 py-2.5">Destino</th>
                <th className="px-4 py-2.5">Origem</th>
                <th className="px-4 py-2.5 text-right">Valor</th>
                <th className="px-4 py-2.5">Linhas</th>
                <th className="px-4 py-2.5">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400">A carregar…</td></tr>
              ) : isError ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400">Indisponível — não foi possível carregar as compras por rever.</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-stone-400">
                    {view === "active" ? "Nada por tratar." : "Sem histórico para este filtro."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const pct = row.linesCount ? Math.round((row.resolvedLines / row.linesCount) * 100) : 0;
                  return (
                    <tr key={row.id} onClick={() => navigate(`/stock/compras-por-rever/${row.id}`)} className="cursor-pointer hover:bg-stone-50/60">
                      <td className="px-4 py-2.5 font-medium text-stone-800">{row.supplierName}</td>
                      <td className="px-4 py-2.5 text-stone-600">{row.invoiceNumber}</td>
                      <td className="px-4 py-2.5 text-stone-600">{formatDate(row.invoiceDate)}</td>
                      <td className="px-4 py-2.5 text-stone-600">{locationName(row.locationId)}</td>
                      <td className="px-4 py-2.5 text-xs text-stone-500">
                        {row.origin === "stock" ? "Stock" : `Financeiro · ${DECISION_SOURCE_LABELS[row.decisionSource]}`}
                        {row.financePending && <span className="ml-1.5 rounded bg-sky-100 px-1.5 py-0.5 font-medium text-sky-700">Aguarda Financeiro</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-stone-700">{eur(row.totalCents)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2" title={`${row.resolvedLines} de ${row.linesCount} linhas tratadas`}>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-stone-100">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-stone-500">{row.resolvedLines}/{row.linesCount}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[row.status] ?? "bg-stone-100 text-stone-600"}`}>
                          {STOCK_PURCHASE_REVIEW_STATUS_LABELS[row.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
