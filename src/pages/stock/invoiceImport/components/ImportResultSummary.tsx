import { Link } from "react-router-dom";

export function ImportResultSummary({
  movementsCreated,
  itemsUpdated,
  message,
  onClose,
}: {
  movementsCreated: number;
  itemsUpdated: number;
  message?: string | null;
  onClose: () => void;
}) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-6 text-center">
      <h4 className="text-base font-semibold text-emerald-900">
        Importação aplicada com sucesso
      </h4>
      <p className="mt-2 text-sm text-emerald-800">
        Foram criadas{" "}
        <strong>{movementsCreated}</strong> movimentação(ões) de stock e atualizados{" "}
        <strong>{itemsUpdated}</strong> item(ns).
      </p>
      {message && (
        <p className="mt-2 text-xs text-emerald-700">{message}</p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          to="/stock/historico-movimentos"
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          onClick={onClose}
        >
          Ver histórico de movimentos
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
