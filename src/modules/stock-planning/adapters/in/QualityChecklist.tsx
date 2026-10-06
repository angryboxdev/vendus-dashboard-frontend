import { formatIsoDatePt } from "../../../../lib/format.ts";
import { ConfidenceBadge } from "./ConfidenceBadge.tsx";
import type { AffectedProductSummary, ConfidenceLevel, QualityFlagsDTO } from "../../domain/entities/stock-planning.ts";

/** Mesmo limiar documentado em `confidence.service.ts` (backend) para "última contagem física recente". */
const STALE_COUNT_DAYS_THRESHOLD = 60;

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function CheckRow({ ok, label, detail }: { ok: boolean; detail?: string; label: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        }`}
      >
        {ok ? "✓" : "!"}
      </span>
      <span className="text-stone-700">
        {label}
        {detail && <span className="ml-1 text-xs text-stone-400">— {detail}</span>}
      </span>
    </li>
  );
}

/**
 * Checklist "Qualidade da previsão" partilhada pelas drawers de item/alerta —
 * traduz os booleanos de `QualityFlagsDTO` para uma leitura humana, nunca
 * inventa um score novo (a confiança já vem calculada pelo backend).
 */
export function QualityChecklist({ quality, confidence }: { quality: QualityFlagsDTO; confidence?: ConfidenceLevel }) {
  const countIsStale =
    quality.lastPhysicalCountAt == null || daysSince(quality.lastPhysicalCountAt) > STALE_COUNT_DAYS_THRESHOLD;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700">Qualidade da previsão</h3>
        {confidence && <ConfidenceBadge confidence={confidence} />}
      </div>
      <ul className="space-y-2">
        <CheckRow ok={!quality.hasIncompleteMapping} label="Fichas técnicas / mapeamento completos" />
        <CheckRow ok={!quality.hasNegativeOrStaleStock} label="Stock sem inconsistências (negativo ou desatualizado)" />
        <CheckRow ok={!quality.pendingReviewsAffectingItem} label="Sem compras por rever pendentes para este item" />
        <CheckRow
          ok={!countIsStale}
          label="Última contagem física"
          detail={quality.lastPhysicalCountAt ? formatIsoDatePt(quality.lastPhysicalCountAt) : "nunca contado"}
        />
      </ul>
    </div>
  );
}

const DEMAND_SOURCE_LABELS: Record<string, string> = {
  pizza: "Pizza",
  stock: "Item de stock",
};

/** Grelha "Produtos afetados" partilhada — cada linha já vem agregada e ordenada pelo backend (`simulateImpact`). */
export function AffectedProductsGrid({ products }: { products: AffectedProductSummary[] }) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-stone-700">Produtos afetados</h3>
        <p className="text-xs text-stone-400">Nenhum produto de venda direta identificado para este item.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-stone-700">Produtos afetados</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {products.map((p) => (
          <div key={`${p.demandSourceType}:${p.demandSourceRef}`} className="rounded-lg border border-stone-100 bg-stone-50/60 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{DEMAND_SOURCE_LABELS[p.demandSourceType] ?? p.demandSourceType}</p>
            <p className="truncate text-sm font-medium text-stone-700" title={p.demandSourceRef}>{p.demandSourceRef}</p>
            <p className="text-xs text-stone-500">{p.contributedQty.toLocaleString("pt-PT", { maximumFractionDigits: 2 })} consumido</p>
          </div>
        ))}
      </div>
    </div>
  );
}
