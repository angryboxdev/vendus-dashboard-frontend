import { useState } from "react";

interface Props {
  open: boolean;
  supplierName: string;
  onClose: () => void;
  onExport: (params: { startDate?: string; endDate?: string }) => Promise<void>;
}

/**
 * Duas escolhas claras — "Exportar tudo" (imediato) ou "Selecionar período"
 * (abre os campos de data só quando clicado). Nunca mostra os campos de
 * período já abertos por omissão (era essa a confusão original: parecia que
 * o período era obrigatório). Sem saldo inicial/final informado — esses
 * campos deixaram de fazer sentido aqui (o saldo mostrado é sempre o
 * calculado pelos documentos e liquidações reais).
 */
export function ExportStatementModal({ open, supplierName, onClose, onExport }: Props) {
  const [periodMode, setPeriodMode] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function reset() {
    setPeriodMode(false);
    setStartDate("");
    setEndDate("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleExportAll() {
    setError(null);
    setLoading(true);
    try {
      await onExport({});
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar o extrato.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExportPeriod() {
    setError(null);
    setLoading(true);
    try {
      await onExport({ startDate: startDate || undefined, endDate: endDate || undefined });
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar o extrato.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-stone-900">Exportar extrato</h2>
        <p className="mt-1 text-sm text-stone-500">
          Exportar faturas de <span className="font-medium text-stone-700">{supplierName}</span> em PDF.
        </p>

        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={() => void handleExportAll()}
            disabled={loading}
            className="flex w-full items-center justify-between rounded-lg border border-stone-200 px-4 py-3 text-left text-sm transition-colors hover:border-[#ED5C32] hover:bg-[#FDF8F5] disabled:opacity-50"
          >
            <span>
              <span className="block font-medium text-stone-800">Exportar tudo</span>
              <span className="block text-xs text-stone-400">Histórico completo, sem filtro de datas</span>
            </span>
            <svg className="h-4 w-4 flex-shrink-0 text-stone-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.94 10 7.23 5.29a.75.75 0 111.06-1.06l5.5 5.5a.75.75 0 010 1.06l-5.5 5.5a.75.75 0 01-1.08-.02z" clipRule="evenodd" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setPeriodMode((v) => !v)}
            disabled={loading}
            className="flex w-full items-center justify-between rounded-lg border border-stone-200 px-4 py-3 text-left text-sm transition-colors hover:border-[#ED5C32] hover:bg-[#FDF8F5] disabled:opacity-50"
          >
            <span>
              <span className="block font-medium text-stone-800">Selecionar período</span>
              <span className="block text-xs text-stone-400">Escolher data de início e/ou fim</span>
            </span>
            <svg
              className={`h-4 w-4 flex-shrink-0 text-stone-400 transition-transform ${periodMode ? "rotate-90" : ""}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.94 10 7.23 5.29a.75.75 0 111.06-1.06l5.5 5.5a.75.75 0 010 1.06l-5.5 5.5a.75.75 0 01-1.08-.02z" clipRule="evenodd" />
            </svg>
          </button>

          {periodMode && (
            <div className="space-y-3 rounded-lg bg-stone-50 p-3">
              <div>
                <label className="block text-xs font-medium text-stone-500" htmlFor="stmt-start">
                  Data de início
                </label>
                <input
                  id="stmt-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate || undefined}
                  className="mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:border-[#ED5C32] focus:outline-none focus:ring-1 focus:ring-[#ED5C32]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500" htmlFor="stmt-end">
                  Data de fim
                </label>
                <input
                  id="stmt-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  className="mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 focus:border-[#ED5C32] focus:outline-none focus:ring-1 focus:ring-[#ED5C32]"
                />
              </div>
              <p className="text-[11px] text-stone-400">Deixar em branco equivale a "sem limite" desse lado do período.</p>
              <button
                type="button"
                onClick={() => void handleExportPeriod()}
                disabled={loading || (!startDate && !endDate)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ED5C32] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "A gerar…" : "Exportar período selecionado"}
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
