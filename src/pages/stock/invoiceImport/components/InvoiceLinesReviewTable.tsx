import { useMemo, useState } from "react";
import { formatMoney } from "../../../../lib/format";
import type { StockItem } from "../../stock.types";
import type { InvoiceLineMatchStatus, ReviewableInvoiceLine } from "../invoiceImport.types";
import {
  preDiscountFromPost,
  recomputeLineTotal,
} from "../invoiceImport.utils";

const MATCH_LABELS: Record<InvoiceLineMatchStatus, string> = {
  matched: "Correspondência",
  needs_review: "Rever",
  ignored: "Ignorada",
};

const PAGE_SIZE_OPTIONS = [8, 15, 30, 50] as const;

export function InvoiceLinesReviewTable({
  lines,
  stockItems,
  currency,
  onUpdateLine,
  onCreateItemFromLine,
}: {
  lines: ReviewableInvoiceLine[];
  stockItems: StockItem[];
  currency: string;
  onUpdateLine: (
    lineId: string,
    patch: Partial<ReviewableInvoiceLine>,
  ) => void;
  onCreateItemFromLine?: (line: ReviewableInvoiceLine) => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(15);

  const totalPages = Math.max(1, Math.ceil(lines.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = useMemo(
    () => lines.slice((safePage - 1) * pageSize, safePage * pageSize),
    [lines, safePage, pageSize],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-800">Linhas da fatura</h4>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>Por página</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
              setPage(1);
            }}
            className="rounded border border-slate-200 px-2 py-1 text-sm"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[1380px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <th className="px-2 py-2 font-medium">Descrição</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium">
                Qtd. fatura
              </th>
              <th className="whitespace-nowrap px-2 py-2 font-medium">Un. fatura</th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-medium">
                Qtd. stock
              </th>
              <th className="whitespace-nowrap px-2 py-2 font-medium">Un. stock</th>
              <th className="px-2 py-2 font-medium text-right">P. unit. s/ IVA</th>
              <th className="px-2 py-2 font-medium text-right">IVA %</th>
              <th className="px-2 py-2 font-medium text-right">Total c/ IVA</th>
              <th className="px-2 py-2 font-medium">Item stock</th>
              <th className="px-2 py-2 font-medium">Estado</th>
              <th className="px-2 py-2 font-medium text-right">Conf.</th>
              {onCreateItemFromLine ? (
                <th className="whitespace-nowrap px-2 py-2 text-center font-medium">
                  Criar item
                </th>
              ) : null}
              <th className="px-2 py-2 font-medium text-center">Ignorar</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((line) => {
              const preUnit = preDiscountFromPost(
                line.unit_price,
                line.discount_pct,
              );
              const preTotal = preDiscountFromPost(
                line.line_total,
                line.discount_pct,
              );
              const rowError =
                !line.ignored && (!line.stock_item_id || line.quantity <= 0);
              const badge =
                line.match_status === "matched"
                  ? "bg-emerald-100 text-emerald-800"
                  : line.match_status === "needs_review"
                    ? "bg-amber-100 text-amber-900"
                    : "bg-slate-100 text-slate-600";

              return (
                <tr
                  key={line.line_id}
                  className={`border-t border-slate-100 ${
                    rowError ? "bg-red-50/80" : ""
                  } ${line.ignored ? "opacity-60" : ""}`}
                >
                  <td className="max-w-[200px] px-2 py-2 align-top text-slate-800">
                    {line.description}
                  </td>
                  <td className="px-2 py-2 align-top text-right tabular-nums">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      disabled={line.ignored}
                      value={line.invoice_quantity}
                      onChange={(e) => {
                        const q = Number(e.target.value);
                        const qty = Number.isFinite(q) ? q : 0;
                        onUpdateLine(line.line_id, {
                          invoice_quantity: qty,
                          line_total: recomputeLineTotal(
                            qty,
                            line.unit_price,
                            line.vat_rate_pct,
                          ),
                        });
                      }}
                      className="w-[4.5rem] rounded border border-slate-200 px-1 py-1 text-right tabular-nums"
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input
                      type="text"
                      disabled={line.ignored}
                      value={line.invoice_unit}
                      onChange={(e) =>
                        onUpdateLine(line.line_id, {
                          invoice_unit: e.target.value,
                        })
                      }
                      className="w-14 rounded border border-slate-200 px-1 py-1 uppercase"
                    />
                  </td>
                  <td className="px-2 py-2 align-top text-right tabular-nums">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      disabled={line.ignored}
                      value={line.quantity}
                      onChange={(e) => {
                        const q = Number(e.target.value);
                        const qty = Number.isFinite(q) ? q : 0;
                        onUpdateLine(line.line_id, { quantity: qty });
                      }}
                      className="w-[4.5rem] rounded border border-slate-200 px-1 py-1 text-right tabular-nums"
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input
                      type="text"
                      disabled={line.ignored}
                      value={line.unit}
                      onChange={(e) =>
                        onUpdateLine(line.line_id, { unit: e.target.value })
                      }
                      className="w-14 rounded border border-slate-200 px-1 py-1 uppercase"
                    />
                  </td>
                  <td className="px-2 py-2 align-top text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      {preUnit != null && (
                        <span className="text-[10px] text-slate-400 line-through tabular-nums">
                          {formatMoney(preUnit, currency)}
                        </span>
                      )}
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        disabled={line.ignored}
                        value={line.unit_price}
                        onChange={(e) => {
                          const p = Number(e.target.value);
                          const up = Number.isFinite(p) ? p : 0;
                          onUpdateLine(line.line_id, {
                            unit_price: up,
                            line_total: recomputeLineTotal(
                              line.invoice_quantity,
                              up,
                              line.vat_rate_pct,
                            ),
                          });
                        }}
                        className="w-24 rounded border border-slate-200 px-1 py-1 text-right tabular-nums"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top text-right">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      disabled={line.ignored}
                      value={line.vat_rate_pct ?? ""}
                      placeholder="—"
                      onChange={(e) => {
                        const raw = e.target.value;
                        const v =
                          raw === "" ? null : Number(raw);
                        const vat = v != null && Number.isFinite(v) ? v : null;
                        onUpdateLine(line.line_id, {
                          vat_rate_pct: vat,
                          line_total: recomputeLineTotal(
                            line.invoice_quantity,
                            line.unit_price,
                            vat,
                          ),
                        });
                      }}
                      className="w-16 rounded border border-slate-200 px-1 py-1 text-right tabular-nums"
                    />
                  </td>
                  <td className="px-2 py-2 align-top text-right tabular-nums text-slate-700">
                    <div className="flex flex-col items-end gap-0.5">
                      {preTotal != null && (
                        <span className="text-[10px] text-slate-400 line-through">
                          {formatMoney(preTotal, currency)}
                        </span>
                      )}
                      <span>{formatMoney(line.line_total, currency)}</span>
                      {line.discount_pct != null && (
                        <span className="text-[10px] text-slate-500">
                          (−{line.discount_pct}%)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <select
                      disabled={line.ignored}
                      value={line.stock_item_id ?? ""}
                      onChange={(e) =>
                        onUpdateLine(line.line_id, {
                          stock_item_id: e.target.value || null,
                        })
                      }
                      className="max-w-[180px] rounded border border-slate-200 px-1 py-1 text-xs"
                    >
                      <option value="">— Selecionar —</option>
                      {stockItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${badge}`}
                    >
                      {MATCH_LABELS[line.match_status]}
                    </span>
                  </td>
                  <td className="px-2 py-2 align-top text-right text-slate-600 tabular-nums">
                    {line.match_confidence != null
                      ? `${Math.round(line.match_confidence * 100)}%`
                      : "—"}
                  </td>
                  {onCreateItemFromLine ? (
                    <td className="px-2 py-2 align-top text-center">
                      <button
                        type="button"
                        disabled={
                          line.ignored || line.match_status === "matched"
                        }
                        onClick={() => onCreateItemFromLine(line)}
                        className="whitespace-nowrap rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Criar item
                      </button>
                    </td>
                  ) : null}
                  <td className="px-2 py-2 align-top text-center">
                    <input
                      type="checkbox"
                      checked={line.ignored}
                      onChange={(e) =>
                        onUpdateLine(line.line_id, { ignored: e.target.checked })
                      }
                      aria-label="Ignorar linha"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span>
          {lines.length} linha(s) · página {safePage} de {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-slate-200 px-3 py-1 text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded border border-slate-200 px-3 py-1 text-sm disabled:opacity-40"
          >
            Seguinte
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        <strong>Fatura</strong>: quantidade e unidade lidas do documento (ou corrigidas).{" "}
        <strong>Stock</strong>: quantidade enviada na confirmação (conversão ex.: 1 PC → 10 un) —
        crítica para o servidor aprender mapeamentos. Linhas <strong>Correspondência</strong> vêm
        pré-preenchidas mas podem ser ajustadas antes de confirmar.
      </p>
      <p className="text-[11px] text-slate-500">
        Preços e totais do extracto já incluem desconto de linha quando indicado; o riscado mostra o
        valor antes do desconto. O total c/ IVA recalcula-se com <strong>qtd. fatura</strong> × P.
        unit. (s/ IVA) × (1 + IVA%) ao editar esses campos. Moeda: {currency}.
      </p>
    </div>
  );
}
