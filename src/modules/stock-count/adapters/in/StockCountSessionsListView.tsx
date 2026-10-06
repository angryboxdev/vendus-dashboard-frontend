import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useStockCountModule } from "../../stock-count.module.tsx";
import { NewCountSessionForm } from "./NewCountSessionForm.tsx";
import {
  STOCK_COUNT_SESSION_STATUS_LABELS,
  STOCK_COUNT_SESSION_TYPE_LABELS,
  type StockCountSessionStatus,
  type StockCountSessionType,
} from "../../domain/entities/stock-count.ts";

function formatDate(s: string): string {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

const STATUS_OPTIONS: (StockCountSessionStatus | "all")[] = [
  "all",
  "draft",
  "counting",
  "reviewing",
  "ready",
  "completed",
  "cancelled",
];

const TYPE_OPTIONS: (StockCountSessionType | "all")[] = ["all", "general", "cyclical", "spot"];

const inputCls =
  "rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-[#ED5C32]";

/**
 * "Contagens de stock" — lista simples (Fase 1). Substitui o antigo botão
 * "Atualizar stock". Cada linha abre a sessão: execução (rascunho/em
 * contagem) ou conferência (em conferência/pronta/concluída/cancelada).
 */
export function StockCountSessionsListView() {
  const { api } = useStockCountModule();
  const navigate = useNavigate();

  const [status, setStatus] = useState<StockCountSessionStatus | "all">("all");
  const [type, setType] = useState<StockCountSessionType | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);

  const { data: sessions = [], isLoading, isError } = useQuery({
    queryKey: ["stock-count-sessions", status, type, from, to],
    queryFn: () =>
      api.listSessions({
        status: status === "all" ? undefined : status,
        from: from || undefined,
        to: to || undefined,
      }),
  });

  const filteredSessions = type === "all" ? sessions : sessions.filter((s) => s.type === type);

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Contagens de stock</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            Contagem física com escopo definido, stock teórico materializado no início, e ajuste ao stock só depois de confirmação explícita.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewForm(true)}
          className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          + Nova contagem
        </button>
      </div>

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <select value={status} onChange={(e) => setStatus(e.target.value as StockCountSessionStatus | "all")} className={inputCls}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "Todos os estados" : STOCK_COUNT_SESSION_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value as StockCountSessionType | "all")} className={inputCls}>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t === "all" ? "Todos os tipos" : STOCK_COUNT_SESSION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} title="De" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} title="Até" />
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 py-2.5">Nº</th>
                <th className="px-4 py-2.5">Data</th>
                <th className="px-4 py-2.5">Tipo</th>
                <th className="px-4 py-2.5">Escopo</th>
                <th className="px-4 py-2.5">Progresso</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-stone-400">A carregar…</td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-stone-400">Indisponível — não foi possível carregar as contagens.</td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-stone-400">Sem contagens para este filtro.</td>
                </tr>
              ) : (
                filteredSessions.map((row) => (
                  <tr key={row.id} className="hover:bg-stone-50/60">
                    <td className="px-4 py-2.5 font-medium text-stone-800">#{row.sessionNumber}</td>
                    <td className="px-4 py-2.5 text-stone-600">{formatDate(row.businessDate)}</td>
                    <td className="px-4 py-2.5 text-stone-600">{STOCK_COUNT_SESSION_TYPE_LABELS[row.type]}</td>
                    <td className="px-4 py-2.5 text-stone-600">{row.linesCount} {row.linesCount === 1 ? "item" : "itens"}</td>
                    <td className="px-4 py-2.5 text-stone-600">
                      {row.linesCount === 0 ? "—" : `${row.linesCount - row.linesPendingCount} de ${row.linesCount}`}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium text-stone-600">{STOCK_COUNT_SESSION_STATUS_LABELS[row.status]}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/stock/contagens/${row.id}`)}
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

      {showNewForm && <NewCountSessionForm onClose={() => setShowNewForm(false)} />}
    </div>
  );
}
