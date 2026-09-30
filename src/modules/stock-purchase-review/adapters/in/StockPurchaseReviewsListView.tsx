import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useStockPurchaseReviewModule } from "../../stock-purchase-review.module.tsx";
import { useFinancialBaseModule } from "../../../financial-base/financial-base.module.tsx";
import {
  STOCK_PURCHASE_REVIEW_STATUS_LABELS,
  type StockPurchaseReviewStatus,
} from "../../domain/entities/stock-purchase-review.ts";

function formatDate(s: string): string {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

const STATUS_OPTIONS: (StockPurchaseReviewStatus | "all")[] = [
  "all",
  "pending",
  "in_review",
  "partial",
  "ready",
  "applied",
  "cancelled",
];

const inputCls =
  "rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-[#ED5C32]";

/**
 * "Compras por rever" — lista simples (Fase 1). Cada linha abre o detalhe
 * onde as linhas da fatura se mapeiam para item de stock existente, item
 * novo, ou "não afeta stock". Nunca uma vista com cartões/dashboard — segue
 * o padrão plain-text já estabelecido no módulo Contabilidade.
 */
export function StockPurchaseReviewsListView() {
  const { api } = useStockPurchaseReviewModule();
  const fbModule = useFinancialBaseModule();
  const navigate = useNavigate();

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
    queryKey: ["stock-purchase-reviews", status, supplierId, from, to, search],
    queryFn: () =>
      api.listReviews({
        status: status === "all" ? undefined : status,
        supplierId: supplierId || undefined,
        from: from || undefined,
        to: to || undefined,
        search: search.trim() || undefined,
      }),
  });

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="border-b border-stone-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-stone-900">Compras por rever</h1>
        <p className="mt-0.5 text-sm text-stone-500">
          Faturas com potencial impacto em stock — mapeia cada linha para um item existente, um item novo, ou marca que não afeta stock, e confirma para atualizar o inventário.
        </p>
      </div>

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <select value={status} onChange={(e) => setStatus(e.target.value as StockPurchaseReviewStatus | "all")} className={inputCls}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "Todos os estados" : STOCK_PURCHASE_REVIEW_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
            <option value="">Todos os fornecedores</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} title="De" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} title="Até" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar nº fatura..."
            className={`w-56 ${inputCls}`}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 py-2.5">Fatura</th>
                <th className="px-4 py-2.5">Fornecedor</th>
                <th className="px-4 py-2.5">Data</th>
                <th className="px-4 py-2.5 text-right">Linhas</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-400">A carregar…</td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-400">Indisponível — não foi possível carregar as compras por rever.</td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-400">Sem compras por rever para este filtro.</td>
                </tr>
              ) : (
                reviews.map((row) => (
                  <tr key={row.id} className="hover:bg-stone-50/60">
                    <td className="px-4 py-2.5 font-medium text-stone-800">{row.invoiceNumber}</td>
                    <td className="px-4 py-2.5 text-stone-600">{row.supplierName}</td>
                    <td className="px-4 py-2.5 text-stone-600">{formatDate(row.invoiceDate)}</td>
                    <td className="px-4 py-2.5 text-right text-stone-600">{row.linesCount}</td>
                    <td className="px-4 py-2.5 text-xs font-medium text-stone-600">{STOCK_PURCHASE_REVIEW_STATUS_LABELS[row.status]}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/stock/compras-por-rever/${row.id}`)}
                        className="rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
