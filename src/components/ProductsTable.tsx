import { CATEGORY_LABELS, categoryLabel } from "../lib/categoryLabels";
import type { Category, ProductAgg } from "../types/monthlySummary";
import {
  calcDeliveryAppFee,
  calcDeliveryNetAfterApps,
  calcProductNetRealAfterApps,
} from "../lib/fees";
import {
  formatEUR,
  formatNumber,
  formatPct,
  normalizeText,
} from "../lib/format";
import { useMemo, useState } from "react";

type SortKey = "gross_total" | "qty" | "avg_gross_unit";
type SortDir = "desc" | "asc";

type Props = {
  products: ProductAgg[];
  totalsGross: number;
};

export function ProductsTable({ products, totalsGross }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("gross_total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const q = normalizeText(query);

    const filtered = products.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;

      const hay = normalizeText(`${p.title} ${p.reference}`);
      return hay.includes(q);
    });

    const sorted = filtered.slice().sort((a, b) => {
      const av =
        sortKey === "gross_total"
          ? a.amounts.gross_total
          : sortKey === "qty"
          ? a.qty
          : a.amounts.avg_gross_unit;

      const bv =
        sortKey === "gross_total"
          ? b.amounts.gross_total
          : sortKey === "qty"
          ? b.qty
          : b.amounts.avg_gross_unit;

      const diff = bv - av;
      return sortDir === "desc" ? diff : -diff;
    });

    return sorted;
  }, [products, query, category, sortKey, sortDir]);

  function toggleExpanded(ref: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  }

  return (
    <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tabela de produtos</h2>
          <p className="text-sm text-slate-500">
            Audite campeões/vilões por faturamento, volume e ticket médio
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="w-full sm:w-64">
            <label className="sr-only">Buscar</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou referência..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-300"
            />
          </div>

          <div>
            <label className="sr-only">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-300"
            >
              <option value="all">Todas</option>
              {CATEGORY_LABELS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <select
              value={`${sortKey}:${sortDir}`}
              onChange={(e) => {
                const [k, d] = e.target.value.split(":") as [SortKey, SortDir];
                setSortKey(k);
                setSortDir(d);
              }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-300"
            >
              <option value="gross_total:desc">Bruto (↓)</option>
              <option value="gross_total:asc">Bruto (↑)</option>
              <option value="qty:desc">Quant (↓)</option>
              <option value="qty:asc">Quant (↑)</option>
              <option value="avg_gross_unit:desc">Ticket médio (↓)</option>
              <option value="avg_gross_unit:asc">Ticket médio (↑)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="[&>th]:px-4 [&>th]:py-3">
                <th className="">Produto</th>
                <th className="text-right">Categoria</th>
                <th className="text-right">Quant</th>
                <th className="text-right">Bruto</th>
                <th className="text-right">Líquido</th>
                <th className="text-right">Líquido (- 30%)</th>
                <th className="text-right">% total</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => {
                const isOpen = expanded.has(p.reference);
                const share =
                  totalsGross > 0 ? p.amounts.gross_total / totalsGross : 0;

                return (
                  <>
                    <tr
                      key={p.reference}
                      className="hover:bg-slate-50/50 cursor-pointer"
                      onClick={() => toggleExpanded(p.reference)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-slate-900">
                              {p.title}
                            </div>
                            <div className="text-xs text-slate-500">
                              {p.reference} • IVA {p.tax_rate}%
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        {categoryLabel(p.category)}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {formatNumber(p.qty)}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold">
                        {formatEUR(p.amounts.gross_total)}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold">
                        {formatEUR(p.amounts.net_total)}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold">
                        {formatEUR(calcProductNetRealAfterApps(p))}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {formatPct(share)}
                      </td>
                    </tr>

                    {isOpen ? (
                      <tr className="bg-slate-50/40">
                        <td colSpan={9} className="px-4 py-4">
                          <ExpandedProductRow p={p} />
                        </td>
                      </tr>
                    ) : null}
                  </>
                );
              })}

              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    Nenhum produto encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ExpandedProductRow({ p }: { p: ProductAgg }) {
  const r = p.channels.restaurant;
  const d = p.channels.delivery;

  const rTax = r.gross_total - r.net_total;
  const dTax = d.gross_total - d.net_total;

  const rAvgGross = r.qty > 0 ? r.gross_total / r.qty : 0;
  const dAvgGross = d.qty > 0 ? d.gross_total / d.qty : 0;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-slate-100 bg-white p-4">
        <div className="text-sm font-semibold">Restaurant</div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
          <K title="Bruto" value={formatEUR(r.gross_total)} />
          <K title="IVA" value={formatEUR(rTax)} />
          <K title="Líquido" value={formatEUR(r.net_total)} />
          <K title="Ticket (Bruto)" value={formatEUR(rAvgGross)} />
          <K title="Quant" value={formatNumber(r.qty)} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-4">
        <div className="text-sm font-semibold">Delivery</div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
          <K title="Bruto" value={formatEUR(d.gross_total)} />
          <K title="IVA" value={formatEUR(dTax)} />
          <K title="Líquido (Antes 30%)" value={formatEUR(d.net_total)} />
          <K
            title="Taxa apps (30%)"
            value={formatEUR(calcDeliveryAppFee(d.gross_total))}
          />
          <K
            title="Líquido (Depois 30%)"
            value={formatEUR(
              calcDeliveryNetAfterApps(d.gross_total, d.net_total)
            )}
          />
          <K title="Ticket (Bruto)" value={formatEUR(dAvgGross)} />
          <K title="Quant" value={formatNumber(d.qty)} />
        </div>
      </div>
    </div>
  );
}

function K({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="font-semibold text-slate-900">{value}</div>
    </div>
  );
}
