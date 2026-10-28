import { AlertBanner, Button, SECTION_TITLE, SURFACE, Skeleton, StatusBadge, TABLE, TD, TH, THEAD, TR } from "../../../../components/ui/index.ts";
import { formatEUR } from "../../../../lib/format.ts";
import type { MarginReport } from "../../domain/entities/margin-report.ts";
import { BASIS_LABELS, MARGIN_COLUMN_LABELS, marginRows, rateLabel, type MarginCell } from "../../domain/services/margin-report-view.ts";
import { periodLabel, PLATFORM_LABELS } from "../../domain/services/platform-statements-view.ts";
import { useMarginReport } from "./use-margin-report.ts";

const euros = (cents: number) => formatEUR(cents / 100);
const show = (c: MarginCell) =>
  "cents" in c ? euros(c.cents) : "count" in c ? String(c.count) : c.pct === null ? "—" : `${c.pct.toLocaleString("pt-PT", { minimumFractionDigits: 1 })}%`;
const TONES = { gross: "text-navy-900", net: "text-emerald-700", estimate: "text-amber-700" } as const;

function SaftLine({ saft }: { saft: NonNullable<MarginReport["saft"]> }) {
  const ok = Math.abs(saft.differenceCents) <= Math.max(500, Math.round(Math.abs(saft.invoicedCents) * 0.01));
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-surface-soft px-4 py-3 text-sm">
      <span className="font-medium text-navy-900">Conferência com o SAF-T</span>
      <span className="tabular-nums">Faturado {euros(saft.invoicedCents)}</span>
      <span className="tabular-nums">Clientes pagaram (extratos) {euros(saft.platformsPaidCents)}</span>
      <span className="tabular-nums">Diferença {euros(saft.differenceCents)}</span>
      <StatusBadge tone={ok ? "success" : "warning"}>{ok ? "Bate" : "Verificar"}</StatusBadge>
    </div>
  );
}

/** Margem por plataforma do mês: a conta da venda com IVA à margem líquida, com exportação. */
export function MarginReportCard({ year, month }: { year: number; month: number }) {
  const m = useMarginReport(year, month);
  const r = m.report;
  if (m.error) {
    return (
      <AlertBanner tone="danger" title="Não foi possível calcular a margem">
        {m.error}
      </AlertBanner>
    );
  }
  if (m.loading || !r) return <Skeleton className="h-96" />;
  if (r.platforms.length === 0) return null;
  const cols = [...r.platforms, r.total];
  const split = r.documents.filter((d) => d.share < 1);

  return (
    <section className={`${SURFACE} p-6`} aria-labelledby="dp-margin">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="dp-margin" className={SECTION_TITLE}>
            Margem por plataforma
          </h2>
          <p className="mt-1 text-xs text-ink-secondary">
            % sobre as vendas sem IVA · IVA das vendas {rateLabel(r.salesVatRate)} ({r.salesVatRateSource === "saft" ? "pelo SAF-T do mês" : "estimado"})
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" loading={m.exporting === "xlsx"} onClick={() => m.exportAs("xlsx")}>
            Excel
          </Button>
          <Button size="sm" loading={m.exporting === "pdf"} onClick={() => m.exportAs("pdf")}>
            PDF
          </Button>
        </div>
      </div>
      {m.exportError && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {m.exportError}
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className={TABLE}>
          <thead className={THEAD}>
            <tr>
              <th className={TH} />
              {cols.map((c) => (
                <th key={c.platform} className={`${TH} text-right`}>
                  {MARGIN_COLUMN_LABELS[c.platform]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {marginRows(r).map((row, i) => (
              <tr key={i} className={`${TR} ${row.strong ? "bg-surface-soft/70" : ""}`}>
                <td className={`${TD} ${row.strong ? "font-semibold" : ""} ${row.tone ? TONES[row.tone] : ""}`}>{row.label}</td>
                {cols.map((c) => (
                  <td key={c.platform} className={`${TD} text-right tabular-nums ${row.strong ? "font-semibold" : ""} ${row.tone ? TONES[row.tone] : ""}`}>
                    {show(row.cell(c))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {r.saft && <SaftLine saft={r.saft} />}
      {split.length > 0 && (
        <p className="mt-3 text-xs text-ink-secondary">
          Documentos que atravessam o mês (só conta a parte do mês):{" "}
          {split
            .map((d) => `${PLATFORM_LABELS[d.platform]} ${periodLabel(d.periodFrom, d.periodTo)} — ${Math.round(d.share * 100)}%, ${BASIS_LABELS[d.basis]}`)
            .join(" · ")}
          .
        </p>
      )}
      <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-ink-secondary">
        {r.warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </section>
  );
}
