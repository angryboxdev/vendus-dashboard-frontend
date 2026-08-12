import { useState } from "react";

interface Props {
  open: boolean;
  supplierName: string;
  onClose: () => void;
  onExport: (params: { startDate?: string; endDate?: string }) => Promise<void>;
}

export function ExportStatementModal({ open, supplierName, onClose, onExport }: Props) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleExport() {
    setError(null);
    setLoading(true);
    try {
      await onExport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar o extrato.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-stone-900">Exportar extrato</h2>
        <p className="mt-1 text-sm text-stone-500">
          Exportar faturas de <span className="font-medium text-stone-700">{supplierName}</span> em PDF.
          Os campos de período são opcionais — sem filtro exporta o histórico completo.
        </p>

        <div className="mt-5 space-y-4">
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
              className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 focus:border-[#ED5C32] focus:outline-none focus:ring-1 focus:ring-[#ED5C32]"
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
              className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 focus:border-[#ED5C32] focus:outline-none focus:ring-1 focus:ring-[#ED5C32]"
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-[#ED5C32] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {loading ? "A gerar…" : "Exportar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
