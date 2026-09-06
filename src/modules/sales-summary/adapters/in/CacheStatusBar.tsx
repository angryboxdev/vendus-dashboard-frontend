import { useSalesSummaryContext } from "../../sales-summary.module.tsx";

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "agora mesmo";
  if (diffMin === 1) return "há 1 minuto";
  if (diffMin < 60) return `há ${diffMin} minutos`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs === 1) return "há 1 hora";
  if (diffHrs < 24) return `há ${diffHrs} horas`;
  return "há mais de 1 dia";
}

function absoluteTime(isoString: string): string {
  return new Date(isoString).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CacheStatusBar() {
  const { summary, loading, refresh, refreshing } = useSalesSummaryContext();

  return (
    <div className="flex items-center gap-3">
      {summary && !loading && (
        <span
          className="text-xs text-stone-400"
          title={absoluteTime(summary.cachedAt)}
        >
          Dados de {relativeTime(summary.cachedAt)}
        </span>
      )}
      {loading && (
        <span className="text-xs text-stone-400">A carregar…</span>
      )}

      <button
        type="button"
        onClick={() => void refresh()}
        disabled={loading || refreshing}
        className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {refreshing ? "A actualizar…" : "Actualizar"}
      </button>
    </div>
  );
}
